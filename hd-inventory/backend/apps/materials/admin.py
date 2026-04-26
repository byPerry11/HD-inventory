"""materials/admin.py"""
from django.contrib import admin
from .models import Material, Category


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'descripcion')
    search_fields = ('name',)


@admin.register(Material)
class MaterialAdmin(admin.ModelAdmin):
    list_display = (
        'code', 'name', 'category', 'unit',
        'stock_actual', 'stock_minimo', 'stock_critico',
        'estado_label', 'activo',
    )
    list_filter = ('category', 'unit', 'activo')
    search_fields = ('code', 'name', 'descripcion')
    ordering = ('name',)
    readonly_fields = ('creado_en', 'actualizado_en', 'estado_label')

    fieldsets = (
        ('Identificación', {
            'fields': ('code', 'name', 'category', 'unit', 'descripcion'),
        }),
        ('Stock', {
            'fields': (
                'stock_actual', 'stock_minimo', 'stock_critico', 'estado_label',
            ),
        }),
        ('Control', {
            'fields': ('activo', 'creado_en', 'actualizado_en'),
            'classes': ('collapse',),
        }),
    )
