"""materials/views.py"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from apps.accounts.permissions import IsManagerOrReadOnly, IsSupervisorOrAboveOrReadOnly
from .models import Material, Category
from .serializers import MaterialSerializer, MaterialListSerializer, CategorySerializer
from .filters import MaterialFilter
from django.http import HttpResponse
from .reports import generate_chemical_inventory_excel
import os
from datetime import date


class CategoryViewSet(viewsets.ModelViewSet):
    """CRUD de categorías (ahora supervisores también pueden crear/modificar)."""
    queryset = Category.objects.all().order_by('name')
    serializer_class = CategorySerializer
    permission_classes = [IsSupervisorOrAboveOrReadOnly]


class MaterialViewSet(viewsets.ModelViewSet):
    """
    CRUD de materiales.
    - GET:    cualquier usuario autenticado
    - POST/PUT/PATCH/DELETE: solo managers / supervisors
    """
    queryset = Material.objects.select_related('category').filter(activo=True)
    permission_classes = [IsSupervisorOrAboveOrReadOnly]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = MaterialFilter
    search_fields = ['code', 'name', 'descripcion']
    ordering_fields = ['name', 'code', 'stock_actual', 'estado', 'actualizado_en']
    ordering = ['name']

    def get_serializer_class(self):
        if self.action == 'list':
            return MaterialListSerializer
        return MaterialSerializer

    def get_queryset(self):
        qs = Material.objects.select_related('category')
        # Incluir inactivos solo para managers
        if self.request.user.role == 'manager':
            return qs.all()
        return qs.filter(activo=True)

    @action(detail=False, methods=['get'], url_path='alertas')
    def alertas(self, request):
        """Retorna materiales en estado 'ordenar' o 'urge'."""
        materiales = self.get_queryset()
        alertas = [m for m in materiales if m.estado in ('ordenar', 'urge')]
        serializer = MaterialListSerializer(alertas, many=True)
        return Response({
            'count': len(alertas),
            'urge': [s for s in serializer.data if s['estado'] == 'urge'],
            'ordenar': [s for s in serializer.data if s['estado'] == 'ordenar'],
        })

    def perform_destroy(self, instance):
        """Soft delete — solo desactiva el material."""
        instance.activo = False
        instance.save(update_fields=['activo'])

    @action(detail=False, methods=['get'], url_path='reports/chemical-inventory')
    def reports_chemical_inventory(self, request):
        """Genera y descarga el reporte de Inventario de Químicos.

        Filtra materiales cuya categoría contenga 'quimic' (insensible a mayúsculas).
        """
        # Restrict access to supervisors and managers explicitly
        role = getattr(request.user, 'role', None)
        if role not in ('manager', 'supervisor'):
            return Response({'detail': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)

        materiales = self.get_queryset().filter(category__name__icontains='quimic')

        prepared_by = getattr(request.user, 'get_full_name', None)
        if callable(prepared_by):
            prepared_by = request.user.get_full_name()
        else:
            prepared_by = str(request.user)

        approved_by = request.query_params.get('approved_by', '')
        department = request.query_params.get('department', '')

        try:
            content = generate_chemical_inventory_excel(
                materials_qs=materiales,
                prepared_by=prepared_by,
                approved_by=approved_by,
                department=department,
            )
        except FileNotFoundError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except Exception as exc:
            return Response({'detail': 'Error generando el reporte: ' + str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Determine filename by replacing 'TEMPLATE' in template filename with current month
        tpl_name = os.path.basename(getattr(generate_chemical_inventory_excel, '__template_path__', 'INVENTARIO DE QUIMICO TEMPLATE.xlsx'))
        month = date.today().month
        month_names = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE']
        month_name_text = month_names[month-1]
        filename = tpl_name.replace('TEMPLATE', month_name_text)

        resp = HttpResponse(content, content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        resp['Content-Disposition'] = f'attachment; filename="{filename}"'
        return resp
