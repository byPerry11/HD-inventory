from io import BytesIO
import tempfile
from datetime import datetime

from django.test import TestCase
from openpyxl import Workbook, load_workbook

from apps.materials.models import Material
from apps.materials.reports import generate_chemical_inventory_excel
from apps.inventory.models import Entrada, Salida


class ChemicalInventoryReportTests(TestCase):
    def setUp(self):
        # create a minimal template workbook with header row
        wb = Workbook()
        ws = wb.active
        # Put some header labels (include Nombre del material and months short)
        headers = ['# HDS', 'Nombre del material', 'Presentación U/M', 'Fecha de Caducidad',
                   'Cant. Cierre año anterior', 'Balance', 'ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN',
                   'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC', 'Total']
        ws.append(headers)

        tf = tempfile.NamedTemporaryFile(suffix='.xlsx', delete=False)
        wb.save(tf.name)
        tf.flush()
        tf.close()
        self.template_path = tf.name

    def tearDown(self):
        try:
            import os
            os.unlink(self.template_path)
        except Exception:
            pass

    def test_generate_report_with_movements(self):
        # create a material
        m = Material.objects.create(code='MAT-001', name='Ácido X', unit='lt', stock_actual=5)

        # create entradas/salidas in specific months
        year = datetime.now().year
        # Entrada in March (month 3)
        e = Entrada.objects.create(material=m, cantidad=10, proveedor='Prov', numero_orden='OC-1')
        Entrada.objects.filter(pk=e.pk).update(fecha=datetime(year, 3, 5))

        # Salida in March of 3 units
        s = Salida.objects.create(material=m, cantidad=3, recibio='Prod', turno='1st Shift')
        Salida.objects.filter(pk=s.pk).update(fecha=datetime(year, 3, 12))

        content = generate_chemical_inventory_excel([m], template_path=self.template_path, year=year)
        self.assertIsInstance(content, (bytes, bytearray))

        # load generated workbook and verify values
        wb2 = load_workbook(filename=BytesIO(content))
        ws2 = wb2.active
        # header row is first row; data starts at row 2
        # Entrada row should be at row 2, Salida row at 3, Stock at 4
        entrada_row = 2
        salida_row = 3
        stock_row = 4

        # find column indices
        cols = {cell.value: cell.column for cell in ws2[1]}
        self.assertIn('MAR', cols)
        mar_col = cols['MAR']
        total_col = cols.get('Total')

        # Entrada in MAR should be 10
        self.assertEqual(ws2.cell(row=entrada_row, column=mar_col).value, 10)
        # Salida in MAR should be 3
        self.assertEqual(ws2.cell(row=salida_row, column=mar_col).value, 3)
        # Stock in Total should equal material.stock_actual
        if total_col:
            self.assertEqual(ws2.cell(row=stock_row, column=total_col).value, m.stock_actual)
