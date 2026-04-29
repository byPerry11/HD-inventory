"""purchases/views.py — ViewSet de Órdenes de Compra y Proveedores."""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from apps.accounts.permissions import IsSupervisorOrAbove
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
    permission_classes = [IsSupervisorOrAbove]
    queryset           = OrdenCompra.objects.select_related('material', 'creado_por', 'actualizado_por', 'proveedor_ref')
    filter_backends    = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields   = ['status', 'moneda', 'vendedor', 'proveedor_ref']
    search_fields      = ['no_parte', 'descripcion', 'po_number', 'vendedor']
    ordering_fields    = ['fecha_emision', 'status', 'costo_unitario', 'actualizado_en']
    ordering           = ['-fecha_emision']

    def get_serializer_class(self):
        if self.action == 'list':
            return OrdenCompraListSerializer
        return OrdenCompraSerializer

    def perform_create(self, serializer):
        serializer.save(creado_por=self.request.user)

    def perform_update(self, serializer):
        serializer.save(actualizado_por=self.request.user)

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
