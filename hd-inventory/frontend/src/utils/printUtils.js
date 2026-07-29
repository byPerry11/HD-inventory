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

  const items = (vale.items && vale.items.length > 0) ? vale.items : [vale]

  const rowsHtml = items.map((item, i) => {
    const matInfo = item.material_info || item.material || {}
    const code = matInfo.code || (item.material_info?.code) || ''
    const name = matInfo.name || (item.material_info?.name) || ''
    const cant = item.cantidad || ''
    const cost = item.costo || '0.00'
    const rowTop = 2.07 + i * 0.32
    return `
      <div class="field item-row" style="top: ${rowTop}in;">
        <span class="item-no">${code}</span>
        <span class="item-desc">${name}</span>
        <span class="item-cant">${cant}</span>
        <span class="item-costo">$${parseFloat(cost).toFixed(2)}</span>
      </div>
    `
  }).join('')

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
        }
        .recibo-no { top: 1.0in; right: 2.0in; font-weight: bold; font-size: 12pt; color: #d00; }
        .empl-no { top: 1.2in; left: 2.34in; }
        .empl-nombre { top: 1.20in; left: 5.6in; width: 3in; overflow: hidden; }
        .seccion { top: 1.43in; left: 2.0in; }
        .fecha { top: 1.43in; left: 5.5in; }
        
        .item-row { left: 0.5in; right: 0.3in; height: 0.28in; display: flex; align-items: center; }
        .item-no { width: 0.8in; text-align: center; display: inline-block; }
        .item-desc { width: 4.2in; display: inline-block; overflow: hidden; white-space: nowrap; }
        .item-cant { width: 0.8in; text-align: center; display: inline-block; }
        .item-costo { width: 0.7in; text-align: center; display: inline-block; }
        
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
        
        ${rowsHtml}
        
        <div class="field observaciones">${vale.observaciones || ''}</div>
      </div>
      <script>
        window.onload = () => {
          setTimeout(() => {
            window.print();
          }, 500);
        };
      </script>
    </body>
    </html>
  `
  win.document.write(html)
  win.document.close()
}
