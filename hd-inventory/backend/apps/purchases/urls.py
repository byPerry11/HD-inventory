"""purchases/urls.py"""
from rest_framework.routers import DefaultRouter
from .views import OrdenCompraViewSet

router = DefaultRouter()
router.register(r'ordenes', OrdenCompraViewSet, basename='ordenes')

urlpatterns = router.urls
