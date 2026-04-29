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
      item.linea, 
      item.turno, 
      item.recibio
    ].join(' ').toLowerCase()
    return text.includes(search.toLowerCase())
  })

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Historial de Movimientos</h1>
          <p className="page-subtitle">Registro global de entradas y salidas.</p>
        </div>
      </div>

      <div className="panel" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
          <div className="historial-tabs">
            <button 
              className={`tab-btn ${activeTab === 'salidas' ? 'active active-salidas' : ''}`}
              onClick={() => setActiveTab('salidas')}
            >
              📤 Salidas
            </button>
            <button 
              className={`tab-btn ${activeTab === 'entradas' ? 'active active-entradas' : ''}`}
              onClick={() => setActiveTab('entradas')}
            >
              📥 Entradas
            </button>
          </div>
          <div style={{ flex: 1 }}></div>
          <input 
            type="text" 
            className="form-control" 
            placeholder="🔍 Buscar en el historial..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', maxWidth: '350px' }}
          />
        </div>
      </div>

      <div className="panel">
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Fecha y Hora</th>
                <th>Material</th>
                <th>Cantidad</th>
                {activeTab === 'entradas' ? (
                  <>
                    <th>Proveedor</th>
                    <th>Orden</th>
                  </>
                ) : (
                  <>
                    <th>Línea / Turno</th>
                    <th>Recibió</th>
                  </>
                )}
                <th>Registró</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: 'var(--space-4)' }}>Cargando...</td></tr>
              ) : filteredData.length === 0 ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: 'var(--space-4)' }}>No se encontraron registros.</td></tr>
              ) : (
                filteredData.map(item => (
                  <tr key={item.id}>
                    <td>{new Date(item.fecha).toLocaleString()}</td>
                    <td>
                      <div><strong>{item.material_info?.code}</strong></div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{item.material_info?.name}</div>
                    </td>
                    <td><strong>{item.cantidad}</strong> <span style={{ fontSize: '0.85rem' }}>{item.material_info?.unit}</span></td>
                    {activeTab === 'entradas' ? (
                      <>
                        <td>{item.proveedor}</td>
                        <td>{item.numero_orden || '-'}</td>
                      </>
                    ) : (
                      <>
                        <td>
                          <div>{item.linea}</div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{item.turno} {item.seccion && `(${item.seccion})`}</div>
                        </td>
                        <td>{item.recibio}</td>
                      </>
                    )}
                    <td>{item.registrado_por_nombre}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
