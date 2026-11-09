from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from apps.inventory.models import Entrada, Salida, Vale, ValeItem
from apps.materials.models import Material

User = get_user_model()


class FlujoMaterialesTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='supervisor_flujo',
            password='password123',
            role='supervisor',
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

        self.material_a = Material.objects.create(
            code='FLUJO-A', name='Material Alfa', unit='pza', activo=True,
        )
        self.material_b = Material.objects.create(
            code='FLUJO-B', name='Material Beta', unit='kg', activo=True,
        )
        self.material_c = Material.objects.create(
            code='FLUJO-C', name='Material Gamma', unit='caja', activo=True,
        )
        self.material_d = Material.objects.create(
            code='FLUJO-D', name='Material Delta', unit='pza', activo=True,
        )

        ahora = timezone.now()

        # A: 10 salidas hoy, 4 entradas hoy y 6 salidas hace 2 días.
        self.salida_a = Salida.objects.create(
            material=self.material_a, cantidad=10, turno='1st Shift', recibio='Producción',
        )
        Entrada.objects.create(material=self.material_a, cantidad=4)
        salida_a_vieja = Salida.objects.create(
            material=self.material_a, cantidad=6, turno='1st Shift', recibio='Producción',
        )
        Salida.objects.filter(pk=salida_a_vieja.pk).update(
            fecha=ahora - timedelta(days=2),
        )

        # B: 25 salidas hace 5 días y 100 entradas hace 10 días.
        salida_b = Salida.objects.create(
            material=self.material_b, cantidad=25, turno='2nd Shift', recibio='Producción',
        )
        Salida.objects.filter(pk=salida_b.pk).update(
            fecha=ahora - timedelta(days=5),
        )
        entrada_b = Entrada.objects.create(material=self.material_b, cantidad=100)
        Entrada.objects.filter(pk=entrada_b.pk).update(
            fecha=ahora - timedelta(days=10),
        )

        # C: salida con su vale vinculado (no debe duplicar) + vale sin salida.
        salida_c = Salida.objects.create(
            material=self.material_c, cantidad=8, turno='1st Shift', recibio='Producción',
        )
        vale_vinculado = Vale.objects.create(
            empleado_no='100', empleado_nombre='Operador Uno',
            salida=salida_c, fecha=ahora,
        )
        ValeItem.objects.create(
            vale=vale_vinculado, material=self.material_c, cantidad=8, costo=10,
        )
        vale_suelto = Vale.objects.create(
            empleado_no='101', empleado_nombre='Operador Dos', fecha=ahora,
        )
        ValeItem.objects.create(
            vale=vale_suelto, material=self.material_c, cantidad=3, costo=10,
        )

        # D: solo entradas; suma al total pero no aparece en el top.
        Entrada.objects.create(material=self.material_d, cantidad=7)

    def _periodo(self, key):
        response = self.client.get(reverse('analytics-flujo-materiales'))
        self.assertEqual(response.status_code, 200)
        return next(p for p in response.data['periodos'] if p['key'] == key)

    def test_ventanas_y_ranking_por_periodo(self):
        p24 = self._periodo('24h')
        self.assertEqual([m['code'] for m in p24['data']], ['FLUJO-C', 'FLUJO-A'])
        self.assertEqual(p24['salidas'], 21)
        self.assertEqual(p24['entradas'], 11)

        p3 = self._periodo('3d')
        self.assertEqual([m['code'] for m in p3['data']], ['FLUJO-A', 'FLUJO-C'])
        self.assertEqual(p3['data'][0]['salidas'], 16)

        p7 = self._periodo('7d')
        self.assertEqual([m['code'] for m in p7['data']], ['FLUJO-B', 'FLUJO-A', 'FLUJO-C'])

        p15 = self._periodo('15d')
        beta = next(m for m in p15['data'] if m['code'] == 'FLUJO-B')
        self.assertEqual(beta['salidas'], 25)
        self.assertEqual(beta['entradas'], 100)

    def test_vale_vinculado_no_duplica_salidas(self):
        p24 = self._periodo('24h')
        gamma = next(m for m in p24['data'] if m['code'] == 'FLUJO-C')
        self.assertEqual(gamma['salidas'], 11)
        self.assertEqual(gamma['movimientos_salida'], 2)

    def test_material_sin_salidas_no_entra_al_top(self):
        p24 = self._periodo('24h')
        self.assertNotIn('FLUJO-D', [m['code'] for m in p24['data']])

    def test_limite_de_filas(self):
        response = self.client.get(
            reverse('analytics-flujo-materiales'), {'limite': 2},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['periodos'][0]['data']), 2)

    def test_requiere_supervisor_o_manager(self):
        capturista = User.objects.create_user(
            username='capturista_flujo', password='password123', role='capturista',
        )
        self.client.force_authenticate(capturista)
        response = self.client.get(reverse('analytics-flujo-materiales'))
        self.assertEqual(response.status_code, 403)

        self.client.force_authenticate(None)
        response = self.client.get(reverse('analytics-flujo-materiales'))
        self.assertEqual(response.status_code, 401)
