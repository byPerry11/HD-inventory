"""inventory/views.py"""
from django.db import transaction
from django.db.models import F
import django_filters
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Entrada, Salida, Vale, ValeItem, Linea, Area, Empleado
from .serializers import (
    EntradaSerializer, SalidaSerializer, ValeSerializer,
    LineaSerializer, AreaSerializer, EmpleadoSerializer,
)
from apps.accounts.permissions import IsSupervisorOrAboveOrReadOnly, IsCapturistaOrAboveOrReadOnly


class EmpleadoViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Empleado.objects.all().order_by('numero')
    serializer_class = EmpleadoSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['numero']
    search_fields = ['numero', 'nombre']


class LineaViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Linea.objects.all()
    serializer_class = LineaSerializer
    permission_classes = [IsAuthenticated]


class AreaViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Area.objects.select_related('linea').all()
    serializer_class = AreaSerializer
    permission_classes = [IsAuthenticated]


class MovimientoFilter(django_filters.FilterSet):
    """Rango de fechas para el Historial (los datetime-local llegan como
    'YYYY-MM-DDTHH:MM' y DateTimeFilter los interpreta bien)."""
    fecha_desde = django_filters.DateTimeFilter(field_name='fecha', lookup_expr='gte')
    fecha_hasta = django_filters.DateTimeFilter(field_name='fecha', lookup_expr='lte')


class EntradaFilter(MovimientoFilter):
    class Meta:
        model = Entrada
        fields = ['material', 'registrado_por', 'proveedor']


class SalidaFilter(MovimientoFilter):
    class Meta:
        model = Salida
        fields = ['material', 'linea', 'area', 'turno', 'registrado_por']


