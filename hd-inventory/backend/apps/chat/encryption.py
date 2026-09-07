from cryptography.fernet import Fernet
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
import os
import warnings

_fernet_instance = None

def _get_fernet():
    global _fernet_instance
    if _fernet_instance is None:
        key = os.getenv('CHAT_ENCRYPTION_KEY')
        if not key:
            if settings.DEBUG:
                # Clave fija de desarrollo: todos los workers/procesos comparten
                # la misma para no perder mensajes al reiniciar. NUNCA en prod.
                key = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='
                warnings.warn("CHAT_ENCRYPTION_KEY no configurada. Usando clave fija de desarrollo.")
            else:
                raise ImproperlyConfigured("CHAT_ENCRYPTION_KEY es requerida en producción para el chat cifrado.")
        
        try:
            _fernet_instance = Fernet(key.encode() if isinstance(key, str) else key)
        except Exception as e:
            raise ImproperlyConfigured(f"La clave CHAT_ENCRYPTION_KEY no es válida para Fernet: {e}")
            
    return _fernet_instance

def encrypt_message(message_text):
    if not message_text:
        return ""
    f = _get_fernet()
    return f.encrypt(message_text.encode()).decode()

def decrypt_message(encrypted_text):
    if not encrypted_text:
        return ""
    try:
        f = _get_fernet()
        return f.decrypt(encrypted_text.encode()).decode()
    except Exception:
        return "[Error al descifrar mensaje]"
