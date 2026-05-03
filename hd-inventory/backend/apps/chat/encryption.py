from cryptography.fernet import Fernet
from django.conf import settings
import base64
import os

def get_encryption_key():
    key = os.getenv('CHAT_ENCRYPTION_KEY')
    if not key:
        # Si no existe, generamos una (aunque lo ideal es tenerla fija en .env)
        return Fernet.generate_key()
    return key.encode()

def encrypt_message(message_text):
    if not message_text:
        return ""
    f = Fernet(get_encryption_key())
    return f.encrypt(message_text.encode()).decode()

def decrypt_message(encrypted_text):
    if not encrypted_text:
        return ""
    try:
        f = Fernet(get_encryption_key())
        return f.decrypt(encrypted_text.encode()).decode()
    except Exception:
        return "[Error al descifrar mensaje]"
