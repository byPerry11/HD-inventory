"""materials/filters.py"""
import django_filters
from django.db import models
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
        """Filtra materiales por estado calculado, a nivel DB (sin cargar tabla)."""
        from django.db.models import Case, When, Value, CharField
        value = (value or '').lower()
        if value not in ('ok', 'ordenar', 'urge'):
            return queryset.none()
        annotated = queryset.annotate(
            _estado=Case(
                When(stock_actual__lte=models.F('stock_critico'), then=Value('urge')),
                When(stock_actual__lte=models.F('stock_minimo'), then=Value('ordenar')),
                default=Value('ok'),
                output_field=CharField(),
            )
        )
        return annotated.filter(_estado=value)
