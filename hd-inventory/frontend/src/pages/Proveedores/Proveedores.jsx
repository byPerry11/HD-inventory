import { useState, useEffect } from 'react'
import api from '../../api/client'
import { useToast } from '../../context/ToastContext'

export default function Proveedores() {
  const [proveedores, setProveedores] = useState([])
  const [loading, setLoading] = useState(true)
  const { showToast } = useToast()

  useEffect(() => {
    fetchProveedores()
  }, [])

  const fetchProveedores = async () => {
    try {
      const { data } = await api.get('/purchases/proveedores/')
      setProveedores(data.results || data)
    } catch (err) {
      showToast('Error al cargar proveedores', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="proveedores-page">
      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Proveedores</h1>
          <p className="page-subtitle">Directorio de vendedores y contactos comerciales</p>
        </div>
        <button className="btn btn-primary" onClick={() => showToast('Módulo de creación próximamente', 'info')}>
          + Nuevo Proveedor
        </button>
      </header>

      {loading ? (
        <div className="loading-container"><div className="spinner" /></div>
      ) : (
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Proveedor</th>
                  <th>Contacto</th>
                  <th>Teléfono</th>
                  <th>Email</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {proveedores.map(p => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{p.nombre}</div>
                    </td>
                    <td>{p.contacto || '—'}</td>
                    <td className="font-mono">{p.telefono || '—'}</td>
                    <td>{p.email || '—'}</td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-sm btn-secondary" title="Editar">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                        <button className="btn btn-sm btn-danger" title="Eliminar">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {proveedores.length === 0 && (
                  <tr>
                    <td colSpan="5" className="text-center" style={{ padding: 'var(--space-10)' }}>
                      No hay proveedores registrados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
