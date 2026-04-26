"""accounts/admin.py"""
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    """Admin de usuarios con campo de rol visible."""
    list_display = ('username', 'first_name', 'last_name', 'email', 'role', 'is_active')
    list_filter = ('role', 'is_active', 'is_staff')
    search_fields = ('username', 'first_name', 'last_name', 'email')
    ordering = ('username',)

    fieldsets = UserAdmin.fieldsets + (
        ('Rol en el Sistema', {
            'fields': ('role',),
            'description': 'Asigna el rol que determina los permisos del usuario en el sistema.',
        }),
    )

    add_fieldsets = UserAdmin.add_fieldsets + (
        ('Rol en el Sistema', {
            'fields': ('first_name', 'last_name', 'email', 'role'),
        }),
    )
