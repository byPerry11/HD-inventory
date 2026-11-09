# Activa los materiales que el flujo anterior de OC creó como inactivos.
# Solo afecta materiales auto-creados y vinculados a una orden ya recibida.

from django.db import migrations


PREFIJO_AUTO_CREADO = 'Creado automáticamente desde OC #'


def activar_materiales_auto_creados(apps, schema_editor):
    Material = apps.get_model('materials', 'Material')
    OrdenCompra = apps.get_model('purchases', 'OrdenCompra')

    material_ids = OrdenCompra.objects.filter(
        status__in=('recibido', 'rem_recibido'),
        material__isnull=False,
        material__activo=False,
        material__descripcion__startswith=PREFIJO_AUTO_CREADO,
    ).values_list('material_id', flat=True)

    Material.objects.filter(id__in=material_ids).update(activo=True)


class Migration(migrations.Migration):

    dependencies = [
        ('purchases', '0006_alter_proveedor_nombre_and_more'),
    ]

    operations = [
        migrations.RunPython(activar_materiales_auto_creados, migrations.RunPython.noop),
    ]
