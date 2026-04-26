"""inventory/admin.py"""
from django.contrib import admin
from .models import Entrada, Salida, Seccion, Area, Vale, Empleado


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
        'area', 'seccion', 'turno',
        'recibio', 'registrado_por', 'fecha',
    )
    list_filter = ('area', 'turno', 'fecha', 'material__category')
    search_fields = (
        'material__code', 'material__name',
        'recibio', 'area__nombre', 'seccion__nombre',
    )
    ordering = ('-fecha',)
    readonly_fields = ('fecha', 'registrado_por')
    date_hierarchy = 'fecha'


@admin.register(Seccion)
class SeccionAdmin(admin.ModelAdmin):
    list_display = ('id', 'nombre')
    search_fields = ('nombre',)


@admin.register(Area)
class AreaAdmin(admin.ModelAdmin):
    list_display = ('id', 'nombre')
    search_fields = ('nombre',)


@admin.register(Vale)
class ValeAdmin(admin.ModelAdmin):
    list_display = ('recibo_no', 'empleado_nombre', 'area', 'seccion', 'material', 'cantidad', 'fecha')
    list_filter = ('area', 'fecha')
    search_fields = ('empleado_no', 'empleado_nombre', 'recibo_no', 'material__code')
    readonly_fields = ('fecha', 'registrado_por', 'recibo_no')


@admin.register(Empleado)
class EmpleadoAdmin(admin.ModelAdmin):
    list_display = ('numero', 'nombre')
    search_fields = ('numero', 'nombre')
