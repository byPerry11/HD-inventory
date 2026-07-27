"""inventory/views.py"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import OrderingFilter, SearchFilter
from django.utils import timezone
from datetime import timedelta

from .models import Entrada, Salida, Area, Linea, TURNO_CHOICES, Vale, Empleado
from .serializers import (
    EntradaSerializer, SalidaSerializer, AreaSerializer, 
    ValeSerializer, EmpleadoSerializer, LineaSerializer
)
from .filters import SalidaFilter, EntradaFilter
from apps.accounts.permissions import IsSupervisorOrAboveOrReadOnly


class AreaViewSet(viewsets.ModelViewSet):
    """
    Gestión de catálogo de Área.
    Solo managers/supervisores pueden crear/editar/eliminar.
    Cualquier autenticado puede listar.
    """
    queryset = Area.objects.all().order_by('linea__nombre', 'nombre')
    serializer_class = AreaSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['linea']

    def check_permissions(self, request):
        super().check_permissions(request)
        if request.method not in ['GET', 'HEAD', 'OPTIONS'] and request.user.role not in ['manager', 'supervisor']:
            self.permission_denied(request, message="Solo supervisores o managers pueden modificar áreas.")


class EmpleadoViewSet(viewsets.ModelViewSet):
    """
    Gestión de catálogo de Empleados para auto-completado.
    """
    queryset = Empleado.objects.all().order_by('numero')
    serializer_class = EmpleadoSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['numero']


class LineaViewSet(viewsets.ModelViewSet):
    """
    Gestión de catálogo de Líneas.
    Solo managers/supervisores pueden crear/editar/eliminar.
    """
    queryset = Linea.objects.all().order_by('nombre')
    serializer_class = LineaSerializer
    permission_classes = [IsAuthenticated]

    def check_permissions(self, request):
        super().check_permissions(request)
        if request.method not in ['GET', 'HEAD', 'OPTIONS'] and request.user.role not in ['manager', 'supervisor']:
            self.permission_denied(request, message="Solo supervisores o managers pueden modificar líneas.")


class EntradaViewSet(viewsets.ModelViewSet):
    """
    Registro de entradas de material al almacén.
    Todos los usuarios autenticados pueden crear entradas.
    Solo managers/supervisors pueden eliminar.
    """
    queryset = Entrada.objects.select_related('material', 'registrado_por').order_by('-fecha')
    serializer_class = EntradaSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_class = EntradaFilter
    ordering_fields = ['fecha', 'cantidad']

    def destroy(self, request, *args, **kwargs):
        if request.user.role not in ('manager', 'supervisor'):
            return Response(
                {'detail': 'Solo managers o supervisores pueden eliminar registros.'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().destroy(request, *args, **kwargs)


class SalidaViewSet(viewsets.ModelViewSet):
    """
    Registro de salidas de material del almacén.
    Todos los usuarios autenticados pueden registrar salidas.
    """
    queryset = Salida.objects.select_related('material', 'registrado_por', 'linea', 'area').order_by('-fecha')
    serializer_class = SalidaSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_class = SalidaFilter
    ordering_fields = ['fecha', 'cantidad', 'linea']

    def destroy(self, request, *args, **kwargs):
        if request.user.role not in ('manager', 'supervisor'):
            return Response(
                {'detail': 'Solo managers o supervisores pueden eliminar registros.'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=['post'], url_path='bulk')
    def bulk(self, request):
        """Registra múltiples salidas apuntando al mismo destino."""
        items = request.data.get('items', [])
        linea_id = request.data.get('linea')
        area_id = request.data.get('area')
        turno = request.data.get('turno')
        recibio = request.data.get('recibio')

        if not items or not linea_id or not turno or not recibio:
            return Response(
                {'detail': 'Faltan datos obligatorios (items, linea, turno, recibio).'},
                status=status.HTTP_400_BAD_REQUEST
            )

        from django.db import transaction
        created_salidas = []
        try:
            with transaction.atomic():
                for item in items:
                    data = {
                        'material': item.get('material'),
                        'cantidad': item.get('cantidad'),
                        'linea': linea_id,
                        'area': area_id,
                        'turno': turno,
                        'recibio': recibio,
                        'observaciones': item.get('observaciones', '')
                    }
                    serializer = self.get_serializer(data=data)
                    serializer.is_valid(raise_exception=True)
                    created_salidas.append(serializer.save())
            
            return Response({'detail': f'{len(created_salidas)} salidas registradas.'}, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'], url_path='choices')
    def choices(self, request):
        """Retorna las opciones dinámicas de línea, área y turno."""
        lineas = Linea.objects.all().order_by('nombre')
        areas = Area.objects.all().order_by('linea__nombre', 'nombre')
        
        return Response({
            'lineas': [{'value': l.id, 'label': l.nombre} for l in lineas],
            'areas': [{'value': a.id, 'label': a.nombre, 'linea': a.linea_id} for a in areas],
            'turnos': [{'value': v, 'label': l} for v, l in TURNO_CHOICES],
        })


class ValeViewSet(viewsets.ModelViewSet):
    """
    Gestión de Vales (comprobantes de salida basados en recibo).
    Lectura: cualquier autenticado.
    Escritura/Borrado: solo supervisores y managers.
    """
    queryset = Vale.objects.select_related('material', 'registrado_por', 'linea', 'area').order_by('-fecha')
    serializer_class = ValeSerializer
    permission_classes = [IsAuthenticated, IsSupervisorOrAboveOrReadOnly]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['material', 'registrado_por', 'recibo_no', 'linea', 'area']
    search_fields = ['recibo_no', 'empleado_no', 'empleado_nombre', 'material__code', 'material__name']
    ordering_fields = ['fecha', 'recibo_no']

    def destroy(self, request, *args, **kwargs):
        if request.user.role not in ('manager', 'supervisor'):
            return Response({'detail': 'Solo supervisores o managers pueden eliminar vales.'}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)

