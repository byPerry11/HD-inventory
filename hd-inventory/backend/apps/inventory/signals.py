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
def actualizar_stock_vale(sender, instance, created, **kwargs):
    """
    Al crear un vale legacy (material único), resta stock.
    Los vales multi-item se descuentan vía ValeItem post_save
    (aquí items aún no existe: el Vale se crea antes que sus items).
    Se omite si está vinculado a una Salida (evita doble resta).
    """
    if created and not instance.salida:
        if instance.material and instance.cantidad:
            # Solo legacy: si el vale trae items, esos los descuenta
            # actualizar_stock_valeitem_guardar uno por uno.
            has_items = instance.items.exists()
            if not has_items:
                with transaction.atomic():
                    material = instance.material
                    material.stock_actual = F('stock_actual') - instance.cantidad
                    material.save(update_fields=['stock_actual', 'actualizado_en'])
                    material.refresh_from_db(fields=['stock_actual'])


@receiver(post_delete, sender='inventory.Vale')
def actualizar_stock_vale_eliminar(sender, instance, **kwargs):
    """Al eliminar un vale, devuelve la cantidad al stock si no estaba vinculado a una Salida."""
    if not instance.salida:
        # Nota: los ValeItem se revierten vía sus propios signals post_delete
        # (cascade). Aquí solo se revierte el legacy para evitar doble conteo.
        if instance.material and instance.cantidad:
            # Si el vale tenía items, el legacy ya se descontó además de los
            # items; se revierte también. Si solo era legacy, igual aplica.
            with transaction.atomic():
                material = instance.material
                material.stock_actual = F('stock_actual') + instance.cantidad
                material.save(update_fields=['stock_actual', 'actualizado_en'])
                material.refresh_from_db(fields=['stock_actual'])


# ─── Signals para ValeItem (multi-artículo) ───────────────────
# El signal post_save de Vale no ve los items (se crean después del Vale),
# por eso el descuento multi-item vive aquí, item por item.

@receiver(post_save, sender='inventory.ValeItem')
def actualizar_stock_valeitem_guardar(sender, instance, created, **kwargs):
    """Al crear un ValeItem, descuenta stock (salvo vales vinculados a Salida)."""
    if not created:
        return
    vale = instance.vale
    if vale and vale.salida_id:
        return
    with transaction.atomic():
        material = instance.material
        material.stock_actual = F('stock_actual') - instance.cantidad
        material.save(update_fields=['stock_actual', 'actualizado_en'])
        material.refresh_from_db(fields=['stock_actual'])


@receiver(post_delete, sender='inventory.ValeItem')
def actualizar_stock_valeitem_eliminar(sender, instance, **kwargs):
    """Al eliminar un ValeItem, devuelve stock (salvo vales vinculados a Salida)."""
    vale_salida_id = getattr(getattr(instance, 'vale', None), 'salida_id', None)
    if vale_salida_id:
        return
    if instance.material:
        with transaction.atomic():
            material = instance.material
            material.stock_actual = F('stock_actual') + instance.cantidad
            material.save(update_fields=['stock_actual', 'actualizado_en'])
            material.refresh_from_db(fields=['stock_actual'])
