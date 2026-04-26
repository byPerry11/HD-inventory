"""materials/urls.py"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import MaterialViewSet, CategoryViewSet

router = DefaultRouter()
router.register(r'categorias', CategoryViewSet, basename='categoria')
router.register(r'', MaterialViewSet, basename='material')

urlpatterns = [
    path('', include(router.urls)),
]
