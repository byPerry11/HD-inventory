"""analytics/urls.py"""
from django.urls import path
from .views import (
    ResumenView,
    ConsumoPorLineaView,
    TopSalidasView,
    AlertasView,
    MovimientosRecientesView,
    SugerenciasCompraView,
)

urlpatterns = [
    path('resumen/', ResumenView.as_view(), name='analytics-resumen'),
    path('consumo-por-linea/', ConsumoPorLineaView.as_view(), name='analytics-consumo-linea'),
    path('top-salidas/', TopSalidasView.as_view(), name='analytics-top-salidas'),
    path('alertas/', AlertasView.as_view(), name='analytics-alertas'),
    path('movimientos-recientes/', MovimientosRecientesView.as_view(), name='analytics-movimientos'),
    path('sugerencias-compra/', SugerenciasCompraView.as_view(), name='analytics-sugerencias-compra'),
]
