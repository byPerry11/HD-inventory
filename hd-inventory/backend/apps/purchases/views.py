"""purchases/views.py — ViewSet de Órdenes de Compra y Proveedores."""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from apps.accounts.permissions import IsSupervisorOrAbove, IsSupervisorOrAboveOrReadOnly
from .models import OrdenCompra, Proveedor
from .serializers import OrdenCompraSerializer, OrdenCompraListSerializer, ProveedorSerializer


class ProveedorViewSet(viewsets.ModelViewSet):
    """ViewSet para gestionar proveedores."""
    permission_classes = [IsSupervisorOrAbove]
    queryset = Proveedor.objects.all()
    serializer_class = ProveedorSerializer
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['nombre', 'contacto', 'email']
    ordering_fields = ['nombre', 'creado_en']
    ordering = ['nombre']


class OrdenCompraViewSet(viewsets.ModelViewSet):
    """
    CRUD completo de Órdenes de Compra.
    Acceso: Supervisor y Manager.
    """
    permission_classes = [IsSupervisorOrAboveOrReadOnly]
    queryset           = OrdenCompra.objects.select_related('material', 'creado_por', 'actualizado_por', 'proveedor_ref')
    filter_backends    = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields   = ['status', 'moneda', 'vendedor', 'proveedor_ref', 'es_remision']
    search_fields      = ['no_parte', 'descripcion', 'po_number', 'vendedor', 'no_pr']
    ordering_fields    = ['fecha_emision', 'status', 'costo_unitario', 'actualizado_en']
    ordering           = ['-fecha_emision']

    def get_permissions(self):
        if self.action == 'destroy':
            return [IsAuthenticated()]
        return super().get_permissions()

    def get_serializer_class(self):
        if self.action == 'list':
            return OrdenCompraListSerializer
        return OrdenCompraSerializer

    def perform_create(self, serializer):
        serializer.save(creado_por=self.request.user)

    def perform_update(self, serializer):
        serializer.save(actualizado_por=self.request.user)

    def destroy(self, request, *args, **kwargs):
        """
        Eliminación lógica: cancela la orden si está en estado cancelable.
        Cualquier usuario autenticado puede ejecutar esta acción.
        """
        instance = self.get_object()

        if instance.status not in OrdenCompra.ESTADOS_CANCELABLE:
            return Response(
                {"error": f"No se puede eliminar una orden en estado {instance.get_status_display()}."},
                status=status.HTTP_400_BAD_REQUEST
            )

        instance.status = 'cancelado'
        instance.actualizado_por = request.user
        instance.save()

        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    def update(self, request, *args, **kwargs):
        """
        Sobreescribimos update para detectar si se creó un material inactivo
        y devolver una advertencia en la respuesta.
        """
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        # Refrescar la instancia para leer el atributo transient
        instance.refresh_from_db()
        response_data = serializer.data

        # Advertencia si se creó un material inactivo automáticamente
        if getattr(instance, '_material_creado_inactivo', False):
            response_data = dict(serializer.data)
            response_data['warnings'] = [
                {
                    'code':    'material_creado_inactivo',
                    'message': (
                        f'El material "{instance.no_parte}" no existía en el inventario. '
                        f'Se creó automáticamente en estado INACTIVO. '
                        f'Ve a Materiales para completar su información y activarlo.'
                    ),
                }
            ]

        return Response(response_data)

    @action(detail=False, methods=['patch'], url_path='bulk-update')
    def bulk_update(self, request):
        """
        Edición masiva de campos.
        Body: [{ "id": 1, "campo": "valor", ... }, ...]
        """
        items   = request.data
        errores = []
        actualizados = 0

        for item in items:
            oc_id = item.get('id')
            try:
                instancia = OrdenCompra.objects.get(pk=oc_id)
                serializer = OrdenCompraSerializer(
                    instancia, data=item, partial=True,
                    context={'request': request}
                )
                if serializer.is_valid():
                    serializer.save(actualizado_por=request.user)
                    actualizados += 1
                else:
                    errores.append({'id': oc_id, 'errors': serializer.errors})
            except OrdenCompra.DoesNotExist:
                errores.append({'id': oc_id, 'errors': 'No encontrado'})

        return Response({
            'actualizados': actualizados,
            'errores':      errores,
        }, status=status.HTTP_200_OK if not errores else status.HTTP_207_MULTI_STATUS)

    @action(detail=True, methods=['post'], url_path='advance-step')
    def advance_step(self, request, pk=None):
        """
        Avanza la orden al siguiente paso lógico.
        Si el siguiente paso es 'po_aprobada', requiere 'po_number'.
        """
        instance = self.get_object()
        
        if instance.status in OrdenCompra.ESTADOS_CERRADO:
            return Response(
                {"error": "La orden ya está en un estado final y no puede avanzar."},
                status=status.HTTP_400_BAD_REQUEST
            )

        next_status = OrdenCompra.get_siguiente_status(instance.status, instance.es_remision)
        
        if not next_status:
            return Response(
                {"error": "No hay un siguiente paso definido para esta orden."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validación especial para PO Aprobada
        data = {'status': next_status}
        if next_status == 'po_aprobada':
            po_number = request.data.get('po_number')
            if not po_number:
                return Response(
                    {"error": "El No. PO es requerido para aprobar la orden."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            data['po_number'] = po_number
            
        # Validación especial para Recibido
        if next_status in ('recibido', 'rem_recibido'):
            recibido_por = request.data.get('recibido_por')
            if not recibido_por:
                return Response(
                    {"error": "El nombre de quien recibe es requerido para completar este paso."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            data['recibido_por'] = recibido_por

        serializer = self.get_serializer(
            instance, data=data, partial=True,
            context={**self.get_serializer_context(), 'is_advance_step': True}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(actualizado_por=request.user)

        # Refrescar para advertencias de stock
        instance.refresh_from_db()
        resp_data = serializer.data
        if getattr(instance, '_material_creado_inactivo', False):
            resp_data['warnings'] = [{
                'code': 'material_creado_inactivo',
                'message': f'Material "{instance.no_parte}" creado como inactivo.'
            }]

        return Response(resp_data)

    @action(detail=True, methods=['post'], url_path='cancel')
    def cancel_order(self, request, pk=None):
        """Cancela la orden si está en un estado permitido."""
        instance = self.get_object()
        
        if instance.status not in OrdenCompra.ESTADOS_CANCELABLE:
            return Response(
                {"error": f"No se puede cancelar una orden en estado {instance.get_status_display()}."},
                status=status.HTTP_400_BAD_REQUEST
            )

        instance.status = 'cancelado'
        instance.actualizado_por = request.user
        instance.save()
        
        serializer = self.get_serializer(instance)
        return Response(serializer.data)
