import { useEffect, useState } from 'react'
import api from '../../api/client'
import { printVale } from '../../utils/printUtils'

export default function Vales() {
  const [vales, setVales] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchVales() }, [])

  const fetchVales = async () => {
    try {
      const { data } = await api.get('/inventory/vales/?page_size=200')
      setVales(data.results || data)
    } catch (e) { /* ignore */ } finally { setLoading(false) }
  }

  const handlePrint = (vale) => {
    printVale(vale)
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">📜 Vales</h1>
        <p className="page-subtitle">Historial de vales registrados</p>
      </div>
      <div className="card">
        {loading ? <div className="loading-container"><div className="spinner" /></div> : (
          <table className="table">
            <thead>
              <tr><th>Recibo</th><th>Área / Sección</th><th>Fecha</th><th>Empleado</th><th>Material</th><th>Cantidad</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {vales.map(v => (
                <tr key={v.id}>
                  <td>{v.recibo_no}</td>
                  <td>
                    <div style={{fontSize: '0.85rem'}}>{v.area_nombre}</div>
                    <div style={{fontSize: '0.75rem', color:'var(--text-muted)'}}>{v.seccion_nombre}</div>
                  </td>
                  <td>{new Date(v.fecha).toLocaleString()}</td>
                  <td>{v.empleado_no} — {v.empleado_nombre}</td>
                  <td>{v.material_info?.code} — {v.material_info?.name}</td>
                  <td>{v.cantidad}</td>
                  <td><button className="btn" onClick={() => handlePrint(v)}>Imprimir</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
