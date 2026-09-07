"""
URL configuration — HD-Inventory Backend
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse
from django.views.decorators.http import require_GET

# Personalización del admin
admin.site.site_header = settings.ADMIN_SITE_HEADER
admin.site.site_title = settings.ADMIN_SITE_TITLE
admin.site.index_title = settings.ADMIN_INDEX_TITLE


@require_GET
def health_check(request):
    from django.db import connections
    from django.db.utils import OperationalError
    try:
        connections['default'].cursor()
        db_ok = True
    except OperationalError:
        db_ok = False
    payload = {"status": "healthy" if db_ok else "degraded", "db": "up" if db_ok else "down"}
    return JsonResponse(payload, status=200 if db_ok else 503)


urlpatterns = [
    path('health/', health_check, name='health_check'),
    path('admin/', admin.site.urls),

    # API v1
    path('api/auth/', include('apps.accounts.urls')),
    path('api/materials/', include('apps.materials.urls')),
    path('api/inventory/', include('apps.inventory.urls')),
    path('api/analytics/', include('apps.analytics.urls')),
    path('api/purchases/', include('apps.purchases.urls')),
    path('api/chat/', include('apps.chat.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
