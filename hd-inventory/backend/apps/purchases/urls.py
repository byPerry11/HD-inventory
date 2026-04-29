"""purchases/urls.py"""
from rest_framework.routers import DefaultRouter
from .views import OrdenCompraViewSet, ProveedorViewSet

router = DefaultRouter()
router.register(r'ordenes', OrdenCompraViewSet, basename='ordenes')
router.register(r'proveedores', ProveedorViewSet, basename='proveedores')

urlpatterns = router.urls
