"""Signals del chat: limpieza de archivos huérfanos."""
from django.db.models.signals import post_delete
from django.dispatch import receiver
from .models import Message


@receiver(post_delete, sender=Message)
def delete_message_attachment(sender, instance, **kwargs):
    """Borra el archivo físico al eliminar el mensaje (cualquier vía)."""
    try:
        if instance.attachment and instance.attachment.name:
            instance.attachment.storage.delete(instance.attachment.name)
    except Exception:
        pass
