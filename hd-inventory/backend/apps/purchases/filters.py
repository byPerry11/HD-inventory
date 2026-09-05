"""purchases/filters.py — Filtros personalizados para Órdenes de Compra."""
import django_filters

from .models import OrdenCompra


class OrdenCompraFilter(django_filters.FilterSet):
    """Filtros de búsqueda para la tabla de órdenes.

    No. PR, No. parte y Proveedor usan búsqueda parcial (icontains);
    Status usa coincidencia exacta.
    """
    no_pr    = django_filters.CharFilter(lookup_expr='icontains')
    no_parte = django_filters.CharFilter(lookup_expr='icontains')
    vendedor = django_filters.CharFilter(lookup_expr='icontains')
    status   = django_filters.CharFilter(field_name='status')

    class Meta:
        model = OrdenCompra
        fields = ['no_pr', 'no_parte', 'vendedor', 'status']
