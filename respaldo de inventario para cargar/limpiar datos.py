import pandas as pd
import os

def generar_csv_inventario():
    # Nombres de los archivos
    excel_file = "TPV  RESPALDO  DE CONSUMIBLES Meli 2026.xlsm"
    output_csv = "inventario_personalizado.csv"
    
    # Obtener la ruta absoluta del directorio actual donde se ejecuta el script
    directorio_actual = os.path.dirname(os.path.abspath(__file__))
    
    # Rutas completas
    ruta_excel = os.path.join(directorio_actual, excel_file)
    ruta_csv = os.path.join(directorio_actual, output_csv)

    print(f"Buscando archivo en: {ruta_excel}")

    try:
        # Leer el Excel. 'header=4' salta las primeras 4 filas vacías para leer los encabezados reales
        df_excel = pd.read_excel(ruta_excel, sheet_name='inventario', header=4)
        
        # Limpiar espacios extra en los nombres de las columnas originales por precaución
        df_excel.columns = df_excel.columns.str.strip()
        
        # Crear un nuevo DataFrame estructurado
        df_nuevo = pd.DataFrame()
        
        # Mapear las columnas solicitadas
        df_nuevo['Code'] = df_excel.get('Code', '')
        df_nuevo['Name'] = df_excel.get('Name', '')
        df_nuevo['Unidad'] = df_excel.get('Unidad', '')
        df_nuevo['in stock'] = df_excel.get('In Stock', '')  # En el excel original se llama 'In Stock'
        df_nuevo['Ubicacion'] = df_excel.get('Localizacion', '') # Mapeamos 'Localizacion' a 'Ubicacion'
        
        # Eliminar filas que estén completamente vacías en la columna 'Code' (basura al final de la hoja)
        df_nuevo = df_nuevo.dropna(subset=['Code'], how='all')
        
        # Guardar el resultado en CSV (utf-8-sig evita problemas con acentos en Excel)
        df_nuevo.to_csv(ruta_csv, index=False, encoding='utf-8-sig')
        
        print(f"¡Éxito! El archivo se guardó correctamente en: \n{ruta_csv}")
        
    except FileNotFoundError:
        print(f"Error: No se encontró el archivo '{excel_file}'. Asegúrate de que esté en la misma carpeta que este script.")
    except Exception as e:
        print(f"Ocurrió un error inesperado: {e}")

# Ejecutar la función
if __name__ == "__main__":
    generar_csv_inventario()