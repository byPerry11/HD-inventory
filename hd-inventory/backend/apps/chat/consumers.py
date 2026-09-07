import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .models import Conversation, Message
from . import presence
from django.utils import timezone

class ChatConsumer(AsyncWebsocketConsumer):
    # Códigos de cierre de app (rango 4000-4999) para que el frontend
    # distinga auth/permiso de un corte de red (1006).
    CLOSE_UNAUTHORIZED = 4401
    CLOSE_FORBIDDEN = 4403
    CLOSE_NOT_FOUND = 4404
    MAX_MESSAGE_LENGTH = 2000

    async def connect(self):
        self.conversation_id = self.scope['url_route']['kwargs']['conversation_id']
        self.room_group_name = f'chat_{self.conversation_id}'
        self.user = self.scope["user"]
        self.joined = False

        # Nota: se hace accept() antes de close() con código de app porque
        # uvicorn traduce un close previo al accept en un 403 de handshake
        # y el navegador nunca vería el código (llegaría como 1006 genérico).
        if self.user.is_anonymous:
            await self.accept()
            await self.close(code=self.CLOSE_UNAUTHORIZED)
            return

        # Verificar si el usuario pertenece a la conversación
        if not await self.is_participant(self.user, self.conversation_id):
            await self.accept()
            await self.close(code=self.CLOSE_FORBIDDEN)
            return

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()
        self.joined = True
        await presence.mark_online(self.conversation_id, self.user.id)

        # Notificar presencia Online
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'user_presence',
                'user_id': self.user.id,
                'status': 'online'
            }
        )

    async def disconnect(self, close_code):
        # Solo notificar/salir del grupo si el join se completó
        # (rechazos en connect() no están en el grupo).
        if not getattr(self, 'joined', False):
            return
        try:
            await presence.mark_offline(self.conversation_id, self.user.id)
            if hasattr(self, 'user') and not self.user.is_anonymous:
                # Notificar presencia Offline
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'user_presence',
                        'user_id': self.user.id,
                        'status': 'offline'
                    }
                )
            if hasattr(self, 'room_group_name'):
                await self.channel_layer.group_discard(
                    self.room_group_name,
                    self.channel_name
                )
        except Exception:
            pass  # best-effort: redis caído no debe ensuciar el cierre

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            return

        msg_type = data.get('type', 'message')

        if msg_type == 'typing':
            # Notificar que el usuario está escribiendo
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'user_typing',
                    'user_id': self.user.id,
                    'username': self.user.username,
                    'is_typing': data.get('is_typing', True)
                }
            )
            return

        if msg_type == 'heartbeat':
            # Renueva presencia (TTL) sin emitir eventos
            await presence.refresh_presence(self.conversation_id, self.user.id)
            return

        message_text = data.get('message')
        if message_text:
            if not isinstance(message_text, str) or len(message_text) > self.MAX_MESSAGE_LENGTH:
                await self.send(text_data=json.dumps({
                    'type': 'error',
                    'detail': f'Mensaje inválido (máximo {self.MAX_MESSAGE_LENGTH} caracteres).',
                }))
                return
            # Guardar en DB (la conversación pudo borrarse con el socket abierto)
            try:
                msg_obj = await self.save_message(self.user, self.conversation_id, message_text)
            except Conversation.DoesNotExist:
                await self.close(code=self.CLOSE_NOT_FOUND)
                return
            
            # Obtener avatar del sender
            sender_avatar = await self.get_user_avatar(self.user)
            
            # Enviar a todos en el grupo
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_message',
                    'id': msg_obj.id,
                    'content': message_text,
                    'sender_id': self.user.id,
                    'sender_name': self.user.username,
                    'sender_avatar': sender_avatar,
                    'timestamp': msg_obj.timestamp.isoformat(),
                    'message_type': 'text'
                }
            )

    async def chat_message(self, event):
        # Envía el mensaje al WebSocket
        await self.send(text_data=json.dumps(event))

    @database_sync_to_async
    def get_user_avatar(self, user):
        return user.avatar.url if user.avatar else None

    async def user_typing(self, event):
        # Envía el estado de "escribiendo" al WebSocket
        # Evitar enviarlo al mismo usuario que escribe si se prefiere
        if event['user_id'] != self.user.id:
            await self.send(text_data=json.dumps(event))

    async def user_presence(self, event):
        # Envía el estado de presencia al WebSocket
        if event['user_id'] != self.user.id:
            await self.send(text_data=json.dumps(event))

    async def message_deleted(self, event):
        # Envía la notificación de eliminación al WebSocket
        await self.send(text_data=json.dumps(event))

    @database_sync_to_async
    def is_participant(self, user, conv_id):
        try:
            return Conversation.objects.filter(id=conv_id, participants=user).exists()
        except Exception:
            return False

    @database_sync_to_async
    def save_message(self, sender, conv_id, text):
        conv = Conversation.objects.get(id=conv_id)
        msg = Message(conversation=conv, sender=sender)
        msg.content = text # Cifrado automático
        msg.save()
        
        # Actualizar updated_at de la conversación para que aparezca arriba en la lista
        conv.save(update_fields=['updated_at'])
        return msg
