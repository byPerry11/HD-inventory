import csv
import io
from django.db import transaction
from .models import Material, Category

# Mapeo de nombres de columnas comunes a campos del modelo
COLUMN_MAPPING = {
    'code': ['code', 'codigo', 'cod', 'id'],
    'name': ['name', 'nombre', 'descripcion corta', 'articulo'],
    'unit': ['unit', 'unidad', 'u/m', 'medida'],
    'stock_actual': ['stock_actual', 'in stock', 'stock', 'existencia', 'cantidad'],
    'ubicacion': ['ubicacion', 'location', 'estante', 'pasillo'],
    'descripcion': ['descripcion', 'description', 'detalle', 'notas'],
    'category': ['category', 'categoria', 'familia', 'grupo'],
    'barcode': ['barcode', 'codigo de barras', 'ean', 'upc'],
}

def get_field_name(header):
    """Retorna el nombre del campo del modelo basado en el encabezado del CSV."""
    clean_header = header.strip().lower()
    for field, variations in COLUMN_MAPPING.items():
        if clean_header in variations:
            return field
    return None

def parse_csv_file(file_content):
    """
    Parsea el contenido del archivo CSV y retorna una lista de diccionarios
    con los datos normalizados.
    """
    decoded_file = file_content.decode('utf-8-sig').splitlines()
    reader = csv.DictReader(decoded_file)
    
    data = []
    headers = reader.fieldnames
    
    # Crear mapa de encabezados encontrados
    header_map = {}
    for h in headers:
        field = get_field_name(h)
        if field:
            header_map[h] = field

    for row in reader:
        normalized_row = {}
        for original_header, field_name in header_map.items():
            normalized_row[field_name] = row[original_header].strip()
        
        # Validaciones mínimas antes de agregar
        if normalized_row.get('code') and normalized_row.get('name'):
            data.append(normalized_row)
            
    return data

def process_import(data):
    """
    Procesa la importación de los datos en la base de datos.
    Retorna un resumen de la operación.
    """
    stats = {
        'created': 0,
        'updated': 0,
        'errors': 0,
        'messages': []
    }

    with transaction.atomic():
        for item in data:
            try:
                code = item.pop('code')
                name = item.pop('name')
                
                # Manejo de categoría
                category_name = item.pop('category', None)
                category_obj = None
                if category_name:
                    category_obj, _ = Category.objects.get_or_create(name=category_name)
                
                # Limpiar stock_actual para que sea entero
                stock_val = item.get('stock_actual', '0')
                try:
                    item['stock_actual'] = int(float(stock_val)) if stock_val else 0
                except (ValueError, TypeError):
                    item['stock_actual'] = 0

                # Validar unidad contra choices del modelo
                unit = item.get('unit', 'pza').lower()
                valid_units = [choice[0] for choice in Material.UNIT_CHOICES]
                if unit not in valid_units:
                    # Intentar matchear por el label si no es la clave
                    matched = False
                    for key, label in Material.UNIT_CHOICES:
                        if unit == label.lower():
                            item['unit'] = key
                            matched = True
                            break
                    if not matched:
                        item['unit'] = 'pza' # Default
                else:
                    item['unit'] = unit

                obj, created = Material.objects.update_or_create(
                    code=code,
                    defaults={
                        'name': name,
                        'category': category_obj,
                        **item
                    }
                )

                if created:
                    stats['created'] += 1
                else:
                    stats['updated'] += 1

            except Exception as e:
                stats['errors'] += 1
                stats['messages'].append(f"Error en código {item.get('code', 'N/A')}: {str(e)}")
                
                raise e

    return stats
