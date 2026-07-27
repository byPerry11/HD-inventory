import django_filters
from .models import Salida, Entrada


class SalidaFilter(django_filters.FilterSet):
    fecha_desde = django_filters.DateTimeFilter(field_name='fecha', lookup_expr='gte')
    fecha_hasta = django_filters.DateTimeFilter(field_name='fecha', lookup_expr='lte')
    codigo = django_filters.CharFilter(field_name='material__code', lookup_expr='icontains')
    material_nombre = django_filters.CharFilter(field_name='material__name', lookup_expr='icontains')

    class Meta:
        model = Salida
        fields = ['fecha_desde', 'fecha_hasta', 'codigo', 'material', 'linea', 'area', 'turno', 'registrado_por']


class EntradaFilter(django_filters.FilterSet):
    fecha_desde = django_filters.DateTimeFilter(field_name='fecha', lookup_expr='gte')
    fecha_hasta = django_filters.DateTimeFilter(field_name='fecha', lookup_expr='lte')
    codigo = django_filters.CharFilter(field_name='material__code', lookup_expr='icontains')
    material_nombre = django_filters.CharFilter(field_name='material__name', lookup_expr='icontains')

    class Meta:
        model = Entrada
        fields = ['fecha_desde', 'fecha_hasta', 'codigo', 'material', 'registrado_por']