class EntradaViewSet(viewsets.ModelViewSet):
    queryset = Entrada.objects.select_related('material', 'registrado_por').order_by('-fecha')
    serializer_class = EntradaSerializer
    permission_classes = [IsAuthenticated, IsCapturistaOrAboveOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = EntradaFilter
    search_fields = ['material__code', 'material__name', 'proveedor', 'numero_orden']
    ordering_fields = ['fecha', 'material__code']
    ordering = ['-fecha']

    def perform_create(self, serializer):
        serializer.save(registrado_por=self.request.user)


class SalidaViewSet(viewsets.ModelViewSet):
    queryset = Salida.objects.select_related(
        'material', 'registrado_por', 'linea', 'area'
    ).order_by('-fecha')
    serializer_class = SalidaSerializer
    permission_classes = [IsAuthenticated, IsCapturistaOrAboveOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = SalidaFilter
    search_fields = ['material__code', 'material__name', 'recibio', 'empleado_no']
    ordering_fields = ['fecha', 'material__code']
    ordering = ['-fecha']

    def perform_create(self, serializer):
        from rest_framework.exceptions import ValidationError
        from apps.materials.models import Material
        with transaction.atomic():
            material = serializer.validated_data.get('material')
            cantidad = serializer.validated_data.get('cantidad', 0) or 0
            if material and cantidad:
                locked = Material.objects.select_for_update().get(pk=material.pk)
                if locked.stock_actual < cantidad:
                    raise ValidationError({
                        'cantidad': (
                            f'Stock insuficiente. Disponible: {locked.stock_actual}.'
                        )
                    })
            serializer.save(registrado_por=self.request.user)

    @action(detail=False, methods=['get'])
    def choices(self, request):
        lineas = Linea.objects.values_list('id', 'nombre')
        areas = Area.objects.select_related('linea').values('id', 'nombre', 'linea')
        turnos = Salida._meta.get_field('turno').choices
        return Response({
            'lineas': [{'value': l[0], 'label': l[1]} for l in lineas],
            'areas': [{'value': a['id'], 'label': a['nombre'], 'linea': a['linea']} for a in areas],
            'turnos': [{'value': t[0], 'label': t[1]} for t in turnos],
        })

    @action(detail=False, methods=['post'])
    def bulk(self, request):
        """Crear múltiples salidas en una sola request (desde el carrito de despacho).

        Todo-o-nada: si un item falla (stock, validación), se revierte todo
        para no dejar stock parcial. Límite 100 items por request.
        """
        from rest_framework.exceptions import ValidationError
        from apps.materials.models import Material
        items = request.data.get('items', [])
        if not items:
            return Response({'detail': 'No hay items en la solicitud.'}, status=status.HTTP_400_BAD_REQUEST)
        if len(items) > 100:
            return Response(
                {'detail': 'Máximo 100 items por solicitud bulk.'},
                status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                registros = []
                # Lock de todos los materiales involucrados (ordenado = anti-deadlock)
                material_ids = {i.get('material') for i in items if i.get('material')}
                locked = {
                    m.pk: m for m in Material.objects.select_for_update()
                    .filter(pk__in=material_ids).order_by('pk')
                }
                for item in items:
                    data = {
                        'material': item.get('material'),
                        'cantidad': item.get('cantidad'),
                        'linea': request.data.get('linea'),
                        'area': request.data.get('area'),
                        'turno': request.data.get('turno'),
                        'empleado_no': request.data.get('empleado_no'),
                        'recibio': request.data.get('recibio'),
                        'observaciones': item.get('observaciones', request.data.get('observaciones', '')),
                    }
                    serializer = self.get_serializer(data=data)
                    serializer.is_valid(raise_exception=True)
                    mat = locked.get(data['material'])
                    if mat and (data['cantidad'] or 0) > mat.stock_actual:
                        raise ValidationError({
                            'cantidad': (
                                f'Stock insuficiente para {mat.code}. '
                                f'Disponible: {mat.stock_actual}.'
                            )
                        })
                    self.perform_create(serializer)
                    registros.append(serializer.data)
                    # Descuenta del lock local para validar acumulado del mismo
                    # material dentro del bulk
                    if mat:
                        mat.stock_actual -= (data['cantidad'] or 0)
        except ValidationError as exc:
            return Response({'detail': exc.detail}, status=status.HTTP_400_BAD_REQUEST)

        return Response(registros, status=status.HTTP_201_CREATED)


class ValeViewSet(viewsets.ModelViewSet):
    """
    Gestión de Vales (comprobantes de salida basados en recibo).
    Lectura: cualquier autenticado.
    Escritura/Borrado: solo supervisores y managers.

    DELETE con ?return_stock=true devuelve el material al inventario.
    """
    queryset = Vale.objects.select_related(
        'material', 'registrado_por', 'linea', 'area'
    ).prefetch_related('items__material').order_by('-fecha')
    serializer_class = ValeSerializer
    permission_classes = [IsAuthenticated, IsSupervisorOrAboveOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['material', 'registrado_por', 'recibo_no', 'linea', 'area']
    search_fields = ['recibo_no', 'empleado_no', 'empleado_nombre', 'material__code', 'material__name']
    ordering_fields = ['fecha', 'recibo_no']

    def _reverse_stock(self, vale):
        """Devuelve al stock los materiales de un vale."""
        items = vale.items.all()
        if items.exists():
            for item in items:
                with transaction.atomic():
                    material = item.material
                    material.stock_actual = F('stock_actual') + item.cantidad
                    material.save(update_fields=['stock_actual', 'actualizado_en'])
                    material.refresh_from_db(fields=['stock_actual'])
        elif vale.material:
            with transaction.atomic():
                material = vale.material
                material.stock_actual = F('stock_actual') + vale.cantidad
                material.save(update_fields=['stock_actual', 'actualizado_en'])
                material.refresh_from_db(fields=['stock_actual'])

    def destroy(self, request, *args, **kwargs):
        vale = self.get_object()
        return_stock = request.query_params.get('return_stock', '') == 'true'
        if return_stock:
            self._reverse_stock(vale)
        return super().destroy(request, *args, **kwargs)

    def perform_update(self, serializer):
        """
        Ajusta el stock cuando cambia la cantidad de un vale legacy
        (material único, sin items).
        """
        instance = self.get_object()
        old_cantidad = instance.cantidad or 0
        old_material = instance.material

        vale = serializer.save()

        # Solo ajuste automático para vales legacy (sin items)
        if old_material and not vale.items.exists():
            new_cantidad = vale.cantidad or 0
            diff = old_cantidad - new_cantidad
            if diff != 0:
                with transaction.atomic():
                    material = vale.material
                    material.stock_actual = F('stock_actual') + diff
                    material.save(update_fields=['stock_actual', 'actualizado_en'])
                    material.refresh_from_db(fields=['stock_actual'])
        return vale
