# No-op de rescate 2026-09-07: estado consolidado en 0001_initial (ya aplicado en prod).
# Ver backend/_migration_archive_20260907/ y commit de squash.

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0001_initial'),
    ]

    operations = []
