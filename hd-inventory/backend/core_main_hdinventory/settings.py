"""
Django settings — HD-Inventory
Almacén de Materiales PE
"""

import os
from pathlib import Path
from datetime import timedelta
from decouple import config, Csv

BASE_DIR = Path(__file__).resolve().parent.parent

# ─── Seguridad ───────────────────────────────────────────────
SECRET_KEY = config('SECRET_KEY', default='django-insecure-change-me')
DEBUG = config('DEBUG', default=True, cast=bool)
ALLOWED_HOSTS = config(
    'ALLOWED_HOSTS',
    default='localhost,127.0.0.1,backend,0.0.0.0,mxtjsf225,mxtjsf225.tpvaoc.com,mxtj225.inventory,192.168.10.163',
    cast=Csv()
)

# ─── Aplicaciones ────────────────────────────────────────────
INSTALLED_APPS = [
    'daphne',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'channels',
    # Third party
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'django_filters',
    # Aplicaciones locales
    'apps.accounts',
    'apps.materials',
    'apps.inventory',
    'apps.analytics',
    'apps.purchases',
    'apps.chat',
]

# ─── Middleware ───────────────────────────────────────────────
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',           # antes de CommonMiddleware
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'core_main_hdinventory.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'core_main_hdinventory.wsgi.application'
ASGI_APPLICATION = 'core_main_hdinventory.asgi.application'

# ─── Configuración de Channels (Redis) ────────────────────────
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            "hosts": [(config('REDIS_HOST', default='redis'), 6379)],
        },
    },
}

# ─── Base de datos — PostgreSQL ───────────────────────────────
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': config('DB_NAME', default='hdinventory'),
        'USER': config('DB_USER', default='hduser'),
        'PASSWORD': config('DB_PASSWORD', default='hdpassword2026'),
        'HOST': config('DB_HOST', default='localhost'),
        'PORT': config('DB_PORT', default='5432'),
    }
}

# ─── Modelo de usuario personalizado ─────────────────────────
AUTH_USER_MODEL = 'accounts.User'

# ─── Validación de contraseñas ────────────────────────────────
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# ─── Django REST Framework ────────────────────────────────────
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ],
    'DEFAULT_PAGINATION_CLASS': 'core_main_hdinventory.pagination.CustomPagination',
    'PAGE_SIZE': 50,
}

# ─── JWT ─────────────────────────────────────────────────────
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# ─── CORS ─────────────────────────────────────────────────────
CORS_ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://mxtjsf225:5173',
    'http://mxtjsf225.tpvaoc.com:5173',
    'http://localhost:3000',
    'http://mxtj225.inventory',
    'http://mxtjsf225',
    'http://mxtjsf225.tpvaoc.com',
    'http://192.168.10.163',
]
CORS_ALLOW_CREDENTIALS = True

CSRF_TRUSTED_ORIGINS = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://mxtjsf225:5173',
    'http://mxtjsf225.tpvaoc.com:5173',
    'http://mxtjsf225',
    'http://mxtjsf225.tpvaoc.com',
    'http://192.168.10.163',
]

# ─── Internacionalización ─────────────────────────────────────
LANGUAGE_CODE = 'es-mx'
TIME_ZONE = 'America/Hermosillo'
USE_I18N = True
USE_TZ = True

# ─── Archivos estáticos y media ───────────────────────────────
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ─── WhiteNoise — Servir estáticos del admin ──────────────────
STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}

# ─── Admin site ───────────────────────────────────────────────
ADMIN_SITE_HEADER = 'Almacén de Materiales PE — Admin'
ADMIN_SITE_TITLE = 'HD Inventory Admin'
ADMIN_INDEX_TITLE = 'Panel de Administración'
