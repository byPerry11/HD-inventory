"""inventory/serializers.py"""
from django.db import transaction
from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Entrada, Salida, Area, Linea, TURNO_CHOICES, Vale, ValeItem, Empleado
from apps.materials.models import Material
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
        """Valida stock suficiente (chequeo rápido; el lock real va en la vista)."""
        material = data.get('material') or getattr(self.instance, 'material', None)
        cantidad = data.get('cantidad', getattr(self.instance, 'cantidad', 0) or 0)
        if cantidad is not None and cantidad <= 0:
            raise serializers.ValidationError({
                'cantidad': 'La cantidad debe ser mayor a 0.'
            })
        if material and cantidad:
            # Refresca stock desde DB para no validar con instancia stale
            try:
                stock = Material.objects.values_list('stock_actual', flat=True).get(pk=material.pk)
            except Material.DoesNotExist:
                raise serializers.ValidationError({'material': 'Material no existe.'})
            if stock < cantidad:
                raise serializers.ValidationError({
                    'cantidad': (
                        f'Stock insuficiente. Disponible: {stock} '
                        f'{material.get_unit_display()}.'
                    )
                })
        return data




class ValeItemSerializer(serializers.ModelSerializer):
    """Serializer para artículos individuales de un Vale."""
    material_info = MaterialListSerializer(source='material', read_only=True)

    class Meta:
        model = ValeItem
        fields = ['id', 'material', 'material_info', 'cantidad', 'costo']

    def validate_cantidad(self, value):
        if value <= 0:
            raise serializers.ValidationError('La cantidad debe ser mayor a 0.')
        return value


class ValeSerializer(serializers.ModelSerializer):
    """Serializer para Vales (con soporte multi-artículo vía items)."""
    material_info = MaterialListSerializer(source='material', read_only=True)
    registrado_por_nombre = serializers.SerializerMethodField()
    linea_nombre = serializers.ReadOnlyField(source='linea.nombre')
    area_nombre = serializers.ReadOnlyField(source='area.nombre')
    items = ValeItemSerializer(many=True, required=False)

    class Meta:
        model = Vale
        fields = [
            'id', 'empleado_no', 'empleado_nombre', 'recibo_no', 
            'linea', 'linea_nombre',
            'area', 'area_nombre', 'salida',
            'fecha', 'material', 'material_info', 'aut', 'cantidad', 'costo', 'observaciones',
            'registrado_por', 'registrado_por_nombre',
            'firma_supervisor', 'firma_supervisor_nombre',
            'firma_gerente', 'firma_gerente_nombre',
            'firma_empleado', 'firma_empleado_nombre',
            'firma_entrega', 'firma_entrega_nombre',
            'items',
        ]
        read_only_fields = [
            'id', 'registrado_por', 'material_info', 
            'registrado_por_nombre',
            'linea_nombre', 'area_nombre',
        ]


    def get_registrado_por_nombre(self, obj):
        if obj.registrado_por:
            return obj.registrado_por.get_full_name() or obj.registrado_por.username
        return None

    def _persist_empleado(self, data):
        empleado_no = data.get('empleado_no')
        nombre = data.get('empleado_nombre')
        if empleado_no and nombre:
            Empleado.objects.update_or_create(
                numero=empleado_no,
                defaults={'nombre': nombre}
            )

    def validate(self, data):
        """Valida stock suficiente para vales multi-item y legacy."""
        items = data.get('items', None)
        salida = data.get('salida', getattr(self.instance, 'salida', None))
        # Si está vinculado a Salida no descuenta stock: no validar
        if salida:
            return data
        if items:
            for idx, item in enumerate(items):
                material = item.get('material')
                cantidad = item.get('cantidad', 0) or 0
                if cantidad <= 0:
                    raise serializers.ValidationError({
                        'items': f'Item {idx}: la cantidad debe ser mayor a 0.'
                    })
                if material:
                    try:
                        stock = Material.objects.values_list(
                            'stock_actual', flat=True).get(pk=material.pk)
                    except Material.DoesNotExist:
                        raise serializers.ValidationError({
                            'items': f'Item {idx}: material no existe.'
                        })
                    if stock < cantidad:
                        raise serializers.ValidationError({
                            'items': (
                                f'Item {idx}: stock insuficiente para '
                                f'{material.code}. Disponible: {stock}.'
                            )
                        })
        else:
            material = data.get('material', getattr(self.instance, 'material', None))
            cantidad = data.get('cantidad', getattr(self.instance, 'cantidad', 0) or 0)
            if material and cantidad:
                try:
                    stock = Material.objects.values_list(
                        'stock_actual', flat=True).get(pk=material.pk)
                except Material.DoesNotExist:
                    raise serializers.ValidationError({'material': 'Material no existe.'})
                if stock < cantidad:
                    raise serializers.ValidationError({
                        'cantidad': f'Stock insuficiente. Disponible: {stock}.'
                    })
        return data

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        validated_data['registrado_por'] = self.context['request'].user

        self._persist_empleado(validated_data)

        with transaction.atomic():
            # Lock de materiales para validación TOCTOU
            for item_data in items_data:
                mat = Material.objects.select_for_update().get(
                    pk=item_data['material'].pk)
                if mat.stock_actual < item_data['cantidad']:
                    raise serializers.ValidationError({
                        'items': (
                            f'Stock insuficiente para {mat.code}. '
                            f'Disponible: {mat.stock_actual}.'
                        )
                    })
            if not items_data and validated_data.get('material'):
                mat = Material.objects.select_for_update().get(
                    pk=validated_data['material'].pk)
                cant = validated_data.get('cantidad') or 0
                if cant and mat.stock_actual < cant:
                    raise serializers.ValidationError({
                        'cantidad': f'Stock insuficiente. Disponible: {mat.stock_actual}.'
                    })

            vale = super().create(validated_data)

            for item_data in items_data:
                ValeItem.objects.create(vale=vale, **item_data)

        return vale

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)
        self._persist_empleado(validated_data)

        with transaction.atomic():
            # select_for_update del vale para serializar ediciones concurrentes
            instance = Vale.objects.select_for_update().get(pk=instance.pk)
            if items_data is not None:
                # El delete dispara signals que devuelven stock viejo;
                # los creates descuentan el nuevo. Todo en la misma tx.
                instance.items.all().delete()
                for item_data in items_data:
                    mat = Material.objects.select_for_update().get(
                        pk=item_data['material'].pk)
                    if mat.stock_actual < item_data['cantidad']:
                        raise serializers.ValidationError({
                            'items': (
                                f'Stock insuficiente para {mat.code}. '
                                f'Disponible: {mat.stock_actual}.'
                            )
                        })
                vale = super().update(instance, validated_data)
                for item_data in items_data:
                    ValeItem.objects.create(vale=vale, **item_data)
            else:
                vale = super().update(instance, validated_data)

        return vale
