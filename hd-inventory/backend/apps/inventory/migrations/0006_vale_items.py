# No-op de rescate 2026-09-07: estado consolidado en 0001_initial (ya aplicado en prod).

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0005_remove_entrada_costo_unitario_remove_entrada_moneda'),
        ('materials', '0004_remove_material_price_unit'),
    ]

    operations = []
