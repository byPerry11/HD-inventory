"""materials/serializers.py"""
from rest_framework import serializers
from .models import Material, Category


class RelativeImageField(serializers.ImageField):
    """
    Devuelve siempre la URL relativa de la imagen (/media/...)
    en vez de la absoluta (http://backend:8000/media/...).
    Así el proxy de Vite en desarrollo (y Nginx en producción)
    puede interceptarla correctamente desde el navegador.
    """
    def to_representation(self, value):
        if not value:
            return None
        return value.url   # Ej: /media/materials/imagen.jpg


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'descripcion']


class MaterialSerializer(serializers.ModelSerializer):
    """Serializer completo de material con estado calculado."""
    estado       = serializers.ReadOnlyField()
    estado_label = serializers.ReadOnlyField()
    category_name = serializers.SerializerMethodField()
    image        = RelativeImageField(required=False, allow_null=True)

    class Meta:
        model = Material
        fields = [
            'id', 'code', 'barcode', 'name', 'category', 'category_name',
            'unit', 'descripcion', 'ubicacion', 'image',
            'stock_actual', 'stock_minimo', 'stock_critico',
            'estado', 'estado_label',
            'activo', 'creado_en', 'actualizado_en',
        ]
        read_only_fields = ['id', 'estado', 'estado_label', 'creado_en', 'actualizado_en']

    def get_category_name(self, obj):
        return obj.category.name if obj.category else None

    def validate_barcode(self, value):
        """Convertir string vacío a None para no violar unique constraint en PostgreSQL.
        Dos NULL no colisionan entre sí, pero dos '' sí lo hacen."""
        if not value:
            return None
        return value

    def validate_category(self, value):
        """Permitir categoría vacía/nula desde el formulario."""
        return value or None


class MaterialListSerializer(serializers.ModelSerializer):
    """Serializer reducido para listados (mejor performance)."""
    estado       = serializers.ReadOnlyField()
    estado_label = serializers.ReadOnlyField()
    category_name = serializers.SerializerMethodField()
    image        = RelativeImageField(required=False, allow_null=True)

    class Meta:
        model = Material
        fields = [
            'id', 'code', 'barcode', 'name', 'category_name', 'image',
            'unit', 'ubicacion', 'stock_actual', 'stock_minimo', 'stock_critico',
            'estado', 'estado_label', 'activo',
        ]

    def get_category_name(self, obj):
        return obj.category.name if obj.category else None
