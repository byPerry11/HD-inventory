from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Max
from .models import Conversation, Message
from .serializers import ConversationSerializer, MessageSerializer

class ConversationViewSet(viewsets.ModelViewSet):
    serializer_class = ConversationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Solo conversaciones donde el usuario participa.
        # No se hace prefetch de messages__sender: cargaba TODOS los mensajes
        # solo para ordenar (N+1 masivo). El último mensaje se resuelve por
        # conversación con query indexada en el serializer.
        return (self.request.user.conversations
                .prefetch_related('participants')
                .annotate(last_activity=Max('messages__timestamp'))
                .order_by('-last_activity', '-updated_at'))

    def perform_create(self, serializer):
        # Al crear una conversación, aseguramos que el creador esté incluido
        # y que los participantes existan (evita IntegrityError 500).
        from rest_framework.exceptions import ValidationError
        from apps.accounts.models import User
        participants = list(self.request.data.get('participants', []) or [])
        try:
            participant_ids = {int(p) for p in participants}
        except (TypeError, ValueError):
            raise ValidationError({'participants': 'IDs de participantes inválidos.'})
        if len(participant_ids) > 50:
            raise ValidationError({'participants': 'Máximo 50 participantes.'})
        existing = set(User.objects.filter(pk__in=participant_ids).values_list('id', flat=True))
        unknown = participant_ids - existing
        if unknown:
            raise ValidationError({'participants': f'Usuarios no existen: {sorted(unknown)}.'})
        participant_ids.add(self.request.user.id)
        is_group = serializer.validated_data.get('is_group', False)
        if is_group and not (serializer.validated_data.get('name') or '').strip():
            raise ValidationError({'name': 'El grupo requiere nombre.'})
        serializer.save(participants=sorted(participant_ids))

    @action(detail=False, methods=['post'])
    def find_or_create(self, request):
        """Busca chat 1-a-1 existente o crea uno nuevo."""
        from django.db import transaction
        target_id = request.data.get('target_user_id')
        if not target_id:
            return Response({'error': 'target_user_id es requerido'}, status=400)
        try:
            target_id = int(target_id)
        except (TypeError, ValueError):
            return Response({'error': 'target_user_id inválido'}, status=400)
        if target_id == request.user.id:
            return Response({'error': 'No puedes crear un chat contigo mismo'}, status=400)
        from apps.accounts.models import User
        if not User.objects.filter(pk=target_id).exists():
            return Response({'error': 'Usuario objetivo no existe'}, status=404)

        def _find_existing():
            # Chat 1-a-1 existente con exactamente estos 2 participantes.
            # (El Count() directo sobre el M2M filtrado no sirve: cuenta solo
            # las filas del JOIN filtrado, siempre daría 1. Se compara en Python;
            # los candidatos son poquísimos.)
            candidates = (
                Conversation.objects.filter(
                    is_group=False,
                    participants=request.user
                )
                .filter(participants=target_id)
                .prefetch_related('participants')
            )
            wanted = {request.user.id, target_id}
            for conv in candidates:
                if {p.id for p in conv.participants.all()} == wanted:
                    return conv
            return None

        existing = _find_existing()
        if existing:
            return Response(ConversationSerializer(existing, context={'request': request}).data)

        # Crear nueva conversación 1-a-1 (re-chequeo atómico anti-carrera)
        try:
            with transaction.atomic():
                existing = _find_existing()
                if existing:
                    return Response(
                        ConversationSerializer(existing, context={'request': request}).data)
                new_conv = Conversation.objects.create(is_group=False)
                new_conv.participants.add(request.user.id, target_id)
        except Exception:
            return Response({'error': 'No se pudo crear la conversación'}, status=500)
        return Response(ConversationSerializer(new_conv, context={'request': request}).data, status=201)

    @action(detail=True, methods=['get'])
    def online(self, request, pk=None):
        """Snapshot de presencia: quién está en línea + última vez visto."""
        import time
        from . import presence
        conversation = self.get_object()
        online_ids = presence.get_online_sync(conversation.id)
        data = []
        for p in conversation.participants.values('id', 'username'):
            if p['id'] == request.user.id:
                continue
            item = {
                'user_id': p['id'],
                'username': p['username'],
                'online': p['id'] in online_ids,
            }
            if not item['online']:
                item['last_seen'] = presence.get_last_seen_sync(
                    conversation.id, p['id'])
            data.append(item)
        return Response({
            'conversation_id': conversation.id,
            'now': int(time.time()),
            'users': data,
        })

    @action(detail=False, methods=['get'], url_path='online-summary')
    def online_summary(self, request):
        """{conversation_id: [user_ids en línea]} para las convs del usuario."""
        from . import presence
        conv_ids = list(request.user.conversations.values_list('id', flat=True))
        return Response({
            cid: sorted(presence.get_online_sync(cid)) for cid in conv_ids
        })

    @action(detail=True, methods=['get'])
    def messages(self, request, pk=None):
        conversation = self.get_object()
        # Mensajes con optimización de sender
        messages = conversation.messages.select_related('sender').all()
        
        # Paginación (opcional, pero recomendada)
        page = self.paginate_queryset(messages)
        if page is not None:
            serializer = MessageSerializer(page, many=True, context={'request': request})
            return self.get_paginated_response(serializer.data)

        serializer = MessageSerializer(messages, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        """Marca todos los mensajes de la conversación como leídos por el usuario."""
        conversation = self.get_object()
        unread_ids = list(
            conversation.messages.exclude(read_by=request.user).values_list('id', flat=True)
        )
        if unread_ids:
            Message.read_by.through.objects.bulk_create(
                [
                    Message.read_by.through(message_id=mid, user_id=request.user.id)
                    for mid in unread_ids
                ],
                ignore_conflicts=True,
            )
        return Response({'status': 'mensajes marcados como leídos'})

    @action(detail=True, methods=['post'])
    def upload_attachment(self, request, pk=None):
        """Sube un archivo y crea un mensaje asociado."""
        conversation = self.get_object()
        file_obj = request.FILES.get('file')

        if not file_obj:
            return Response({'error': 'No se proporcionó ningún archivo'}, status=400)

        # Límite 10MB + allowlist básica
        MAX_SIZE = 10 * 1024 * 1024
        if file_obj.size and file_obj.size > MAX_SIZE:
            return Response({'error': 'Archivo excede 10MB'}, status=400)
        allowed_prefixes = ('image/', 'application/pdf', 'text/', 'application/vnd')
        content_type = (getattr(file_obj, 'content_type', '') or '')
        if content_type and not (
            content_type.startswith('image/')
            or content_type.startswith('application/')
            or content_type.startswith('text/')
            or content_type.startswith('video/')
            or content_type.startswith('audio/')
        ):
            return Response({'error': f'Tipo no permitido: {content_type}'}, status=400)
        _ = allowed_prefixes  # documenta formatos esperados (pdf/excel/txt/imagen)

        # Determinar tipo de mensaje
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

        # Notificar vía WebSocket (no tumbar el 201 si Channels no está)
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync

        channel_layer = get_channel_layer()
        if channel_layer is not None:
            try:
                # URL relativa same-origin: el Host interno (backend:8000)
                # no es resoluble desde el navegador.
                attachment_url = (
                    message.attachment.url if message.attachment else None
                )
                async_to_sync(channel_layer.group_send)(
                    f'chat_{conversation.id}',
                    {
                        'type': 'chat_message',
                        'id': message.id,
                        'content': '',
                        'message': '',
                        'message_type': msg_type,
                        'attachment_url': attachment_url,
                        'file_name': message.file_name,
                        'file_size': message.file_size,
                        'sender_id': request.user.id,
                        'sender_name': request.user.username,
                        'timestamp': message.timestamp.isoformat()
                    }
                )
            except Exception:
                pass

        return Response(
            MessageSerializer(message, context={'request': request}).data,
            status=201)

class MessageViewSet(viewsets.ModelViewSet):
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Mensajes de conversaciones donde el usuario participa
        return (Message.objects.filter(conversation__participants=self.request.user)
                .select_related('sender', 'conversation')
                .prefetch_related('read_by'))

    def perform_create(self, serializer):
        from rest_framework.exceptions import PermissionDenied
        conversation = serializer.validated_data.get('conversation')
        if conversation and not conversation.participants.filter(pk=self.request.user.pk).exists():
            raise PermissionDenied('No participas en esta conversación.')
        serializer.save(sender=self.request.user)

    def perform_destroy(self, instance):
        from rest_framework.exceptions import PermissionDenied
        user = self.request.user
        is_owner = instance.sender_id == user.id
        is_staff = getattr(user, 'role', None) in ('manager', 'supervisor')
        if not (is_owner or is_staff):
            raise PermissionDenied('Solo el autor o un supervisor puede eliminar mensajes.')
        conv_id = instance.conversation_id
        msg_id = instance.id
        instance.delete()

        # Notificar eliminación vía WS (best-effort)
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync

        channel_layer = get_channel_layer()
        if channel_layer is None:
            return
        try:
            async_to_sync(channel_layer.group_send)(
                f'chat_{conv_id}',
                {
                    'type': 'message_deleted',
                    'id': msg_id
                }
            )
        except Exception:
            pass

    @action(detail=True, methods=['post'])
    def pin(self, request, pk=None):
        message = self.get_object()
        message.is_pinned = not message.is_pinned
        message.save()
        return Response({'is_pinned': message.is_pinned})
