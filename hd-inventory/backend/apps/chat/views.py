from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Count, Max, Q
from .models import Conversation, Message
from .serializers import ConversationSerializer, MessageSerializer

class ConversationViewSet(viewsets.ModelViewSet):
    serializer_class = ConversationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Solo conversaciones donde el usuario participa, con optimizaciones
        return (self.request.user.conversations
                .prefetch_related('participants', 'messages__sender')
                .annotate(last_activity=Max('messages__timestamp'))
                .order_by('-last_activity', '-updated_at'))

    def perform_create(self, serializer):
        # Al crear una conversación, aseguramos que el creador esté incluido
        participants = self.request.data.get('participants', [])
        if self.request.user.id not in participants:
            participants.append(self.request.user.id)
        serializer.save(participants=participants)

    @action(detail=False, methods=['post'])
    def find_or_create(self, request):
        """Busca chat 1-a-1 existente o crea uno nuevo."""
        target_id = request.data.get('target_user_id')
        if not target_id:
            return Response({'error': 'target_user_id es requerido'}, status=400)
            
        # Buscar conversación existente 1-a-1 con exactamente estos 2 participantes
        existing = Conversation.objects.filter(
            is_group=False, 
            participants=request.user
        ).filter(
            participants=target_id
        ).annotate(
            p_count=Count('participants')
        ).filter(p_count=2).first()
        
        if existing:
            return Response(ConversationSerializer(existing, context={'request': request}).data)
        
        # Crear nueva conversación 1-a-1
        new_conv = Conversation.objects.create(is_group=False)
        new_conv.participants.add(request.user, target_id)
        return Response(ConversationSerializer(new_conv, context={'request': request}).data, status=201)

    @action(detail=True, methods=['get'])
    def messages(self, request, pk=None):
        conversation = self.get_object()
        # Mensajes con optimización de sender
        messages = conversation.messages.select_related('sender').all()
        
        # Paginación (opcional, pero recomendada)
        page = self.paginate_queryset(messages)
        if page is not None:
            serializer = MessageSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
            
        serializer = MessageSerializer(messages, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        """Marca todos los mensajes de la conversación como leídos por el usuario."""
        conversation = self.get_object()
        unread_messages = conversation.messages.exclude(read_by=request.user)
        # Añadir al usuario a 'read_by' en todos los mensajes no leídos de una vez
        for msg in unread_messages:
            msg.read_by.add(request.user)
        return Response({'status': 'mensajes marcados como leídos'})

    @action(detail=True, methods=['post'])
    def upload_attachment(self, request, pk=None):
        """Sube un archivo y crea un mensaje asociado."""
        conversation = self.get_object()
        file_obj = request.FILES.get('file')
        
        if not file_obj:
            return Response({'error': 'No se proporcionó ningún archivo'}, status=400)
            
        # Determinar tipo de mensaje
        content_type = file_obj.content_type
        msg_type = 'file'
        if content_type.startswith('image/'):
            msg_type = 'image'
            
        # Crear mensaje
        message = Message.objects.create(
            conversation=conversation,
            sender=request.user,
            message_type=msg_type,
            attachment=file_obj,
            file_name=file_obj.name,
            file_size=file_obj.size
        )
        
        # Notificar vía WebSocket (opcional, el frontend puede detectarlo si recibe el 201)
        # Pero para que los demás lo vean, necesitamos disparar el group_send
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'chat_{conversation.id}',
            {
                'type': 'chat_message',
                'id': message.id,
                'message': '',
                'message_type': msg_type,
                'attachment_url': message.attachment.url,
                'file_name': message.file_name,
                'file_size': message.file_size,
                'sender_id': request.user.id,
                'sender_name': request.user.username,
                'timestamp': message.timestamp.isoformat()
            }
        )
        
        return Response(MessageSerializer(message).data, status=201)

class MessageViewSet(viewsets.ModelViewSet):
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Mensajes de conversaciones donde el usuario participa
        return (Message.objects.filter(conversation__participants=self.request.user)
                .select_related('sender', 'conversation')
                .prefetch_related('read_by'))

    def perform_create(self, serializer):
        serializer.save(sender=self.request.user)
        
    def perform_destroy(self, instance):
        conv_id = instance.conversation_id
        msg_id = instance.id
        instance.delete()
        
        # Notificar eliminación vía WS
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'chat_{conv_id}',
            {
                'type': 'message_deleted',
                'id': msg_id
            }
        )

    @action(detail=True, methods=['post'])
    def pin(self, request, pk=None):
        message = self.get_object()
        message.is_pinned = not message.is_pinned
        message.save()
        return Response({'is_pinned': message.is_pinned})
