from django.db import migrations, models
from django.utils import timezone

def migrate_data(apps, schema_editor):
    OrdenCompra = apps.get_model('purchases', 'OrdenCompra')
    
    for oc in OrdenCompra.objects.all():
        # 1. Mapeo de estados antiguos
        if oc.status == 'en_proceso':
            oc.status = 'pr_creada'
        
        # 2. Poblar fechas de auditoría iniciales (usando creado_en como base)
        if not oc.fecha_pr:
            oc.fecha_pr = oc.creado_en

        # 3. Migrar fecha de aprobación a fecha_po_aprobada
        if oc.fecha_aprobacion:
            # Convertir Date a DateTime (timezone aware)
            oc.fecha_po_aprobada = timezone.make_aware(
                timezone.datetime.combine(oc.fecha_aprobacion, timezone.datetime.min.time())
            )
            
            # Si ya estaba ordenado, poblar fecha_ordenado como fallback
            if oc.status == 'ordenado' and not oc.fecha_ordenado:
                oc.fecha_ordenado = oc.actualizado_en
        
        oc.save()

class Migration(migrations.Migration):

    dependencies = [
        ('purchases', '0004_proveedor_alter_ordencompra_vendedor_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='ordencompra',
            name='es_remision',
            field=models.BooleanField(default=False, verbose_name='Pedido por Remisión'),
        ),
        migrations.AddField(
            model_name='ordencompra',
            name='fecha_ordenado',
            field=models.DateTimeField(blank=True, null=True, verbose_name='Fecha Ordenado'),
        ),
        migrations.AddField(
            model_name='ordencompra',
            name='fecha_po_aprobada',
            field=models.DateTimeField(blank=True, null=True, verbose_name='Fecha PO Aprobada'),
        ),
        migrations.AddField(
            model_name='ordencompra',
            name='fecha_pr',
            field=models.DateTimeField(blank=True, null=True, verbose_name='Fecha PR / Pedido REM'),
        ),
        migrations.AddField(
            model_name='ordencompra',
            name='fecha_pr_aprobada',
            field=models.DateTimeField(blank=True, null=True, verbose_name='Fecha PR Aprobada'),
        ),
        migrations.AddField(
            model_name='ordencompra',
            name='no_pr',
            field=models.CharField(blank=True, help_text='Requerido para flujo estándar.', max_length=100, verbose_name='No. PR'),
        ),
        migrations.AlterField(
            model_name='ordencompra',
            name='fecha_aprobacion',
            field=models.DateField(blank=True, null=True, verbose_name='Fecha Aprobación (LEGACY)'),
        ),
        migrations.AlterField(
            model_name='ordencompra',
            name='po_number',
            field=models.CharField(blank=True, help_text='Se captura al avanzar a PO Aprobada.', max_length=100, verbose_name='No. PO'),
        ),
        migrations.AlterField(
            model_name='ordencompra',
            name='status',
            field=models.CharField(choices=[('pr_creada', 'PR Creada'), ('pr_aprobada', 'PR Aprobada'), ('po_aprobada', 'PO Aprobada'), ('ordenado', 'Ordenado'), ('recibido', 'Recibido'), ('pedido_rem', 'Pedido REM'), ('rem_recibido', 'REM Recibido'), ('cancelado', 'Cancelado')], db_index=True, default='pr_creada', max_length=20, verbose_name='Estado'),
        ),
        # --- Migración de datos ---
        migrations.RunPython(migrate_data, reverse_code=migrations.RunPython.noop),
        # --- Eliminación de campo antiguo ---
        migrations.RemoveField(
            model_name='ordencompra',
            name='fecha_aprobacion',
        ),
    ]
