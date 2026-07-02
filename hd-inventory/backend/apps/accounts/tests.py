from django.test import TestCase, RequestFactory
from django.conf import settings
from django.contrib.auth import get_user_model, authenticate
from apps.accounts.admin import CustomUserCreationForm
from django.contrib.admin.sites import AdminSite
from apps.accounts.admin import CustomUserAdmin

User = get_user_model()


class DummyMessages:
    """Mock simple para el almacenamiento de mensajes de Django Admin en pruebas."""
    def __init__(self):
        self.messages = []

    def add(self, level, message, extra_tags=''):
        self.messages.append((level, message, extra_tags))


class AccountsAuthTest(TestCase):
    def setUp(self):
        # Aseguramos que haya un valor configurado
        self.default_temp_password = getattr(settings, 'DEFAULT_TEMPORARY_PASSWORD', 'Cambiar2026!')
        self.factory = RequestFactory()

    def test_user_creation_assigns_default_password(self):
        """Verifica que al crear un usuario con el CustomUserCreationForm/save_model se asigne la contraseña por defecto."""
        # Instanciar el admin y simular la creación de usuario
        site = AdminSite()
        admin = CustomUserAdmin(User, site)
        
        # Datos del formulario de creación
        form_data = {
            'username': 'nuevo_usuario',
            'first_name': 'Nombre',
            'last_name': 'Apellido',
            'email': 'nuevo@correo.com',
            'role': 'capturista',
            'must_change_password': True
        }
        
        form = CustomUserCreationForm(data=form_data)
        self.assertTrue(form.is_valid())
        
        # Simular save_model de Django Admin
        user_instance = form.save(commit=False)
        admin.save_model(request=None, obj=user_instance, form=form, change=False)
        
        # Verificar que el usuario se guardó en BD y se le asignaron las credenciales por defecto
        saved_user = User.objects.get(username='nuevo_usuario')
        self.assertTrue(saved_user.must_change_password)
        
        # Intentar autenticar con la contraseña por defecto
        authenticated_user = authenticate(username='nuevo_usuario', password=self.default_temp_password)
        self.assertIsNotNone(authenticated_user)
        self.assertEqual(authenticated_user.role, 'capturista')

    def test_admin_action_resets_passwords_to_default(self):
        """Verifica que la acción reset_passwords de CustomUserAdmin restablezca las contraseñas al valor por defecto."""
        site = AdminSite()
        admin = CustomUserAdmin(User, site)
        
        # Crear usuario con contraseña personalizada inicial
        user = User.objects.create_user(
            username='usuario_a_resetear',
            email='test@test.com',
            password='PasswordInicialDiferente123!',
            role='capturista'
        )
        user.must_change_password = False
        user.save()
        
        # Crear un request simulado y adjuntar el backend de mensajes mockeado
        request = self.factory.post('/admin/accounts/user/')
        request._messages = DummyMessages()
        
        # Ejecutar acción de reset
        queryset = User.objects.filter(username='usuario_a_resetear')
        admin.reset_passwords(request=request, queryset=queryset)
        
        # Recargar desde base de datos
        user.refresh_from_db()
        
        # Verificar que el flag de cambio de contraseña se activó
        self.assertTrue(user.must_change_password)
        
        # Verificar que la nueva contraseña autentica correctamente
        authenticated_user = authenticate(username='usuario_a_resetear', password=self.default_temp_password)
        self.assertIsNotNone(authenticated_user)
