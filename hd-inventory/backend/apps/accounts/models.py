"""
App: accounts
Gestión de usuarios con roles: manager, supervisor, capturista
"""
from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """
    Usuario personalizado del sistema de inventario.
    Los usuarios y sus roles se administran 100% desde Django Admin.
    """
    ROLE_CHOICES = [
        ('manager', 'Manager'),
        ('supervisor', 'Supervisor'),
        ('capturista', 'Capturista'),
    ]

    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default='capturista',
        verbose_name='Rol',
    )

    avatar = models.ImageField(
        upload_to='avatars/',
        null=True,
        blank=True,
        verbose_name='Imagen de perfil'
    )

    class Meta:
        verbose_name = 'Usuario'
        verbose_name_plural = 'Usuarios'

    def __str__(self):
        return f"{self.get_full_name() or self.username} ({self.get_role_display()})"

    # ─── Helpers de rol ──────────────────────────────────────
    @property
    def is_manager(self):
        return self.role == 'manager'

    @property
    def is_supervisor_or_above(self):
        return self.role in ('manager', 'supervisor')

    @property
    def is_capturista(self):
        return self.role == 'capturista'
