"""inventory/views.py"""
from django.db import transaction
from django.db.models import F
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


class EntradaViewSet(viewsets.ModelViewSet):
    queryset = Entrada.objects.select_related('material', 'registrado_por').order_by('-fecha')
    serializer_class = EntradaSerializer
    permission_classes = [IsAuthenticated, IsCapturistaOrAboveOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['material', 'registrado_por', 'proveedor']
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
    filterset_fields = ['material', 'linea', 'area', 'turno', 'registrado_por']
    search_fields = ['material__code', 'material__name', 'recibio', 'empleado_no']
    ordering_fields = ['fecha', 'material__code']
    ordering = ['-fecha']

    def perform_create(self, serializer):
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
