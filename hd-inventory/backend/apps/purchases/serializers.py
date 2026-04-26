"""purchases/serializers.py"""
from rest_framework import serializers
from .models import OrdenCompra


class OrdenCompraSerializer(serializers.ModelSerializer):
    """Serializer completo para crear / editar una OC."""
    costo_total          = serializers.ReadOnlyField()
    tiempo_entrega_dias  = serializers.ReadOnlyField()
    status_label         = serializers.SerializerMethodField()
    creado_por_nombre    = serializers.SerializerMethodField()
    actualizado_por_nombre = serializers.SerializerMethodField()

    class Meta:
        model  = OrdenCompra
        fields = [
            'id',
            'fecha_emision',
            'material',
            'no_parte',
            'descripcion',
            'cantidad',
            'costo_unitario',
            'moneda',
            'costo_total',
            'status',
            'status_label',
            'po_number',
            'fecha_aprobacion',
            'fecha_recibido',
            'tiempo_entrega_dias',
            'vendedor',
            'comentarios',
            'creado_por',
            'creado_por_nombre',
            'actualizado_por',
            'actualizado_por_nombre',
            'creado_en',
            'actualizado_en',
        ]
        read_only_fields = [
            'id', 'costo_total', 'tiempo_entrega_dias',
            'fecha_aprobacion', 'fecha_recibido',
            'creado_en', 'actualizado_en',
            'creado_por', 'actualizado_por',
        ]

    def get_status_label(self, obj):
        return obj.get_status_display()

    def get_creado_por_nombre(self, obj):
        if obj.creado_por:
            return obj.creado_por.get_full_name() or obj.creado_por.username
        return None

    def get_actualizado_por_nombre(self, obj):
        if obj.actualizado_por:
            return obj.actualizado_por.get_full_name() or obj.actualizado_por.username
        return None


class OrdenCompraListSerializer(serializers.ModelSerializer):
    """Serializer reducido para el listado en tabla."""
    costo_total         = serializers.ReadOnlyField()
    tiempo_entrega_dias = serializers.ReadOnlyField()
    status_label        = serializers.SerializerMethodField()

    class Meta:
        model  = OrdenCompra
        fields = [
            'id',
            'fecha_emision',
            'no_parte',
            'descripcion',
            'cantidad',
            'costo_unitario',
            'moneda',
            'costo_total',
            'status',
            'status_label',
            'po_number',
            'fecha_aprobacion',
            'fecha_recibido',
            'tiempo_entrega_dias',
            'vendedor',
            'comentarios',
            'actualizado_en',
        ]

    def get_status_label(self, obj):
        return obj.get_status_display()
