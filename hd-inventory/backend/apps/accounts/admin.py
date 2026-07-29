"""accounts/admin.py"""
from django import forms
from django.conf import settings
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User


class CustomUserCreationForm(forms.ModelForm):
    """Formulario simplificado para la creación de usuarios desde el Admin sin pedir contraseñas."""
    class Meta:
        model = User
        fields = ('username', 'first_name', 'last_name', 'email', 'role', 'must_change_password')

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['email'].required = True
        self.fields['first_name'].required = True
        self.fields['last_name'].required = True


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    """Admin de usuarios con rol y seguridad de contraseñas temporales."""
    add_form = CustomUserCreationForm
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

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('username', 'first_name', 'last_name', 'email', 'role', 'must_change_password'),
        }),
    )

    def save_model(self, request, obj, form, change):
        if not change:  # Creando un nuevo usuario
            default_password = getattr(settings, 'DEFAULT_TEMPORARY_PASSWORD', 'Cambiar2026!')
            obj.set_password(default_password)
            obj.must_change_password = True
        super().save_model(request, obj, form, change)

    @admin.action(description='Resetear contraseñas a la default')
    def reset_passwords(self, request, queryset):
        default_password = getattr(settings, 'DEFAULT_TEMPORARY_PASSWORD', 'Cambiar2026!')
        for user in queryset:
            user.set_password(default_password)
            user.must_change_password = True
            user.save()
        self.message_user(request, f"Se ha reseteado la contraseña de {queryset.count()} usuario(s) a la por defecto ({default_password}).")
