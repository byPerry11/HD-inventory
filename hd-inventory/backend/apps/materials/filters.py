"""materials/filters.py"""
import django_filters
from .models import Material


class MaterialFilter(django_filters.FilterSet):
    """Filtros para el listado de materiales."""
    name = django_filters.CharFilter(lookup_expr='icontains', label='Nombre contiene')
    code = django_filters.CharFilter(lookup_expr='icontains', label='Código contiene')
    category = django_filters.NumberFilter(field_name='category__id', label='Categoría')
    estado = django_filters.CharFilter(method='filter_estado', label='Estado (ok/ordenar/urge)')

    class Meta:
        model = Material
        fields = ['name', 'code', 'category', 'activo', 'unit']

    def filter_estado(self, queryset, name, value):
        """Filtra materiales por su estado calculado."""
        ids = [
            m.id for m in queryset
            if m.estado == value.lower()
        ]
        return queryset.filter(id__in=ids)
