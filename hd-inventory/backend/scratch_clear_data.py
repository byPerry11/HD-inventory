import os
import django

# Setup django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core_main_hdinventory.settings')
os.environ['DB_HOST'] = 'localhost' # Conectar al contenedor desde el host
django.setup()

from django.db import connection

def run():
    print("Limpiando columnas de sección para permitir migración de tipo...")
    with connection.cursor() as cursor:
        try:
            cursor.execute('UPDATE inventory_salida SET seccion = NULL')
            print("- inventory_salida.seccion limpiada.")
        except Exception as e:
            print(f"! Error en inventory_salida: {e}")
            
        try:
            cursor.execute('UPDATE inventory_vale SET seccion = NULL')
            print("- inventory_vale.seccion limpiada.")
        except Exception as e:
            print(f"! Error en inventory_vale: {e}")

if __name__ == '__main__':
    run()
