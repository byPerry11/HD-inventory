"""purchases/admin.py"""
from django.contrib import admin
from .models import OrdenCompra


@admin.register(OrdenCompra)
class OrdenCompraAdmin(admin.ModelAdmin):
    list_display  = ['id', 'fecha_emision', 'no_parte', 'descripcion',
                     'cantidad', 'moneda', 'status', 'po_number', 'vendedor', 'actualizado_en']
    list_filter   = ['status', 'moneda', 'vendedor']
    search_fields = ['no_parte', 'descripcion', 'po_number', 'vendedor']
    readonly_fields = [
        'costo_total', 'tiempo_entrega_dias', 
        'fecha_pr', 'fecha_pr_aprobada', 'fecha_po_aprobada', 'fecha_ordenado', 'fecha_recibido',
        'creado_en', 'actualizado_en'
    ]
    date_hierarchy = 'fecha_emision'
