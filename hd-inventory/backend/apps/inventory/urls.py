"""inventory/urls.py"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import EntradaViewSet, SalidaViewSet, SeccionViewSet, AreaViewSet, ValeViewSet, EmpleadoViewSet

router = DefaultRouter()
router.register(r'entradas', EntradaViewSet, basename='entrada')
router.register(r'salidas', SalidaViewSet, basename='salida')
router.register(r'secciones', SeccionViewSet, basename='seccion')
router.register(r'areas', AreaViewSet, basename='area')
router.register(r'vales', ValeViewSet, basename='vale')
router.register(r'empleados', EmpleadoViewSet, basename='empleado')

urlpatterns = [
    path('', include(router.urls)),
]
