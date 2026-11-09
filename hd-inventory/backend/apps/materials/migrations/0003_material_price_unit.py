# No-op de rescate 2026-09-07: price_unit fue añadido y removido; 0001_initial
# final no lo incluye y la columna huérfana en prod es inofensiva.
# TODO(post-rescate): DROP COLUMN materials_material.price_unit manual.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('materials', '0002_alter_material_ubicacion'),
    ]

    operations = []
