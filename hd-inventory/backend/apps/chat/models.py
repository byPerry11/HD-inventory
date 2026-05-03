from django.db import models
from django.conf import settings
from .encryption import encrypt_message, decrypt_message

class Conversation(models.Model):
    participants = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='conversations')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Conversación {self.id}"

class Message(models.Model):
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='sent_messages')
    
    # El contenido se guarda cifrado en la DB
    encrypted_content = models.TextField(verbose_name="Contenido Cifrado")
    
    attachment = models.FileField(upload_to='chat_attachments/', null=True, blank=True)
    is_image = models.BooleanField(default=False)
    
    timestamp = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)

    class Meta:
        ordering = ['timestamp']

    @property
    def content(self):
        return decrypt_message(self.encrypted_content)

    @content.setter
    def content(self, value):
        self.encrypted_content = encrypt_message(value)

    def __str__(self):
        return f"Mensaje de {self.sender} en {self.timestamp}"
