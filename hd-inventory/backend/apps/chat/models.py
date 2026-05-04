from django.db import models
from django.conf import settings
from .encryption import encrypt_message, decrypt_message

class Conversation(models.Model):
    name = models.CharField(max_length=100, blank=True, null=True, verbose_name="Nombre del grupo")
    is_group = models.BooleanField(default=False)
    avatar = models.ImageField(upload_to='chat_groups/', null=True, blank=True, verbose_name="Imagen del grupo")
    participants = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='conversations')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Conversación'
        verbose_name_plural = 'Conversaciones'
        ordering = ['-updated_at']

    def __str__(self):
        if self.is_group and self.name:
            return f"Grupo: {self.name}"
        participants_count = self.participants.count()
        return f"Chat {self.id} ({participants_count} participantes)"

class Message(models.Model):
    MESSAGE_TYPES = [
        ('text', 'Texto'),
        ('image', 'Imagen'),
        ('file', 'Archivo'),
        ('link', 'Enlace'),
    ]
    
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='sent_messages')
    
    # El contenido se guarda cifrado en la DB
    encrypted_content = models.TextField(verbose_name="Contenido Cifrado")
    
    message_type = models.CharField(max_length=10, choices=MESSAGE_TYPES, default='text')
    
    attachment = models.FileField(upload_to='chat_attachments/%Y/%m/', null=True, blank=True)
    file_name = models.CharField(max_length=255, blank=True)
    file_size = models.PositiveIntegerField(null=True, blank=True) # en bytes
    
    timestamp = models.DateTimeField(auto_now_add=True)
    
    # Read receipts
    read_by = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='read_messages', blank=True)
    
    # Mensajes fijados
    is_pinned = models.BooleanField(default=False)

    class Meta:
        ordering = ['timestamp']
        indexes = [
            models.Index(fields=['conversation', 'timestamp']),
        ]
        verbose_name = 'Mensaje'
        verbose_name_plural = 'Mensajes'

    @property
    def content(self):
        return decrypt_message(self.encrypted_content)

    @content.setter
    def content(self, value):
        self.encrypted_content = encrypt_message(value)

    def __str__(self):
        return f"Mensaje de {self.sender} en {self.timestamp} ({self.message_type})"
