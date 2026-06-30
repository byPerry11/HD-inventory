"""
Signals de inventario — actualización automática y consistente del stock.
Maneja creación, modificación y eliminación de Entrada, Salida y Vale.
"""
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.db import transaction
from django.db.models import F
from apps.materials.models import Material


# ─── Signals para Entrada ─────────────────────────────────────

@receiver(post_save, sender='inventory.Entrada')
def actualizar_stock_entrada_guardar(sender, instance, created, **kwargs):
    """Al registrar o modificar una entrada, actualiza el stock del material."""
    if created:
        with transaction.atomic():
            material = instance.material
            material.stock_actual = F('stock_actual') + instance.cantidad
            material.save(update_fields=['stock_actual', 'actualizado_en'])
            material.refresh_from_db(fields=['stock_actual'])
    else:
        # Modificación
        old_material_id = getattr(instance, '_loaded_values', {}).get('material')
        old_cantidad = getattr(instance, '_loaded_values', {}).get('cantidad', 0)

        with transaction.atomic():
            if old_material_id == instance.material_id:
                # Mismo material, ajustar diferencia
                diff = instance.cantidad - old_cantidad
                if diff != 0:
                    material = instance.material
                    material.stock_actual = F('stock_actual') + diff
                    material.save(update_fields=['stock_actual', 'actualizado_en'])
                    material.refresh_from_db(fields=['stock_actual'])
            else:
                # Cambió de material
                if old_material_id:
                    old_material = Material.objects.filter(id=old_material_id).first()
                    if old_material:
                        old_material.stock_actual = F('stock_actual') - old_cantidad
                        old_material.save(update_fields=['stock_actual', 'actualizado_en'])
                
                material = instance.material
                material.stock_actual = F('stock_actual') + instance.cantidad
                material.save(update_fields=['stock_actual', 'actualizado_en'])
                material.refresh_from_db(fields=['stock_actual'])


@receiver(post_delete, sender='inventory.Entrada')
def actualizar_stock_entrada_eliminar(sender, instance, **kwargs):
    """Al eliminar una entrada, resta la cantidad del stock del material."""
    if instance.material:
        with transaction.atomic():
            material = instance.material
            material.stock_actual = F('stock_actual') - instance.cantidad
            material.save(update_fields=['stock_actual', 'actualizado_en'])
            material.refresh_from_db(fields=['stock_actual'])


# ─── Signals para Salida ──────────────────────────────────────

@receiver(post_save, sender='inventory.Salida')
def actualizar_stock_salida_guardar(sender, instance, created, **kwargs):
    """Al registrar o modificar una salida, actualiza el stock del material."""
    if created:
        with transaction.atomic():
            material = instance.material
            material.stock_actual = F('stock_actual') - instance.cantidad
            material.save(update_fields=['stock_actual', 'actualizado_en'])
            material.refresh_from_db(fields=['stock_actual'])
    else:
        # Modificación
        old_material_id = getattr(instance, '_loaded_values', {}).get('material')
        old_cantidad = getattr(instance, '_loaded_values', {}).get('cantidad', 0)

        with transaction.atomic():
            if old_material_id == instance.material_id:
                # Mismo material, ajustar diferencia (al ser salida, si aumenta la cantidad, disminuye el stock)
                diff = instance.cantidad - old_cantidad
                if diff != 0:
                    material = instance.material
                    material.stock_actual = F('stock_actual') - diff
                    material.save(update_fields=['stock_actual', 'actualizado_en'])
                    material.refresh_from_db(fields=['stock_actual'])
            else:
                # Cambió de material
                if old_material_id:
                    old_material = Material.objects.filter(id=old_material_id).first()
                    if old_material:
                        old_material.stock_actual = F('stock_actual') + old_cantidad
                        old_material.save(update_fields=['stock_actual', 'actualizado_en'])
                
                material = instance.material
                material.stock_actual = F('stock_actual') - instance.cantidad
                material.save(update_fields=['stock_actual', 'actualizado_en'])
                material.refresh_from_db(fields=['stock_actual'])


@receiver(post_delete, sender='inventory.Salida')
def actualizar_stock_salida_eliminar(sender, instance, **kwargs):
    """Al eliminar una salida, devuelve la cantidad al stock del material."""
    if instance.material:
        with transaction.atomic():
            material = instance.material
            material.stock_actual = F('stock_actual') + instance.cantidad
            material.save(update_fields=['stock_actual', 'actualizado_en'])
            material.refresh_from_db(fields=['stock_actual'])


# ─── Signals para Vale ────────────────────────────────────────

@receiver(post_save, sender='inventory.Vale')
def actualizar_stock_vale_guardar(sender, instance, created, **kwargs):
    """Al crear o modificar un vale, actualiza el stock solo si no está vinculado a una Salida."""
    if created:
        if not instance.salida:
            with transaction.atomic():
                material = instance.material
                material.stock_actual = F('stock_actual') - instance.cantidad
                material.save(update_fields=['stock_actual', 'actualizado_en'])
                material.refresh_from_db(fields=['stock_actual'])
    else:
        # Modificación
        old_salida = getattr(instance, '_loaded_values', {}).get('salida')
        old_material_id = getattr(instance, '_loaded_values', {}).get('material')
        old_cantidad = getattr(instance, '_loaded_values', {}).get('cantidad', 0)

        with transaction.atomic():
            if old_salida and not instance.salida:
                # Antes tenía salida (no restaba) y ahora ya no (debe restar)
                material = instance.material
                material.stock_actual = F('stock_actual') - instance.cantidad
                material.save(update_fields=['stock_actual', 'actualizado_en'])
                material.refresh_from_db(fields=['stock_actual'])
            elif not old_salida and instance.salida:
                # Antes no tenía salida (restó) y ahora sí (debe devolver la resta)
                if old_material_id:
                    old_material = Material.objects.filter(id=old_material_id).first()
                    if old_material:
                        old_material.stock_actual = F('stock_actual') + old_cantidad
                        old_material.save(update_fields=['stock_actual', 'actualizado_en'])
            elif not instance.salida:
                # Sigue sin estar vinculado a salida, manejar cambios de cantidad/material
                if old_material_id == instance.material_id:
                    diff = instance.cantidad - old_cantidad
                    if diff != 0:
                        material = instance.material
                        material.stock_actual = F('stock_actual') - diff
                        material.save(update_fields=['stock_actual', 'actualizado_en'])
                        material.refresh_from_db(fields=['stock_actual'])
                else:
                    if old_material_id:
                        old_material = Material.objects.filter(id=old_material_id).first()
                        if old_material:
                            old_material.stock_actual = F('stock_actual') + old_cantidad
                            old_material.save(update_fields=['stock_actual', 'actualizado_en'])
                    
                    material = instance.material
                    material.stock_actual = F('stock_actual') - instance.cantidad
                    material.save(update_fields=['stock_actual', 'actualizado_en'])
                    material.refresh_from_db(fields=['stock_actual'])


@receiver(post_delete, sender='inventory.Vale')
def actualizar_stock_vale_eliminar(sender, instance, **kwargs):
    """Al eliminar un vale, devuelve la cantidad al stock si no estaba vinculado a una Salida."""
    if not instance.salida and instance.material:
        with transaction.atomic():
            material = instance.material
            material.stock_actual = F('stock_actual') + instance.cantidad
            material.save(update_fields=['stock_actual', 'actualizado_en'])
            material.refresh_from_db(fields=['stock_actual'])
