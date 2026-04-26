"""ASGI config for core_main_hdinventory project."""
import os
from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core_main_hdinventory.settings')
application = get_asgi_application()
