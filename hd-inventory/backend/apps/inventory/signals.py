"""
Signals de inventario — actualización automática del stock.
"""
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.db import transaction
from django.db.models import F


@receiver(post_save, sender='inventory.Entrada')
def actualizar_stock_entrada(sender, instance, created, **kwargs):
    """Al registrar una entrada, suma la cantidad al stock del material."""
    if created:
        with transaction.atomic():
            material = instance.material
            material.stock_actual = F('stock_actual') + instance.cantidad
            material.save(update_fields=['stock_actual', 'actualizado_en'])
            material.refresh_from_db(fields=['stock_actual'])


@receiver(post_save, sender='inventory.Salida')
def actualizar_stock_salida(sender, instance, created, **kwargs):
    """Al registrar una salida, resta la cantidad del stock del material."""
    if created:
        with transaction.atomic():
            material = instance.material
            material.stock_actual = F('stock_actual') - instance.cantidad
            material.save(update_fields=['stock_actual', 'actualizado_en'])
            material.refresh_from_db(fields=['stock_actual'])


@receiver(post_save, sender='inventory.Vale')
def actualizar_stock_vale(sender, instance, created, **kwargs):
    """
    Al crear un vale, restar cantidad del stock de cada material SOLO SI
    no está ya vinculado a una Salida (para evitar doble resta).
    """
    if created and not instance.salida:
        items = instance.items.all()
        if items.exists():
            for item in items:
                with transaction.atomic():
                    material = item.material
                    material.stock_actual = F('stock_actual') - item.cantidad
                    material.save(update_fields=['stock_actual', 'actualizado_en'])
                    material.refresh_from_db(fields=['stock_actual'])
        elif instance.material:
            with transaction.atomic():
                material = instance.material
                material.stock_actual = F('stock_actual') - instance.cantidad
                material.save(update_fields=['stock_actual', 'actualizado_en'])
                material.refresh_from_db(fields=['stock_actual'])
