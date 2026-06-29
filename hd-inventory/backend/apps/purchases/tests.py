from django.test import TestCase
from django.utils import timezone
from django.contrib.auth import get_user_model
from apps.purchases.models import OrdenCompra, Proveedor
from apps.materials.models import Material

User = get_user_model()


class OrdenCompraTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='supervisor_test',
            password='password123',
            role='supervisor'
        )
        self.provider = Proveedor.objects.create(nombre='Proveedor Test')
        self.material = Material.objects.create(
            code='MAT-TEST-01',
            name='Material de Prueba',
            activo=True,
            stock_actual=10,
            stock_minimo=5,
            stock_critico=2,
            unit='pza'
        )

    def test_standard_flow_transitions(self):
        """Verifica que cada paso en el flujo estándar asigne solo su fecha correspondiente."""
        # 1. Crear Orden de Compra (PR Creada)
        oc = OrdenCompra.objects.create(
            no_parte='MAT-TEST-01',
            descripcion='Material de Prueba',
            cantidad=5,
            costo_unitario=10.0,
            moneda='MXN',
            proveedor_ref=self.provider,
            material=self.material,
            creado_por=self.user
        )
        
        self.assertEqual(oc.status, 'pr_creada')
        self.assertIsNotNone(oc.fecha_pr)
        self.assertNilDates(oc, ['fecha_pr_aprobada', 'fecha_po_aprobada', 'fecha_ordenado', 'fecha_recibido'])
        self.assertEqual(oc.recibido_por, '')

        # 2. Avanzar a pr_aprobada
        oc.status = 'pr_aprobada'
        oc.save()
        self.assertIsNotNone(oc.fecha_pr_aprobada)
        self.assertNilDates(oc, ['fecha_po_aprobada', 'fecha_ordenado', 'fecha_recibido'])

        # 3. Avanzar a po_aprobada
        oc.status = 'po_aprobada'
        oc.po_number = 'PO-2026-001'
        oc.save()
        self.assertIsNotNone(oc.fecha_po_aprobada)
        self.assertNilDates(oc, ['fecha_ordenado', 'fecha_recibido'])

        # 4. Avanzar a ordenado
        oc.status = 'ordenado'
        oc.save()
        self.assertIsNotNone(oc.fecha_ordenado)
        self.assertNilDates(oc, ['fecha_recibido'])
        self.assertEqual(oc.recibido_por, '')

        # 5. Avanzar a recibido
        oc.status = 'recibido'
        oc.recibido_por = 'Almacenista Test'
        oc.save()
        self.assertIsNotNone(oc.fecha_recibido)
        self.assertEqual(oc.recibido_por, 'Almacenista Test')

    def test_state_cleanup_on_save(self):
        """Verifica que al guardar un registro se limpien fechas de estados posteriores a su estado actual."""
        oc = OrdenCompra.objects.create(
            no_parte='MAT-TEST-01',
            descripcion='Material de Prueba',
            cantidad=5,
            costo_unitario=10.0,
            moneda='MXN',
            proveedor_ref=self.provider,
            material=self.material,
            creado_por=self.user
        )

        # Inyectar fechas de forma manual como si estuviese en estado 'recibido'
        now = timezone.now()
        oc.fecha_pr_aprobada = now
        oc.fecha_po_aprobada = now
        oc.fecha_ordenado = now
        oc.fecha_recibido = now
        oc.recibido_por = 'Juan Perez'
        
        # Pero mantener el status en 'po_aprobada'
        oc.status = 'po_aprobada'
        oc.save()

        # El método save() debe haber limpiado fecha_ordenado, fecha_recibido y recibido_por
        self.assertIsNone(oc.fecha_ordenado)
        self.assertIsNone(oc.fecha_recibido)
        self.assertEqual(oc.recibido_por, '')
        
        # Pero debe conservar las fechas correspondientes a po_aprobada y anteriores
        self.assertIsNotNone(oc.fecha_pr)
        self.assertIsNotNone(oc.fecha_pr_aprobada)
        self.assertIsNotNone(oc.fecha_po_aprobada)

    def assertNilDates(self, instance, field_names):
        for name in field_names:
            self.assertIsNone(getattr(instance, name), f"El campo {name} debería ser None")
