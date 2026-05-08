"""inventory/serializers.py"""
from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Entrada, Salida, Area, Linea, TURNO_CHOICES, Vale, Empleado
from apps.materials.serializers import MaterialListSerializer

User = get_user_model()


class EmpleadoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Empleado
        fields = ['id', 'numero', 'nombre']


class LineaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Linea
        fields = ['id', 'nombre']


class AreaSerializer(serializers.ModelSerializer):
    linea_nombre = serializers.ReadOnlyField(source='linea.nombre')

    class Meta:
        model = Area
        fields = ['id', 'nombre', 'linea', 'linea_nombre']


class EntradaSerializer(serializers.ModelSerializer):
    """Serializer de Entrada de material."""
    material_info = MaterialListSerializer(source='material', read_only=True)
    registrado_por_nombre = serializers.SerializerMethodField()

    class Meta:
        model = Entrada
        fields = [
            'id', 'material', 'material_info',
            'cantidad', 'fecha',
            'proveedor', 'numero_orden', 'observaciones',
            'registrado_por', 'registrado_por_nombre',
        ]
        read_only_fields = ['id', 'fecha', 'registrado_por', 'material_info', 'registrado_por_nombre']

    def get_registrado_por_nombre(self, obj):
        if obj.registrado_por:
            return obj.registrado_por.get_full_name() or obj.registrado_por.username
        return None

    def create(self, validated_data):
        # El usuario se obtiene del request automáticamente
        validated_data['registrado_por'] = self.context['request'].user
        return super().create(validated_data)


class SalidaSerializer(serializers.ModelSerializer):
    """Serializer de Salida de material."""
    material_info = MaterialListSerializer(source='material', read_only=True)
    registrado_por_nombre = serializers.SerializerMethodField()
    linea_nombre = serializers.ReadOnlyField(source='linea.nombre')
    area_nombre = serializers.ReadOnlyField(source='area.nombre')
    turno_choices = serializers.SerializerMethodField()

    class Meta:
        model = Salida
        fields = [
            'id', 'material', 'material_info',
            'cantidad', 'fecha',
            'linea', 'linea_nombre',
            'area', 'area_nombre',
            'turno', 'empleado_no', 'recibio', 'observaciones',
            'registrado_por', 'registrado_por_nombre',
            'turno_choices',
        ]
        read_only_fields = [
            'id', 'fecha', 'registrado_por',
            'material_info', 'registrado_por_nombre',
            'linea_nombre', 'area_nombre',
            'turno_choices',
        ]

    def get_registrado_por_nombre(self, obj):
        if obj.registrado_por:
            return obj.registrado_por.get_full_name() or obj.registrado_por.username
        return None


    def get_turno_choices(self, obj):
        return [{'value': v, 'label': l} for v, l in TURNO_CHOICES]

    def create(self, validated_data):
        validated_data['registrado_por'] = self.context['request'].user

        # Lógica de auto-registro de empleado
        empleado_no = validated_data.get('empleado_no')
        nombre = validated_data.get('recibio')
        if empleado_no and nombre:
            Empleado.objects.update_or_create(
                numero=empleado_no,
                defaults={'nombre': nombre}
            )

        return super().create(validated_data)

    def validate(self, data):
        """Valida que haya stock suficiente antes de registrar la salida."""
        material = data.get('material')
        cantidad = data.get('cantidad', 0)
        if material and material.stock_actual < cantidad:
            raise serializers.ValidationError({
                'cantidad': (
                    f'Stock insuficiente. Disponible: {material.stock_actual} '
                    f'{material.get_unit_display()}.'
                )
            })
        return data




class ValeSerializer(serializers.ModelSerializer):
    """Serializer para Vales"""
    material_info = MaterialListSerializer(source='material', read_only=True)
    registrado_por_nombre = serializers.SerializerMethodField()
    linea_nombre = serializers.ReadOnlyField(source='linea.nombre')
    area_nombre = serializers.ReadOnlyField(source='area.nombre')

    class Meta:
        model = Vale
        fields = [
            'id', 'empleado_no', 'empleado_nombre', 'recibo_no', 
            'linea', 'linea_nombre',
            'area', 'area_nombre', 'salida',
            'fecha', 'material', 'material_info', 'aut', 'cantidad', 'costo', 'observaciones',
            'registrado_por', 'registrado_por_nombre',
        ]
        read_only_fields = [
            'id', 'fecha', 'registrado_por', 'material_info', 
            'registrado_por_nombre', 'recibo_no',
            'linea_nombre', 'area_nombre',
        ]


    def get_registrado_por_nombre(self, obj):
        if obj.registrado_por:
            return obj.registrado_por.get_full_name() or obj.registrado_por.username
        return None

    def create(self, validated_data):
        validated_data['registrado_por'] = self.context['request'].user
        
        # Lógica de auto-registro de empleado
        empleado_no = validated_data.get('empleado_no')
        nombre = validated_data.get('empleado_nombre')
        if empleado_no and nombre:
            Empleado.objects.update_or_create(
                numero=empleado_no,
                defaults={'nombre': nombre}
            )

        # Asegurar costo desde material si no viene
        material = validated_data.get('material')
        if material and not validated_data.get('costo'):
            validated_data['costo'] = 0
        return super().create(validated_data)
