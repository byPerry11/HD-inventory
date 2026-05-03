import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .models import Conversation, Message
from django.contrib.auth import get_user_model

User = get_user_model()

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.conversation_id = self.scope['url_route']['kwargs']['conversation_id']
        self.room_group_name = f'chat_{self.conversation_id}'

        # Verificar si el usuario pertenece a la conversación (opcional pero recomendado)
        # Por ahora lo permitimos si está autenticado
        if self.scope["user"].is_anonymous:
            await self.close()
        else:
            await self.channel_layer.group_add(
                self.room_group_name,
                self.channel_name
            )
            await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        data = json.loads(text_data)
        message_text = data.get('message')
        sender = self.scope["user"]

        if message_text:
            # Guardar en DB
            msg_obj = await self.save_message(sender, self.conversation_id, message_text)
            
            # Enviar a los demás en el grupo
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_message',
                    'message': message_text,
                    'sender_id': sender.id,
                    'sender_name': sender.username,
                    'timestamp': msg_obj.timestamp.isoformat()
                }
            )

    async def chat_message(self, event):
        # Envía el mensaje al WebSocket
        await self.send(text_data=json.dumps(event))

    @database_sync_to_async
    def save_message(self, sender, conv_id, text):
        conv = Conversation.objects.get(id=conv_id)
        msg = Message(conversation=conv, sender=sender)
        msg.content = text # Esto cifra automáticamente
        msg.save()
        return msg
