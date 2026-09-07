# No-op de rescate 2026-09-07: estado consolidado en 0001_initial (ya aplicado en prod).

import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0008_vale_firma_empleado_nombre_vale_firma_entrega_nombre_and_more'),
    ]

    operations = []
