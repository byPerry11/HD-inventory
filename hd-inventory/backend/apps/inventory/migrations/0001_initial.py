# Squash de rescate 2026-09-07 — HD-Inventory prod.
# Consolida el estado final de los modelos (equivale a 0001..0009 ya aplicadas
# en prod según django_migrations). Las 0002..0009 quedan como no-op.
# NO genera SQL en prod (todo aplicado): solo permite a Django renderizar
# el grafo y arrancar. Backups: pg_dump + pgdata_vol_backup del 2026-09-07.
# Rama obsoleta archivada en backend/_migration_archive_20260907/.

import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('materials', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Linea',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nombre', models.CharField(max_length=100, unique=True, verbose_name='Nombre de la Línea')),
            ],
            options={
                'verbose_name': 'Línea',
                'verbose_name_plural': 'Líneas',
                'ordering': ['nombre'],
            },
        ),
        migrations.CreateModel(
            name='Area',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nombre', models.CharField(max_length=100, verbose_name='Nombre del Área')),
                ('linea', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='areas', to='inventory.linea', verbose_name='Línea')),
            ],
            options={
                'verbose_name': 'Área',
                'verbose_name_plural': 'Áreas',
                'ordering': ['linea', 'nombre'],
                'unique_together': {('nombre', 'linea')},
            },
        ),
        migrations.CreateModel(
            name='Entrada',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('cantidad', models.PositiveIntegerField(verbose_name='Cantidad')),
                ('fecha', models.DateTimeField(auto_now_add=True, verbose_name='Fecha y Hora')),
                ('proveedor', models.CharField(blank=True, max_length=200, verbose_name='Proveedor')),
                ('numero_orden', models.CharField(blank=True, max_length=100, verbose_name='No. Orden / Remisión')),
                ('observaciones', models.TextField(blank=True, verbose_name='Observaciones')),
                ('material', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='entradas', to='materials.material', verbose_name='Material')),
                ('registrado_por', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='entradas_registradas', to=settings.AUTH_USER_MODEL, verbose_name='Registrado por')),
            ],
        ),
        migrations.CreateModel(
            name='Salida',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('cantidad', models.PositiveIntegerField(verbose_name='Cantidad')),
                ('fecha', models.DateTimeField(auto_now_add=True, verbose_name='Fecha y Hora')),
                ('linea_legacy', models.CharField(blank=True, max_length=50, verbose_name='Línea (Legacy)')),
                ('seccion_legacy', models.CharField(blank=True, max_length=100, verbose_name='Sección (Legacy)')),
                ('linea', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='salidas', to='inventory.linea', verbose_name='Línea')),
                ('area', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='salidas', to='inventory.area', verbose_name='Área')),
                ('turno', models.CharField(choices=[('1st Shift', '1st Shift'), ('2nd Shift', '2nd Shift'), ('3rd Shift', '3rd Shift')], max_length=20, verbose_name='Turno')),
                ('empleado_no', models.CharField(blank=True, max_length=50, verbose_name='No. Empleado')),
                ('recibio', models.CharField(max_length=200, verbose_name='Recibió')),
                ('observaciones', models.TextField(blank=True, verbose_name='Comentarios')),
                ('material', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='salidas', to='materials.material', verbose_name='Material (Parte)')),
                ('registrado_por', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='salidas_registradas', to=settings.AUTH_USER_MODEL, verbose_name='Capturado por')),
            ],
            options={
                'verbose_name': 'Salida',
                'verbose_name_plural': 'Salidas',
                'ordering': ['-fecha'],
            },
        ),
        migrations.CreateModel(
            name='Vale',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('empleado_no', models.CharField(max_length=50, verbose_name='No. Empleado')),
                ('empleado_nombre', models.CharField(max_length=200, verbose_name='Nombre del Empleado')),
                ('recibo_no', models.PositiveIntegerField(blank=True, null=True, unique=True, verbose_name='Recibo No.')),
                ('salida', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='vales', to='inventory.salida', verbose_name='Salida Relacionada')),
                ('seccion_legacy', models.CharField(blank=True, max_length=100, verbose_name='Sección (Legacy)')),
                ('linea', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='vales', to='inventory.linea', verbose_name='Línea')),
                ('area', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='vales', to='inventory.area', verbose_name='Área')),
                ('fecha', models.DateTimeField(default=django.utils.timezone.now, verbose_name='Fecha')),
                ('material', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='vales', to='materials.material', verbose_name='Material (Parte) — legacy')),
                ('aut', models.CharField(blank=True, max_length=200, verbose_name='Aut')),
                ('cantidad', models.PositiveIntegerField(blank=True, null=True, verbose_name='Cantidad — legacy')),
                ('costo', models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True, verbose_name='Costo — legacy')),
                ('observaciones', models.TextField(blank=True, verbose_name='Observaciones')),
                ('firma_supervisor', models.BooleanField(default=False, verbose_name='Firma Supervisor')),
                ('firma_supervisor_nombre', models.CharField(blank=True, max_length=255, verbose_name='Nombre Supervisor')),
                ('firma_gerente', models.BooleanField(default=False, verbose_name='Firma Gerente')),
                ('firma_gerente_nombre', models.CharField(blank=True, max_length=255, verbose_name='Nombre Gerente')),
                ('firma_empleado', models.BooleanField(default=False, verbose_name='Firma Empleado')),
                ('firma_empleado_nombre', models.CharField(blank=True, max_length=255, verbose_name='Nombre Empleado')),
                ('firma_entrega', models.BooleanField(default=False, verbose_name='Firma Quien Entrega')),
                ('firma_entrega_nombre', models.CharField(blank=True, max_length=255, verbose_name='Nombre Quien Entrega')),
                ('registrado_por', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='vales_registrados', to=settings.AUTH_USER_MODEL, verbose_name='Capturado por')),
            ],
        ),
        migrations.CreateModel(
            name='ValeItem',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('cantidad', models.PositiveIntegerField(verbose_name='Cantidad')),
                ('costo', models.DecimalField(decimal_places=2, max_digits=12, verbose_name='Costo')),
                ('material', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to='materials.material', verbose_name='Material')),
                ('vale', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='items', to='inventory.vale', verbose_name='Vale')),
            ],
            options={
                'verbose_name': 'Artículo de Vale',
                'verbose_name_plural': 'Artículos de Vales',
            },
        ),
        migrations.CreateModel(
            name='Empleado',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('numero', models.CharField(max_length=50, unique=True, verbose_name='No. Empleado')),
                ('nombre', models.CharField(max_length=255, verbose_name='Nombre')),
            ],
            options={
                'verbose_name': 'Empleado',
                'verbose_name_plural': 'Empleados',
                'ordering': ['numero'],
            },
        ),
    ]
