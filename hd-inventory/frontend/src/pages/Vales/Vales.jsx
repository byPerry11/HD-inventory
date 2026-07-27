import { useState, useEffect, useCallback, Fragment } from 'react'
import api from '../../api/client'
import { printVale } from '../../utils/printUtils'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import ValeModal from './ValeModal'
import './Vales.css'

const PAGE_SIZES = [25, 50, 100]

const EMPTY_FILTERS = {
  search: '',
  fecha_desde: '',
  fecha_hasta: '',
}

const FIRMAS = [
  { key: 'firma_supervisor', label: 'Supervisor' },
  { key: 'firma_gerente', label: 'Gerente' },
  { key: 'firma_empleado', label: 'Empleado' },
  { key: 'firma_entrega', label: 'Quien Entrega' },
]

export default function Vales() {
  const { user } = useAuth()
  const notify = useToast()
  const canEdit = user?.role === 'manager' || user?.role === 'supervisor'

  const [vales, setVales] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [expandedId, setExpandedId] = useState(null)
  const [editId, setEditId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [showValeModal, setShowValeModal] = useState(false)

  const buildParams = useCallback(() => {
    const params = new URLSearchParams()
    params.set('page', page)
    params.set('page_size', pageSize)
    if (filters.search) params.set('search', filters.search)
    if (filters.fecha_desde) params.set('fecha_desde', filters.fecha_desde)
    if (filters.fecha_hasta) params.set('fecha_hasta', filters.fecha_hasta)
    return params.toString()
  }, [page, pageSize, filters])

  const fetchVales = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get(`/inventory/vales/?${buildParams()}`)
      setVales(data.results || data)
      setTotalCount(data.count || 0)
    } catch { /* ignore */ } finally { setLoading(false) }
  }, [buildParams])

  useEffect(() => { fetchVales() }, [fetchVales])

  const handleFilterChange = (key, value) => {
    setFilters(f => ({ ...f, [key]: value }))
    setPage(1)
  }

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS)
    setPage(1)
  }

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id)
    setEditId(null)
    setEditForm({})
  }

  const startEdit = (vale) => {
    setEditId(vale.id)
    setEditForm({
      cantidad: vale.cantidad,
      observaciones: vale.observaciones,
      firma_supervisor: vale.firma_supervisor,
      firma_gerente: vale.firma_gerente,
      firma_empleado: vale.firma_empleado,
      firma_entrega: vale.firma_entrega,
    })
  }

  const cancelEdit = () => {
    setEditId(null)
    setEditForm({})
  }

  const handleEditChange = (key, value) => {
    setEditForm(f => ({ ...f, [key]: value }))
  }

  const saveEdit = async (valeId) => {
    try {
      await api.patch(`/inventory/vales/${valeId}/`, editForm)
      notify.success('Vale actualizado')
      setEditId(null)
      setEditForm({})
      fetchVales()
    } catch {
      notify.error('Error al actualizar el vale')
    }
  }

  const handleDelete = async (vale) => {
    if (!window.confirm(`¿Eliminar Vale #${vale.recibo_no || vale.id}?`)) return
    try {
      await api.delete(`/inventory/vales/${vale.id}/`)
      notify.success('Vale eliminado')
      fetchVales()
    } catch {
      notify.error('Error al eliminar el vale')
    }
  }

  const totalPages = Math.ceil(totalCount / pageSize)

  return (
    <div>
      <div className="page-header">
        <div className="vales-toolbar">
          <h1 className="page-title flex items-center gap-2" style={{ margin: 0 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            Vales de Consumo
          </h1>
          <button className="btn btn-primary" onClick={() => setShowValeModal(true)}>
            + Nuevo Vale
          </button>
        </div>
        <p className="page-subtitle">Historial de vales registrados</p>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 'var(--space-3)' }}>
        <div className="vales-filters">
          <div className="filter-group">
            <label className="filter-label">Buscar</label>
            <input
              className="form-control"
              placeholder="Recibo, empleado, material..."
              value={filters.search}
              onChange={e => handleFilterChange('search', e.target.value)}
              style={{ width: '220px' }}
            />
          </div>
          <div className="filter-group">
            <label className="filter-label">Desde</label>
            <input
              type="datetime-local"
              className="form-control"
              value={filters.fecha_desde}
              onChange={e => handleFilterChange('fecha_desde', e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label className="filter-label">Hasta</label>
            <input
              type="datetime-local"
              className="form-control"
              value={filters.fecha_hasta}
              onChange={e => handleFilterChange('fecha_hasta', e.target.value)}
            />
          </div>
          <div className="filter-actions">
            <button className="btn btn-secondary" onClick={clearFilters}>
              Limpiar
            </button>
          </div>
          <div className="filter-actions" style={{ marginLeft: 'auto' }}>
            <span className="pagination-count-badge">{totalCount} vales</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        {loading ? <div className="loading-container"><div className="spinner" /></div> : (
          <table className="table">
            <thead>
              <tr>
                <th>Recibo</th>
                <th>Fecha</th>
                <th>Empleado</th>
                <th>Material</th>
                <th>Cantidad</th>
                <th>Firmas</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {vales.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No se encontraron vales</td></tr>
              )}
              {vales.map(v => (
                <Fragment key={v.id}>
                  <tr className="vale-row" onClick={() => toggleExpand(v.id)}>
                    <td><strong>{v.recibo_no || '—'}</strong></td>
                    <td>{new Date(v.fecha).toLocaleString()}</td>
                    <td>{v.empleado_no} — {v.empleado_nombre}</td>
                    <td>{v.material_info?.code} — {v.material_info?.name}</td>
                    <td>{v.cantidad}</td>
                    <td>
                      <span style={{ fontSize: '0.75rem' }}>
                        {[v.firma_supervisor, v.firma_gerente, v.firma_empleado, v.firma_entrega].filter(Boolean).length}/4
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                        <button className="btn btn-sm" onClick={() => printVale(v)}>Imprimir</button>
                        {canEdit && (
                          <>
                            <button className="btn btn-sm btn-secondary" onClick={() => startEdit(v)}>Editar</button>
                            <button className="btn btn-sm btn-danger" onClick={() => handleDelete(v)}>Eliminar</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expandedId === v.id && (
                    <tr className="vale-detail-row">
                      <td colSpan={7}>
                        <div className="vale-detail">
                          {editId === v.id ? (
                            /* Edit mode */
                            <div>
                              <div className="vale-detail-grid">
                                <div className="vale-detail-field">
                                  <span className="detail-label">Empleado</span>
                                  <span className="detail-value">{v.empleado_no} — {v.empleado_nombre}</span>
                                </div>
                                <div className="vale-detail-field">
                                  <span className="detail-label">Material</span>
                                  <span className="detail-value">{v.material_info?.code} — {v.material_info?.name}</span>
                                </div>
                                <div className="vale-detail-field">
                                  <span className="detail-label">Línea / Área</span>
                                  <span className="detail-value">{v.linea_nombre} / {v.area_nombre}</span>
                                </div>
                                <div className="vale-detail-field">
                                  <span className="detail-label">Recibo No.</span>
                                  <span className="detail-value">{v.recibo_no || '—'}</span>
                                </div>
                                <div className="vale-detail-field">
                                  <span className="detail-label">Cantidad</span>
                                  <input
                                    type="number"
                                    className="form-control"
                                    min="1"
                                    value={editForm.cantidad}
                                    onChange={e => handleEditChange('cantidad', e.target.value)}
                                    style={{ width: '100px' }}
                                  />
                                </div>
                                <div className="vale-detail-field">
                                  <span className="detail-label">Costo</span>
                                  <span className="detail-value">${v.costo}</span>
                                </div>
                                <div className="vale-detail-field" style={{ gridColumn: '1 / -1' }}>
                                  <span className="detail-label">Observaciones</span>
                                  <textarea
                                    className="form-control"
                                    rows={2}
                                    value={editForm.observaciones}
                                    onChange={e => handleEditChange('observaciones', e.target.value)}
                                  />
                                </div>
                              </div>

                              <div className="signature-grid">
                                {FIRMAS.map(f => (
                                  <div key={f.key} className={`signature-item ${editForm[f.key] ? 'signed' : 'pending'}`}>
                                    <label>
                                      <input
                                        type="checkbox"
                                        checked={editForm[f.key]}
                                        onChange={e => handleEditChange(f.key, e.target.checked)}
                                      />
                                      {f.label}
                                      <span className="signature-status">
                                        {editForm[f.key] ? 'Firmado' : 'Pendiente'}
                                      </span>
                                    </label>
                                  </div>
                                ))}
                              </div>

                              <div className="detail-actions">
                                <button className="btn btn-primary" onClick={() => saveEdit(v.id)}>Guardar</button>
                                <button className="btn btn-secondary" onClick={cancelEdit}>Cancelar</button>
                              </div>
                            </div>
                          ) : (
                            /* View mode */
                            <div>
                              <div className="vale-detail-grid">
                                <div className="vale-detail-field">
                                  <span className="detail-label">Empleado</span>
                                  <span className="detail-value">{v.empleado_no} — {v.empleado_nombre}</span>
                                </div>
                                <div className="vale-detail-field">
                                  <span className="detail-label">Material</span>
                                  <span className="detail-value">{v.material_info?.code} — {v.material_info?.name}</span>
                                </div>
                                <div className="vale-detail-field">
                                  <span className="detail-label">Línea / Área</span>
                                  <span className="detail-value">{v.linea_nombre} / {v.area_nombre}</span>
                                </div>
                                <div className="vale-detail-field">
                                  <span className="detail-label">Recibo No.</span>
                                  <span className="detail-value">{v.recibo_no || '—'}</span>
                                </div>
                                <div className="vale-detail-field">
                                  <span className="detail-label">Cantidad</span>
                                  <span className="detail-value">{v.cantidad}</span>
                                </div>
                                <div className="vale-detail-field">
                                  <span className="detail-label">Costo</span>
                                  <span className="detail-value">${v.costo}</span>
                                </div>
                                <div className="vale-detail-field">
                                  <span className="detail-label">Fecha</span>
                                  <span className="detail-value">{new Date(v.fecha).toLocaleString()}</span>
                                </div>
                                <div className="vale-detail-field">
                                  <span className="detail-label">Registrado por</span>
                                  <span className="detail-value">{v.registrado_por_nombre || '—'}</span>
                                </div>
                                {v.observaciones && (
                                  <div className="vale-detail-field" style={{ gridColumn: '1 / -1' }}>
                                    <span className="detail-label">Observaciones</span>
                                    <span className="detail-value">{v.observaciones}</span>
                                  </div>
                                )}
                              </div>

                              <div className="signature-grid">
                                {FIRMAS.map(f => (
                                  <div key={f.key} className={`signature-item ${v[f.key] ? 'signed' : 'pending'}`}>
                                    <label>
                                      <input
                                        type="checkbox"
                                        checked={v[f.key]}
                                        disabled
                                      />
                                      {f.label}
                                      <span className="signature-status">
                                        {v[f.key] ? 'Firmado' : 'Pendiente'}
                                      </span>
                                    </label>
                                  </div>
                                ))}
                              </div>

                              {canEdit && (
                                <div className="detail-actions">
                                  <button className="btn btn-sm btn-secondary" onClick={() => startEdit(v)}>Editar</button>
                                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(v)}>Eliminar</button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalCount > 0 && (
        <div className="vales-pagination">
          <div className="pagination-info">
            Página {page} de {totalPages} ({totalCount} vales)
          </div>
          <div className="pagination-controls">
            <select
              className="form-control"
              value={pageSize}
              onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}
              style={{ width: 'auto' }}
            >
              {PAGE_SIZES.map(ps => <option key={ps} value={ps}>{ps} por página</option>)}
            </select>
            <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</button>
            <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{page}</span>
            <button className="btn btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Siguiente</button>
          </div>
        </div>
      )}

      <ValeModal open={showValeModal} onClose={created => { setShowValeModal(false); if (created) fetchVales() }} />
    </div>
  )
}
