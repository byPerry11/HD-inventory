import { useState, useEffect } from 'react'
import client from '../../api/client'
import './Historial.css'

export default function Historial() {
  const [activeTab, setActiveTab] = useState('salidas') // 'salidas' | 'entradas'
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  const fetchData = async () => {
    setLoading(true)
    try {
      // By default the endpoints return paginated lists sorted by -fecha
      const res = await client.get(`/inventory/${activeTab}/`)
      setData(res.data.results || res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Filtrado rápido por código, proveedor o turno
  const filteredData = data.filter(item => {
    const text = [
      item.material_info?.code, 
      item.material_info?.name, 
      item.registrado_por_nombre,
      item.proveedor, 
      item.linea_nombre, 
      item.area_nombre,
      item.turno, 
      item.recibio
    ].join(' ').toLowerCase()
    return text.includes(search.toLowerCase())
  })

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            Historial de Movimientos
          </h1>
          <p className="page-subtitle">Registro global de entradas y salidas.</p>
        </div>
      </div>

      <div className="card mb-6 p-4">
        <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
          <div className="historial-tabs">
            <button 
              className={`tab-btn ${activeTab === 'salidas' ? 'active active-salidas' : ''}`}
              onClick={() => setActiveTab('salidas')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
              Salidas
            </button>
            <button 
              className={`tab-btn ${activeTab === 'entradas' ? 'active active-entradas' : ''}`}
              onClick={() => setActiveTab('entradas')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
              Entradas
            </button>
          </div>
          <div style={{ flex: 1 }}></div>
          <input 
            type="text" 
            className="form-control" 
            placeholder="Buscar en el historial..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', maxWidth: '350px' }}
          />
        </div>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Fecha y Hora</th>
              <th>Material</th>
              <th className="text-right">Cantidad</th>
              {activeTab === 'entradas' ? (
                <>
                  <th>Proveedor</th>
                  <th>Orden</th>
                </>
              ) : (
                <>
                  <th>Línea / Área</th>
                  <th>Turno</th>
                  <th>Recibió</th>
                </>
              )}
              <th>Registró</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" style={{ textAlign: 'center', padding: 'var(--space-4)' }}><div className="spinner" style={{margin:'auto'}}/></td></tr>
            ) : filteredData.length === 0 ? (
              <tr><td colSpan="7" style={{ textAlign: 'center', padding: 'var(--space-4)' }}>No se encontraron registros.</td></tr>
            ) : (
              filteredData.map(item => (
                <tr key={item.id}>
                  <td className="text-muted">{new Date(item.fecha).toLocaleString()}</td>
                  <td>
                    <div><strong>{item.material_info?.code}</strong></div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{item.material_info?.name}</div>
                  </td>
                  <td className="text-right">
                    <strong>{item.cantidad}</strong> <span style={{ fontSize: '0.8rem', color:'var(--text-muted)' }}>{item.material_info?.unit}</span>
                  </td>
                  {activeTab === 'entradas' ? (
                    <>
                      <td>{item.proveedor}</td>
                      <td><span className="badge badge-secondary">{item.numero_orden || '-'}</span></td>
                    </>
                  ) : (
                    <>
                      <td>
                        <div style={{fontWeight:500}}>{item.linea_nombre}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.area_nombre || 'General'}</div>
                      </td>
                      <td><span className="badge badge-secondary">{item.turno}</span></td>
                      <td>{item.recibio}</td>
                    </>
                  )}
                  <td><span className="text-muted" style={{fontSize:'0.85rem'}}>{item.registrado_por_nombre}</span></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
