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

    # ─── Herramienta de Importación CSV ───────────────────────
    
    def get_urls(self):
        from django.urls import path
        urls = super().get_urls()
        custom_urls = [
            path('import-csv/', self.admin_site.admin_view(self.import_csv_view), name='materials_material_import_csv'),
        ]
        return custom_urls + urls

    def import_csv_view(self, request):
        import json
        from django.shortcuts import render, redirect
        from django.contrib import messages
        from .forms import MaterialCSVImportForm
        from .import_utils import parse_csv_file, process_import

        context = self.admin_site.each_context(request)
        context['opts'] = self.model._meta
        
        if request.method == "POST":
            # Paso 2: Confirmación
            if 'confirm_import' in request.POST:
                data_json = request.POST.get('data_json')
                if data_json:
                    data = json.loads(data_json)
                    try:
                        stats = process_import(data)
                        messages.success(
                            request, 
                            f"Éxito: {stats['created']} creados, {stats['updated']} actualizados."
                        )
                        return redirect("admin:materials_material_changelist")
                    except Exception as e:
                        messages.error(request, f"Error durante la importación: {str(e)}")
                        return redirect(".")

            # Paso 1: Carga y Previsualización
            form = MaterialCSVImportForm(request.POST, request.FILES)
            if form.is_valid():
                csv_file = request.FILES['csv_file']
                try:
                    data = parse_csv_file(csv_file.read())
                    if not data:
                        messages.warning(request, "El archivo CSV parece estar vacío o no tiene el formato correcto.")
                    else:
                        context['preview_data'] = data
                        context['data_json'] = json.dumps(data)
                except Exception as e:
                    messages.error(request, f"Error al leer el archivo: {str(e)}")
            else:
                for error in form.errors.values():
                    messages.error(request, error)

        return render(request, "admin/materials/material/import_csv.html", context)
