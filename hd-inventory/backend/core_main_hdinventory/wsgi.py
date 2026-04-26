"""WSGI config for core_main_hdinventory project."""
import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core_main_hdinventory.settings')
application = get_wsgi_application()
