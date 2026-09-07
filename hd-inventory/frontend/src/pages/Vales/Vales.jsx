import { useState, useEffect, useCallback, Fragment } from 'react'
import api from '../../api/client'
import { printVale } from '../../utils/printUtils'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import ValeModal from './ValeModal'
import ConfirmModal from '../../components/ConfirmModal'
import { Icon, SearchField } from '../../components/ui'
import './Vales.css'

const PAGE_SIZES = [25, 50, 100]

const EMPTY_FILTERS = {
  search: '',
  fecha_desde: '',
  fecha_hasta: '',
}

const FIRMAS = [
  { key: 'firma_supervisor', label: 'Supervisor', nameKey: 'firma_supervisor_nombre' },
  { key: 'firma_gerente', label: 'Gerente', nameKey: 'firma_gerente_nombre' },
  { key: 'firma_empleado', label: 'Empleado', nameKey: 'firma_empleado_nombre' },
  { key: 'firma_entrega', label: 'Quien Entrega', nameKey: 'firma_entrega_nombre' },
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
  const [deleteState, setDeleteState] = useState(null)   // { vale, returnStock }
  const [deleting, setDeleting] = useState(false)

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
    if (editId === id) {
      setEditId(null)
      setEditForm({})
    }
    setExpandedId(expandedId === id ? null : id)
  }

  const startEdit = (vale) => {
    setEditId(vale.id)
    setEditForm({
      recibo_no: vale.recibo_no || '',
      fecha: vale.fecha ? new Date(vale.fecha).toISOString().slice(0, 16) : '',
      observaciones: vale.observaciones,
      firma_supervisor: vale.firma_supervisor,
      firma_supervisor_nombre: vale.firma_supervisor_nombre || '',
      firma_gerente: vale.firma_gerente,
      firma_gerente_nombre: vale.firma_gerente_nombre || '',
      firma_empleado: vale.firma_empleado,
      firma_empleado_nombre: vale.firma_empleado_nombre || vale.empleado_nombre || '',
      firma_entrega: vale.firma_entrega,
      firma_entrega_nombre: vale.firma_entrega_nombre || '',
    })
  }

  const handleEditClick = (vale) => {
    if (expandedId !== vale.id) setExpandedId(vale.id)
    startEdit(vale)
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
    setDeleting(true)
    try {
      await api.delete(`/inventory/vales/${vale.id}/?return_stock=${deleteState.returnStock}`)
      notify.success(deleteState.returnStock ? 'Vale eliminado y materiales devueltos al stock' : 'Vale eliminado')
      setDeleteState(null)
      fetchVales()
    } catch {
      notify.error('Error al eliminar el vale')
    } finally {
      setDeleting(false)
    }
  }

  const totalPages = Math.ceil(totalCount / pageSize)

  return (
    <div>
      <div className="page-header">
        <div className="page-header-text">
          <h1 className="page-title">
            <Icon name="file" size={20} />
            Vales de Consumo
          </h1>
          <p className="page-subtitle">Historial de vales registrados</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => setShowValeModal(true)}>
            <Icon name="plus" size={15} /> Nuevo vale
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 'var(--space-3)' }}>
        <div className="filters">
          <SearchField
            label="Buscar"
            placeholder="Recibo, empleado, material..."
            value={filters.search}
            onChange={(v) => handleFilterChange('search', v)}
            width="220px"
          />
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
            <span className="pagination-count">{totalCount} vales</span>
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
                    <td>
                      {v.items && v.items.length > 0
                        ? `${v.items.length} artículo(s)`
                        : (v.material_info?.code || '—')
                      }
                    </td>
                    <td>{v.items && v.items.length > 0 ? v.items.reduce((s, i) => s + i.cantidad, 0) : v.cantidad || '—'}</td>
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
                            <button className="btn btn-sm btn-secondary" onClick={() => handleEditClick(v)}>Editar</button>
                            <button className="btn btn-sm btn-danger" onClick={() => setDeleteState({ vale: v, returnStock: true })}>Eliminar</button>
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
                                  <span className="detail-label">Línea / Área</span>
                                  <span className="detail-value">{v.linea_nombre} / {v.area_nombre}</span>
                                </div>
                                <div className="vale-detail-field">
                                  <span className="detail-label">Recibo No.</span>
                                  <input
                                    className="form-control"
                                    value={editForm.recibo_no}
                                    onChange={e => handleEditChange('recibo_no', e.target.value)}
                                    style={{ width: '160px' }}
                                  />
                                </div>
                                <div className="vale-detail-field">
                                  <span className="detail-label">Fecha</span>
                                  <input
                                    type="datetime-local"
                                    className="form-control"
                                    value={editForm.fecha}
                                    onChange={e => handleEditChange('fecha', e.target.value)}
                                  />
                                </div>
                                <div className="vale-detail-field">
                                  <span className="detail-label">Registrado por</span>
                                  <span className="detail-value">{v.registrado_por_nombre || '—'}</span>
                                </div>
                              </div>

                              {/* Items table — read-only even in edit mode */}
                              <div className="vale-detail-field" style={{ gridColumn: '1 / -1', marginTop: 8 }}>
                                <span className="detail-label">Artículos</span>
                                <table className="table" style={{ marginTop: 4 }}>
                                  <thead>
                                    <tr>
                                      <th>Código</th>
                                      <th>Nombre</th>
                                      <th>Cantidad</th>
                                      <th>Costo</th>
                                      <th>Total</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(v.items && v.items.length > 0 ? v.items : [v]).map((item, i) => {
                                      const matInfo = item.material_info || item.material
                                      const code = matInfo?.code || item.material_info?.code || '—'
                                      const name = matInfo?.name || item.material_info?.name || '—'
                                      const cant = item.cantidad || 0
                                      const cost = item.costo || 0
                                      return (
                                        <tr key={i}>
                                          <td className="font-mono">{code}</td>
                                          <td>{name}</td>
                                          <td>{cant}</td>
                                          <td>${parseFloat(cost).toFixed(2)}</td>
                                          <td>${(cant * cost).toFixed(2)}</td>
                                        </tr>
                                      )
                                    })}
                                  </tbody>
                                </table>
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

                              <div className="signature-grid">
                                {FIRMAS.map(f => (
                                  <div key={f.key} className={`signature-item ${editForm[f.key] ? 'signed' : 'pending'}`}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
                                      <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer', fontSize: '0.85rem' }}>
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
                                      {editForm[f.key] && (
                                        <input
                                          className="form-control"
                                          placeholder="Nombre de quien firma"
                                          value={editForm[f.nameKey] || ''}
                                          onChange={e => handleEditChange(f.nameKey, e.target.value)}
                                          style={{ fontSize: '0.8rem' }}
                                        />
                                      )}
                                    </div>
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
                                  <span className="detail-label">Línea / Área</span>
                                  <span className="detail-value">{v.linea_nombre} / {v.area_nombre}</span>
                                </div>
                                <div className="vale-detail-field">
                                  <span className="detail-label">Recibo No.</span>
                                  <span className="detail-value">{v.recibo_no || '—'}</span>
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
                                <div className="vale-detail-field" style={{ gridColumn: '1 / -1' }}>
                                  <span className="detail-label">Artículos</span>
                                  <table className="table" style={{ marginTop: 4 }}>
                                    <thead>
                                      <tr>
                                        <th>Código</th>
                                        <th>Nombre</th>
                                        <th>Cantidad</th>
                                        <th>Costo</th>
                                        <th>Total</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(v.items && v.items.length > 0 ? v.items : [v]).map((item, i) => {
                                        const matInfo = item.material_info || item.material
                                        const code = matInfo?.code || item.material_info?.code || '—'
                                        const name = matInfo?.name || item.material_info?.name || '—'
                                        const cant = item.cantidad || 0
                                        const cost = item.costo || 0
                                        return (
                                          <tr key={i}>
                                            <td className="font-mono">{code}</td>
                                            <td>{name}</td>
                                            <td>{cant}</td>
                                            <td>${parseFloat(cost).toFixed(2)}</td>
                                            <td>${(cant * cost).toFixed(2)}</td>
                                          </tr>
                                        )
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>

                              <div className="signature-grid">
                                {FIRMAS.map(f => (
                                  <div key={f.key} className={`signature-item ${v[f.key] ? 'signed' : 'pending'}`}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
                                      <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: '0.85rem' }}>
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
                                      {v[f.key] && v[f.nameKey] && (
                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', paddingLeft: '24px' }}>
                                          {v[f.nameKey]}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
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
        <div className="pagination">
          <span className="pagination-info">
            Página {page} de {totalPages} ({totalCount} vales)
          </span>
          <div className="pagination-controls">
            <select
              className="form-control pagination-page-size"
              value={pageSize}
              onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}
            >
              {PAGE_SIZES.map(ps => <option key={ps} value={ps}>{ps} por página</option>)}
            </select>
            <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><Icon name="chevronLeft" size={15} /> Anterior</button>
            <span className="pagination-page">{page}</span>
            <button className="btn btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Siguiente <Icon name="chevronRight" size={15} /></button>
          </div>
        </div>
      )}

      <ValeModal open={showValeModal} onClose={created => { setShowValeModal(false); if (created) fetchVales() }} />

      <ConfirmModal
        open={!!deleteState}
        title={`Eliminar Vale #${deleteState?.vale?.recibo_no || deleteState?.vale?.id || ''}`}
        message="Se eliminará el vale permanentemente."
        confirmText="Eliminar"
        loading={deleting}
        onConfirm={() => handleDelete(deleteState?.vale)}
        onCancel={() => setDeleteState(null)}
      >
        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', margin: '0 0 var(--space-4)', justifyContent: 'center', fontSize: '0.9rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={deleteState?.returnStock}
            onChange={e => setDeleteState(s => ({ ...s, returnStock: e.target.checked }))}
          />
          Devolver materiales al inventario
        </label>
      </ConfirmModal>
    </div>
  )
}
