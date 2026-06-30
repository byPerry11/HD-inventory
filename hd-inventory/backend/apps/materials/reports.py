"""Excel report generation for materials (chemical inventory).

This module provides a function to fill the provided Excel template
`INVENTARIO DE QUIMICO TEMPLATE.xlsx` with materials data.

The template file should be placed in the package under
`apps/materials/report_templates/INVENTARIO DE QUIMICO TEMPLATE.xlsx`.
If the file is missing the generator will raise a clear error.
"""
from io import BytesIO
import os
from datetime import date
from calendar import month_name

from openpyxl import load_workbook
from django.conf import settings


def _find_header_row_and_map(sheet):
    """Search the sheet for the header row that contains 'Nombre del material'
    and build a mapping of header text -> column letter/index.
    Returns (header_row_index, col_map).
    """
    for row in sheet.iter_rows(min_row=1, max_row=40):
        texts = [str(c.value).strip() if c.value else '' for c in row]
        if any('Nombre del material' in t for t in texts):
            header_row = row[0].row
            col_map = {}
            for cell in sheet[header_row]:
                text = str(cell.value).strip() if cell.value else ''
                if text:
                    col_map[text] = cell.column
            return header_row, col_map
    raise ValueError('No se encontró la fila de encabezado con "Nombre del material" en la plantilla')


def generate_chemical_inventory_excel(materials_qs, template_path=None, prepared_by=None, approved_by=None, department=None, year=None):
    """Genera un archivo Excel de inventario químico basado en la plantilla.

    - `materials_qs`: queryset o iterable de objetos Material.
    - `template_path`: ruta al archivo de plantilla. Si es None se busca
      en `report_templates/INVENTARIO DE QUIMICO TEMPLATE.xlsx` dentro del app.
    - `prepared_by`, `approved_by`, `department`: strings para rellenar cabeceras.

    Devuelve bytes del archivo generado.
    """
    if template_path is None:
        base = os.path.dirname(__file__)
        template_path = os.path.join(base, 'report_templates', 'INVENTARIO DE QUIMICO TEMPLATE.xlsx')

    if not os.path.exists(template_path):
        raise FileNotFoundError(f'Plantilla no encontrada: {template_path}')

    wb = load_workbook(template_path)
    ws = wb.active

    # Rellenar cabeceras simples si existen (buscamos celdas por textos esperados)
    # Ejemplos: "Preparado por:", "Aprobado por:", "Departamento:"
    for row in ws.iter_rows(min_row=1, max_row=20):
        for cell in row:
            if cell.value and isinstance(cell.value, str):
                v = cell.value.strip()
                if v.startswith('Preparado por') and prepared_by:
                    # escribir a la derecha de la etiqueta
                    ws.cell(row=cell.row, column=cell.column+1, value=prepared_by)
                if v.startswith('Aprobado por') and approved_by:
                    ws.cell(row=cell.row, column=cell.column+1, value=approved_by)
                if v.startswith('Departamento') and department:
                    ws.cell(row=cell.row, column=cell.column+1, value=department)


    header_row, col_map = _find_header_row_and_map(ws)

    # Define where to start writing datos (first row after header)
    start_row = header_row + 1

    # detect month columns by header values (expecting ENE..DIC or Enero..Diciembre)
    month_cols = {}
    months_short = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC']
    months_full = [m.upper() for m in list(month_name) if m]
    for cell in ws[header_row]:
        if cell.value and isinstance(cell.value, str):
            v = cell.value.strip().upper()
            if v in months_short:
                month_index = months_short.index(v) + 1
                month_cols[month_index] = cell.column
            elif v in months_full:
                month_index = months_full.index(v) + 1
                month_cols[month_index] = cell.column

    # find total column if present
    total_col = None
    for cell in ws[header_row]:
        if cell.value and isinstance(cell.value, str) and cell.value.strip().lower() == 'total':
            total_col = cell.column
            break

    # prepare year
    today = date.today()
    if year is None:
        year = today.year

    # import here to avoid circular imports at module load
    from apps.inventory.models import Entrada, Salida
    from collections import defaultdict

    # Pre-cargar entradas y salidas en lote para evitar N+1 queries
    # Si materials_qs es un queryset evaluado o lista, extraemos IDs
    material_ids = [m.id for m in materials_qs]
    
    todas_entradas = Entrada.objects.filter(material_id__in=material_ids, fecha__year=year)
    todas_salidas = Salida.objects.filter(material_id__in=material_ids, fecha__year=year)

    entradas_por_material = defaultdict(list)
    for e in todas_entradas:
        entradas_por_material[e.material_id].append(e)

    salidas_por_material = defaultdict(list)
    for s in todas_salidas:
        salidas_por_material[s.material_id].append(s)

    # We'll write three rows por material: Entrada, Salida, Stock
    r = start_row

    for m in materials_qs:
        col_code = col_map.get('# HDS') or col_map.get('#HDS') or list(col_map.values())[0]
        col_name = col_map.get('Nombre del material') or list(col_map.values())[1]
        col_unit = col_map.get('Presentación U/M') if 'Presentación U/M' in col_map else None
        col_prev = col_map.get('Cant. Cierre año anterior') or None
        col_balance = col_map.get('Balance') or None

        # Basic identifiers
        ws.cell(row=r, column=col_code, value=m.code)
        ws.cell(row=r, column=col_name, value=m.name)
        if col_unit:
            ws.cell(row=r, column=col_unit, value=m.unit)

        # Calculate monthly entradas/salidas for the given year
        entradas_m = entradas_por_material.get(m.id, [])
        salidas_m = salidas_por_material.get(m.id, [])

        entradas_by_month = {i: 0 for i in range(1,13)}
        salidas_by_month = {i: 0 for i in range(1,13)}

        for e in entradas_m:
            entradas_by_month[e.fecha.month] += e.cantidad
        for s in salidas_m:
            salidas_by_month[s.fecha.month] += s.cantidad

        # Row Entrada
        if col_balance:
            ws.cell(row=r, column=col_balance, value='Entrada')
        for month_idx, col in month_cols.items():
            ws.cell(row=r, column=col, value=entradas_by_month.get(month_idx, 0))

        # Row Salida
        if col_balance:
            ws.cell(row=r+1, column=col_balance, value='Salida')
        for month_idx, col in month_cols.items():
            ws.cell(row=r+1, column=col, value=salidas_by_month.get(month_idx, 0))

        # Row Stock
        if col_balance:
            ws.cell(row=r+2, column=col_balance, value='Stock')
        # place current stock in total column if exists else in last month column
        if total_col:
            ws.cell(row=r+2, column=total_col, value=m.stock_actual)
        else:
            if month_cols:
                last_col = month_cols[max(month_cols.keys())]
                ws.cell(row=r+2, column=last_col, value=m.stock_actual)
            else:
                # fallback: place in first available column after name
                ws.cell(row=r+2, column=(col_name+1 if col_name else 1), value=m.stock_actual)

        r += 3

    # Optionally write a generation date
    try:
        ws.cell(row=2, column=1, value=f'Generado: {today.isoformat()}')
    except Exception:
        pass

    bio = BytesIO()
    wb.save(bio)
    bio.seek(0)
    return bio.read()
