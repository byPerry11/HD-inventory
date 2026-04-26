import React from 'react'
import api from '../../api/client'

export default function ReportModal({ onClose }) {
  const handleDownload = async () => {
    try {
      const resp = await api.get('/materials/reports/chemical-inventory/', { responseType: 'blob' })
      const blob = new Blob([resp.data], { type: resp.headers['content-type'] })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      const disposition = resp.headers['content-disposition'] || ''
      let filename = 'Inventario_Quimicos.xlsx'
      if (disposition) {
        const match = /filename="?([^";]+)"?/.exec(disposition)
        if (match) filename = match[1]
      }
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Error descargando reporte', err)
      alert('Error al generar el reporte. Revisa la consola.')
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header">
          <h3>Generar reporte</h3>
        </div>
        <div className="modal-body">
          <p>Selecciona el reporte que deseas generar:</p>
          <ul>
            <li>
              <button className="btn btn-primary" onClick={handleDownload}>
                Inventario de quimicos
              </button>
            </li>
          </ul>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}
