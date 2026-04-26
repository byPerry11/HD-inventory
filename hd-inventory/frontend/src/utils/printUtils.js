/**
 * Utilidad para imprimir vales de consumo sobre un template de imagen.
 * Configurado para tamaño "Media Carta" (Half-Letter) en orientación Landscape.
 */

export const printVale = (vale) => {
  const win = window.open('', '_blank')

  // Determinamos la URL de la imagen. 
  // En desarrollo suele ser http://localhost:8000/media/...
  // Usamos una ruta relativa que funcione si el frontend y backend comparten host.
  const templateUrl = '/media/Templates/vale%20de%20salida%20template.png'

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Vale ${vale.recibo_no || ''}</title>
      <style>
        @page {
          size: 8.5in 5.5in landscape;
          margin: 0;
        }
        body {
          margin: 0;
          padding: 0;
          font-family: 'Helvetica', 'Arial', sans-serif;
          -webkit-print-color-adjust: exact;
        }
        .vale-container {
          position: relative;
          width: 8.5in;
          height: 5.5in;
          background-image: url('${templateUrl}');
          background-size: 100% 100%;
          background-repeat: no-repeat;
        }
        .field {
          position: absolute;
          font-size: 10pt;
          color: #000;
          white-space: nowrap;
        }
        /* Posiciones ajustadas según referencia visual */
        .recibo-no { top: 1.0in; right: 2.0in; font-weight: bold; font-size: 12pt; color: #d00; }
        .empl-no { top: 1.2in; left: 2.34in; }
        .empl-nombre { top: 1.20in; left: 5.6in; width: 3in; overflow: hidden; }
        .seccion { top: 1.43in; left: 2.0in; }
        .fecha { top: 1.43in; left: 5.5in; }
        
        /* Tabla de materiales - Fila 1 */
        .item-no { top: 2.07in; left: 0.93in; width: 0.4in; text-align: center; }
        .item-desc { top: 2.07in; left: 1.8in; width: 4.5in; }
        .item-cant { top: 2.08in; left: 5.7in; width: 0.7in; text-align: center; }
        .item-costo { top: 2.08in; left: 6.4in; width: 0.7in; text-align: center; }
        
        .observaciones {
          top: 3.45in;
          left: 1.9in;
          width: 6.5in;
          height: 0.6in;
          font-size: 9pt;
          white-space: normal;
          line-height: 1.2;
        }

        @media print {
          .vale-container {
            width: 8.5in;
            height: 5.5in;
          }
        }
      </style>
    </head>
    <body>
      <div class="vale-container">
        <div class="field recibo-no">${vale.recibo_no || ''}</div>
        <div class="field empl-no">${vale.empleado_no || ''}</div>
        <div class="field empl-nombre">${vale.empleado_nombre || ''}</div>
        <div class="field seccion">${vale.area_nombre || ''} / ${vale.seccion_nombre || ''}</div>
        <div class="field fecha">${new Date(vale.fecha).toLocaleDateString()}</div>
        
        <!-- Fila de material -->
        <div class="field item-no">${vale.material_info?.code || ''}</div>
        <div class="field item-desc">${vale.material_info?.name || ''}</div>
        <div class="field item-cant">${vale.cantidad || ''}</div>
        <div class="field item-costo">$${vale.costo || '0.00'}</div>
        
        <div class="field observaciones">${vale.observaciones || ''}</div>
      </div>
      <script>
        window.onload = () => {
          setTimeout(() => {
            window.print();
            // window.close(); // Opcional: cerrar tras imprimir
          }, 500);
        };
      </script>
    </body>
    </html>
  `
  win.document.write(html)
  win.document.close()
}
