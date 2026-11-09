from django.test import TestCase
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from apps.purchases.models import OrdenCompra, Proveedor
from apps.materials.models import Material
from apps.inventory.models import Entrada

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

    def test_tiempo_entrega_dias(self):
        """Verifica que el cálculo de tiempo_entrega_dias no lance TypeError y calcule los días correctos."""
        import datetime
        oc = OrdenCompra(
            no_parte='MAT-TEST-01',
            descripcion='Material de Prueba',
            cantidad=5,
            costo_unitario=10.0,
            moneda='MXN',
            proveedor_ref=self.provider,
            material=self.material,
            creado_por=self.user,
            status='recibido'
        )
        # Asignar fechas como datetime
        now = timezone.now()
        oc.fecha_po_aprobada = now - datetime.timedelta(days=5)
        oc.fecha_recibido = now
        
        # Debe calcular 5 días
        self.assertEqual(oc.tiempo_entrega_dias, 5)

    def test_recibir_crea_material_activo_y_registra_entrada(self):
        """Al recibir una OC con un No. parte nuevo se crea un material ACTIVO con stock."""
        oc = OrdenCompra.objects.create(
            no_parte='NEW-PART-001',
            descripcion='Sensor nuevo',
            cantidad=7,
            costo_unitario=15.0,
            moneda='MXN',
            po_number='PO-2026-100',
            creado_por=self.user,
        )
        self.assertIsNone(oc.material)

        oc.status = 'recibido'
        oc.recibido_por = 'Almacenista Test'
        oc.save()

        material = Material.objects.get(code='NEW-PART-001')
        self.assertTrue(material.activo)
        self.assertEqual(material.stock_actual, 7)
        self.assertEqual(material.name, 'Sensor nuevo')
        self.assertTrue(oc._material_creado_automaticamente)

        oc.refresh_from_db()
        self.assertEqual(oc.material_id, material.id)
        self.assertEqual(
            Entrada.objects.filter(
                material=material,
                cantidad=7,
                numero_orden='PO-2026-100',
            ).count(),
            1,
        )

    def test_recibir_reactiva_material_inactivo_existente(self):
        """Si el material ya existe pero está inactivo, al recibir se reactiva y suma stock."""
        material = Material.objects.create(
            code='MAT-INACTIVO-01',
            name='Material inactivo',
            activo=False,
            stock_actual=0,
        )
        oc = OrdenCompra.objects.create(
            no_parte='MAT-INACTIVO-01',
            descripcion='Material inactivo',
            cantidad=3,
            costo_unitario=5.0,
            moneda='MXN',
            material=material,
            creado_por=self.user,
        )

        oc.status = 'recibido'
        oc.recibido_por = 'Almacenista Test'
        oc.save()

        material.refresh_from_db()
        self.assertTrue(material.activo)
        self.assertEqual(material.stock_actual, 3)
        self.assertFalse(oc._material_creado_automaticamente)

    def test_advance_step_a_recibido_registra_material_activo(self):
        """El endpoint usado por la UI al recibir deja el material activo y con stock."""
        oc = OrdenCompra.objects.create(
            no_parte='API-PART-001',
            descripcion='Material desde API',
            cantidad=4,
            costo_unitario=8.0,
            moneda='MXN',
            status='ordenado',
            creado_por=self.user,
        )
        client = APIClient()
        client.force_authenticate(user=self.user)

        response = client.post(
            f'/api/purchases/ordenes/{oc.id}/advance-step/',
            {'recibido_por': 'Almacenista API'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        material = Material.objects.get(code='API-PART-001')
        self.assertTrue(material.activo)
        self.assertEqual(material.stock_actual, 4)
        oc.refresh_from_db()
        self.assertEqual(oc.status, 'recibido')
        self.assertEqual(oc.material_id, material.id)
        self.assertEqual(oc.recibido_por, 'Almacenista API')

    def test_recibir_material_existente_no_duplica_stock_al_volver_a_guardar(self):
        """Guardar de nuevo una OC ya recibida no debe crear otra entrada ni sumar stock."""
        oc = OrdenCompra.objects.create(
            no_parte='MAT-TEST-01',
            descripcion='Material de Prueba',
            cantidad=5,
            costo_unitario=10.0,
            moneda='MXN',
            material=self.material,
            creado_por=self.user,
        )
        oc.status = 'recibido'
        oc.recibido_por = 'Almacenista Test'
        oc.save()

        self.material.refresh_from_db()
        self.assertEqual(self.material.stock_actual, 15)

        oc.save()
        self.material.refresh_from_db()
        self.assertEqual(self.material.stock_actual, 15)
        self.assertEqual(
            Entrada.objects.filter(material=self.material, cantidad=5).count(),
            1,
        )

    def assertNilDates(self, instance, field_names):
        for name in field_names:
            self.assertIsNone(getattr(instance, name), f"El campo {name} debería ser None")
