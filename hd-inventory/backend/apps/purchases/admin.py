"""purchases/admin.py"""
from django.contrib import admin, messages
from django.shortcuts import render
from django.urls import path
from django.http import HttpResponseRedirect
from django.urls import reverse
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
    actions = ['forzar_cambio_estado']

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path(
                'cambiar-estado/',
                self.admin_site.admin_view(self.cambiar_estado_view),
                name='purchases_ordencompra_cambiar_estado',
            ),
        ]
        return custom_urls + urls

    def forzar_cambio_estado(self, request, queryset):
        """Acción de admin: muestra un formulario para forzar el status de las órdenes seleccionadas."""
        selected = request.POST.getlist(admin.helpers.ACTION_CHECKBOX_NAME)
        if not selected:
            self.message_user(request, 'No seleccionaste ninguna orden.', level=messages.ERROR)
            return None
        return HttpResponseRedirect(
            f'{reverse("admin:purchases_ordencompra_cambiar_estado")}?ids={"|".join(selected)}'
        )
    forzar_cambio_estado.short_description = 'Forzar cambio de estado (status)'

    def cambiar_estado_view(self, request):
        ids = [i for i in request.GET.get('ids', '').split('|') if i]
        ordenes = OrdenCompra.objects.filter(id__in=ids)
        if not ordenes.exists():
            self.message_user(request, 'No se encontraron órdenes.', level=messages.ERROR)
            return HttpResponseRedirect(reverse('admin:purchases_ordencompra_changelist'))

        if request.method == 'POST':
            nuevo_status = request.POST.get('status')
            if nuevo_status not in dict(OrdenCompra.STATUS_CHOICES):
                self.message_user(request, 'Estado inválido.', level=messages.ERROR)
                return HttpResponseRedirect(reverse('admin:purchases_ordencompra_changelist'))

            for oc in ordenes:
                # Forzado: permite pasar de 'cancelado' a cualquier otro estado.
                # save() completo para que la lógica de fechas/stock del modelo se aplique.
                oc.status = nuevo_status
                oc.save()
            self.message_user(
                request,
                f'Estado forzado a "{nuevo_status}" en {ordenes.count()} orden(es).',
            )
            return HttpResponseRedirect(reverse('admin:purchases_ordencompra_changelist'))

        return render(
            request,
            'admin/purchases/ordencompra_cambiar_estado.html',
            {
                'ordenes': ordenes,
                'status_choices': OrdenCompra.STATUS_CHOICES,
                'opts': self.model._meta,
            },
        )
