"""inventory/views.py"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import OrderingFilter
from django.utils import timezone
from datetime import timedelta

from .models import Entrada, Salida, Seccion, Area, TURNO_CHOICES, Vale, Empleado
from .serializers import (
    EntradaSerializer, SalidaSerializer, SeccionSerializer, 
    ValeSerializer, EmpleadoSerializer, AreaSerializer
)


class SeccionViewSet(viewsets.ModelViewSet):
    """
    Gestión de catálogo de Sección.
    Solo managers/supervisores pueden crear/editar/eliminar.
    Cualquier autenticado puede listar.
    """
    queryset = Seccion.objects.all().order_by('nombre')
    serializer_class = SeccionSerializer
    permission_classes = [IsAuthenticated]

    def check_permissions(self, request):
        super().check_permissions(request)
        if request.method not in ['GET', 'HEAD', 'OPTIONS'] and request.user.role not in ['manager', 'supervisor']:
            self.permission_denied(request, message="Solo supervisores o managers pueden modificar secciones.")


class EmpleadoViewSet(viewsets.ModelViewSet):
    """
    Gestión de catálogo de Empleados para auto-completado.
    """
    queryset = Empleado.objects.all().order_by('numero')
    serializer_class = EmpleadoSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['numero']


class AreaViewSet(viewsets.ModelViewSet):
    """
    Gestión de catálogo de Áreas.
    Solo managers/supervisores pueden crear/editar/eliminar.
    """
    queryset = Area.objects.all().order_by('nombre')
    serializer_class = AreaSerializer
    permission_classes = [IsAuthenticated]

    def check_permissions(self, request):
        super().check_permissions(request)
        if request.method not in ['GET', 'HEAD', 'OPTIONS'] and request.user.role not in ['manager', 'supervisor']:
            self.permission_denied(request, message="Solo supervisores o managers pueden modificar áreas.")
class EntradaViewSet(viewsets.ModelViewSet):
    """
    Registro de entradas de material al almacén.
    Todos los usuarios autenticados pueden crear entradas.
    Solo managers pueden eliminar.
    """
    queryset = Entrada.objects.select_related('material', 'registrado_por').order_by('-fecha')
    serializer_class = EntradaSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['material', 'registrado_por']
    ordering_fields = ['fecha', 'cantidad']

    def destroy(self, request, *args, **kwargs):
        if request.user.role != 'manager':
            return Response(
                {'detail': 'Solo los managers pueden eliminar registros.'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().destroy(request, *args, **kwargs)


class SalidaViewSet(viewsets.ModelViewSet):
    """
    Registro de salidas de material del almacén.
    Todos los usuarios autenticados pueden registrar salidas.
    """
    queryset = Salida.objects.select_related('material', 'registrado_por').order_by('-fecha')
    serializer_class = SalidaSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['material', 'area', 'turno', 'registrado_por']
    ordering_fields = ['fecha', 'cantidad', 'area']

    def destroy(self, request, *args, **kwargs):
        if request.user.role != 'manager':
            return Response(
                {'detail': 'Solo los managers pueden eliminar registros.'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=['post'], url_path='bulk')
    def bulk(self, request):
        """Registra múltiples salidas apuntando al mismo destino."""
        items = request.data.get('items', [])
        area_id = request.data.get('area')
        seccion_id = request.data.get('seccion')
        turno = request.data.get('turno')
        recibio = request.data.get('recibio')

        if not items or not area_id or not turno or not recibio:
            return Response(
                {'detail': 'Faltan datos obligatorios (items, area, turno, recibio).'},
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
                        'area': area_id,
                        'seccion': seccion_id,
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
        """Retorna las opciones dinámicas de área, sección y turno."""
        areas = Area.objects.all().order_by('nombre')
        secciones = Seccion.objects.all().order_by('nombre')
        
        return Response({
            'areas': [{'value': a.id, 'label': a.nombre} for a in areas],
            'secciones': [{'value': s.id, 'label': s.nombre} for s in secciones],
            'turnos': [{'value': v, 'label': l} for v, l in TURNO_CHOICES],
        })


class ValeViewSet(viewsets.ModelViewSet):
    """
    Gestión de Vales (comprobantes de salida basados en recibo).
    """
    queryset = Vale.objects.select_related('material', 'registrado_por').order_by('-fecha')
    serializer_class = ValeSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['material', 'registrado_por', 'recibo_no', 'area', 'seccion']
    ordering_fields = ['fecha', 'recibo_no']

    def destroy(self, request, *args, **kwargs):
        if request.user.role != 'manager':
            return Response({'detail': 'Solo los managers pueden eliminar registros.'}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)
