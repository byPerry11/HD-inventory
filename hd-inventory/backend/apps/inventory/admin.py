"""inventory/admin.py"""
from django.contrib import admin
from .models import Entrada, Salida, Area, Linea, Vale, ValeItem, Empleado


@admin.register(Entrada)
class EntradaAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'material', 'cantidad', 'proveedor',
        'numero_orden', 'registrado_por', 'fecha',
    )
    list_filter = ('fecha', 'material__category')
    search_fields = ('material__code', 'material__name', 'proveedor', 'numero_orden')
    ordering = ('-fecha',)
    readonly_fields = ('fecha', 'registrado_por')
    date_hierarchy = 'fecha'


@admin.register(Salida)
class SalidaAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'material', 'cantidad',
        'linea', 'area', 'turno',
        'recibio', 'registrado_por', 'fecha',
    )
    list_filter = ('linea', 'turno', 'fecha', 'material__category')
    search_fields = (
        'material__code', 'material__name',
        'recibio', 'linea__nombre', 'area__nombre',
    )
    ordering = ('-fecha',)
    readonly_fields = ('fecha', 'registrado_por')
    date_hierarchy = 'fecha'


@admin.register(Linea)
class LineaAdmin(admin.ModelAdmin):
    list_display = ('id', 'nombre')
    search_fields = ('nombre',)


@admin.register(Area)
class AreaAdmin(admin.ModelAdmin):
    list_display = ('id', 'nombre', 'linea')
    list_filter = ('linea',)
    search_fields = ('nombre', 'linea__nombre')


@admin.register(Vale)
class ValeAdmin(admin.ModelAdmin):
    list_display = ('recibo_no', 'empleado_nombre', 'linea', 'area', 'material', 'cantidad', 'fecha')
    list_filter = ('linea', 'fecha')
    search_fields = ('empleado_no', 'empleado_nombre', 'recibo_no', 'material__code')
    readonly_fields = ('fecha', 'registrado_por', 'recibo_no')


@admin.register(ValeItem)
class ValeItemAdmin(admin.ModelAdmin):
    list_display = ('id', 'vale', 'material', 'cantidad', 'costo')
    search_fields = ('material__code', 'material__name')
    list_filter = ('vale__fecha',)


@admin.register(Empleado)
class EmpleadoAdmin(admin.ModelAdmin):
    list_display = ('numero', 'nombre')
    search_fields = ('numero', 'nombre')
