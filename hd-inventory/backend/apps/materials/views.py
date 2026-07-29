"""materials/views.py"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from apps.accounts.permissions import IsManagerOrReadOnly, IsSupervisorOrAboveOrReadOnly, IsCapturistaOrAboveOrReadOnly
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
    permission_classes = [IsCapturistaOrAboveOrReadOnly]
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
        from django.db.models import F
        
        # Filtrar materiales directamente en la base de datos
        # Estado 'urge': stock_actual <= stock_critico
        # Estado 'ordenar': stock_actual <= stock_minimo Y stock_actual > stock_critico
        qs = self.get_queryset()
        urge_qs = qs.filter(stock_actual__lte=F('stock_critico'))
        ordenar_qs = qs.filter(stock_actual__lte=F('stock_minimo')).exclude(stock_actual__lte=F('stock_critico'))
        
        urge_serializer = MaterialListSerializer(urge_qs, many=True)
        ordenar_serializer = MaterialListSerializer(ordenar_qs, many=True)
        
        return Response({
            'count': len(urge_serializer.data) + len(ordenar_serializer.data),
            'urge': urge_serializer.data,
            'ordenar': ordenar_serializer.data,
        })

    def perform_destroy(self, instance):
        """Soft delete — solo desactiva el material."""
        instance.activo = False
        instance.save(update_fields=['activo'])

    @action(detail=False, methods=['get'], url_path='reports/custom-inventory')
    def reports_custom_inventory(self, request):
        """Genera y descarga un reporte de inventario dinámico por categorías.
        
        Espera un parámetro `categories` con IDs separados por comas.
        """
        role = getattr(request.user, 'role', None)
        if role not in ('manager', 'supervisor'):
            return Response({'detail': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)

        categories_param = request.query_params.get('categories', '')
        
        if not categories_param:
            return Response({'detail': 'Debe seleccionar al menos una categoría.'}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            category_ids = [int(cid) for cid in categories_param.split(',') if cid.strip()]
        except ValueError:
            return Response({'detail': 'IDs de categorías inválidos.'}, status=status.HTTP_400_BAD_REQUEST)

        # Filtrar materiales por categorías seleccionadas
        materiales = self.get_queryset().filter(category_id__in=category_ids)

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

        # Generar nombre del archivo dinámico
        month = date.today().month
        month_names = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE']
        month_name_text = month_names[month-1]
        
        if len(category_ids) == 1:
            categoria = Category.objects.filter(id=category_ids[0]).first()
            cat_name = categoria.name.upper() if categoria else 'CATEGORIA'
            filename = f"Inventario_{cat_name}_{month_name_text}.xlsx".replace(" ", "_")
        else:
            filename = f"Inventario_Multiple_{month_name_text}.xlsx"

        resp = HttpResponse(content, content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        resp['Content-Disposition'] = f'attachment; filename="{filename}"'
        return resp
