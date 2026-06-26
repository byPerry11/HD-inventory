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
        <h1 className="page-title flex items-center gap-2">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          Vales
        </h1>
        <p className="page-subtitle">Historial de vales registrados</p>
      </div>
      <div className="card">
        {loading ? <div className="loading-container"><div className="spinner" /></div> : (
          <table className="table">
            <thead>
              <tr><th>Recibo</th><th>Línea / Área</th><th>Fecha</th><th>Empleado</th><th>Material</th><th>Cantidad</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {vales.map(v => (
                <tr key={v.id}>
                  <td>{v.recibo_no}</td>
                  <td>
                    <div style={{fontSize: '0.85rem'}}>{v.linea_nombre}</div>
                    <div style={{fontSize: '0.75rem', color:'var(--text-muted)'}}>{v.area_nombre}</div>
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
