"""accounts/admin.py"""
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    """Admin de usuarios con campo de rol visible."""
    list_display = ('username', 'first_name', 'last_name', 'email', 'role', 'must_change_password', 'is_active')
    list_filter = ('role', 'must_change_password', 'is_active', 'is_staff')
    search_fields = ('username', 'first_name', 'last_name', 'email')
    ordering = ('username',)
    actions = ['reset_passwords']

    fieldsets = UserAdmin.fieldsets + (
        ('Rol en el Sistema y Seguridad', {
            'fields': ('role', 'must_change_password'),
            'description': 'Asigna el rol que determina los permisos del usuario en el sistema. Puedes forzar que el usuario cambie su contraseña en el próximo inicio de sesión marcando la casilla.',
        }),
    )

    add_fieldsets = UserAdmin.add_fieldsets + (
        ('Rol en el Sistema y Seguridad', {
            'fields': ('first_name', 'last_name', 'email', 'role', 'must_change_password'),
        }),
    )

    @admin.action(description='Resetear contraseñas a la default (PeSupplies2026)')
    def reset_passwords(self, request, queryset):
        for user in queryset:
            user.set_password('PeSupplies2026')
            user.must_change_password = True
            user.save()
        self.message_user(request, f"Se ha reseteado la contraseña de {queryset.count()} usuario(s) a 'PeSupplies2026'.")
