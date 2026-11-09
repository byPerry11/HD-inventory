# No-op de rescate 2026-09-07: backfill ya ejecutado en prod el 2026-07-29.
# Función original conservada en git history. Estado consolidado en 0001_initial.

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0006_vale_items'),
    ]

    operations = []
