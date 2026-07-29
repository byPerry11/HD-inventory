import { useState, useEffect, useCallback, useRef } from 'react'
import client from '../../api/client'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import './Historial.css'

const PAGE_SIZES = [25, 50, 100]
const EMPTY_FILTERS = { fecha_desde: '', fecha_hasta: '', codigo: '', linea: '', turno: '' }

export default function Historial() {
  const { user } = useAuth()
  const notify = useToast()

  const [activeTab, setActiveTab] = useState('salidas')
  const [data, setData] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [loading, setLoading] = useState(false)
  const [choiceData, setChoiceData] = useState({ lineas: [], areas: [], turnos: [] })

  // Draft filters — lo que el usuario escribe (NUNCA dispara búsqueda)
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  // Active filters — lo que realmente se busca (cambia solo con "Buscar")
  const activeFiltersRef = useRef(EMPTY_FILTERS)

  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [savingId, setSavingId] = useState(null)

  // Contador que incrementa al aplicar filtros o cambiar página
  const [fetchKey, setFetchKey] = useState(0)

  const fetchChoices = useCallback(async () => {
    try {
      const res = await client.get('/inventory/salidas/choices/')
      setChoiceData(res.data || { lineas: [], areas: [], turnos: [] })
    } catch {
      setChoiceData({ lineas: [], areas: [], turnos: [] })
    }
  }, [])

  useEffect(() => { fetchChoices() }, [fetchChoices])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', page)
      params.set('page_size', pageSize)
      Object.entries(activeFiltersRef.current).forEach(([k, v]) => {
        if (v) params.set(k, v)
      })
      const res = await client.get(`/inventory/${activeTab}/?${params}`)
      setData(res.data.results || [])
      setTotalCount(res.data.count || 0)
    } catch (err) {
      console.error(err)
      notify.error('Error al cargar historial')
    } finally {
      setLoading(false)
    }
  }, [activeTab, page, pageSize, notify])

  // Solo dispara fetch cuando cambia fetchKey, activeTab, page o pageSize
  useEffect(() => {
    fetchData()
  }, [fetchData, fetchKey])

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }))
  }

  const applyFilters = () => {
    activeFiltersRef.current = { ...filters }
    setPage(1)
    setFetchKey(k => k + 1)
  }

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS)
    activeFiltersRef.current = { ...EMPTY_FILTERS }
    setPage(1)
    setFetchKey(k => k + 1)
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  const openEditModal = async (item) => {
    setSelectedItem(item)
    setEditForm({
      cantidad: item.cantidad || 0,
      linea: item.linea || '',
      area: item.area || '',
      turno: item.turno || '1st Shift',
      empleado_no: item.empleado_no || '',
      recibio: item.recibio || '',
      observaciones: item.observaciones || ''
    })
    setShowEditModal(true)
  }

  const closeEditModal = () => {
    setShowEditModal(false)
    setSelectedItem(null)
    setEditForm({})
  }

  const handleEditFieldChange = (field, value) => {
    setEditForm(prev => ({ ...prev, [field]: value }))
  }

  const saveEdit = async (event) => {
    event.preventDefault()
    if (!selectedItem) return
    try {
      setSavingId(selectedItem.id)
      await client.patch(`/inventory/salidas/${selectedItem.id}/`, {
        cantidad: editForm.cantidad,
        linea: editForm.linea,
        area: editForm.area,
        turno: editForm.turno,
        empleado_no: editForm.empleado_no,
        recibio: editForm.recibio,
        observaciones: editForm.observaciones
      })
      notify.success('Salida actualizada correctamente')
      closeEditModal()
      setFetchKey(k => k + 1)
    } catch (err) {
      notify.error(err.response?.data?.detail || 'No se pudo actualizar la salida')
    } finally {
      setSavingId(null)
    }
  }

  const handleDelete = async (item) => {
    if (!window.confirm(`¿Eliminar salida #${item.id} de ${item.material_info?.code}?`)) return
    try {
      await client.delete(`/inventory/${activeTab}/${item.id}/`)
      notify.success('Registro eliminado')
      setFetchKey(k => k + 1)
    } catch (err) {
      notify.error(err.response?.data?.detail || 'Error al eliminar')
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            Historial de Movimientos
          </h1>
          <p className="page-subtitle">Consulta, filtra y edita el registro de entradas y salidas.</p>
        </div>
      </div>

      {/* Tabs + total */}
      <div className="historial-toolbar card mb-6 p-4">
        <div className="historial-toolbar-row">
          <div className="historial-tabs">
            <button
              className={`tab-btn ${activeTab === 'salidas' ? 'active active-salidas' : ''}`}
              onClick={() => { setActiveTab('salidas'); setPage(1); setFetchKey(k => k + 1) }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
              Salidas
            </button>
            <button
              className={`tab-btn ${activeTab === 'entradas' ? 'active active-entradas' : ''}`}
              onClick={() => { setActiveTab('entradas'); setPage(1); setFetchKey(k => k + 1) }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
              Entradas
            </button>
          </div>
          <span className="pagination-count-badge">{totalCount} registros</span>
        </div>
      </div>

      {/* Filtros — SOLO disparan búsqueda con el botón Buscar o Enter */}
      <div className="card mb-6 p-4">
        <div className="historial-filters">
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
          <div className="filter-group">
            <label className="filter-label">Código / Parte</label>
            <input
              type="text"
              className="form-control"
              placeholder="Ej: S-14938NAT"
              value={filters.codigo}
              onChange={e => handleFilterChange('codigo', e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') applyFilters() }}
            />
          </div>
          {activeTab === 'salidas' && (
            <>
              <div className="filter-group">
                <label className="filter-label">Línea</label>
                <select
                  className="form-control"
                  value={filters.linea}
                  onChange={e => handleFilterChange('linea', e.target.value)}
                >
                  <option value="">Todas</option>
                  {choiceData.lineas?.map(l => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </div>
              <div className="filter-group">
                <label className="filter-label">Turno</label>
                <select
                  className="form-control"
                  value={filters.turno}
                  onChange={e => handleFilterChange('turno', e.target.value)}
                >
                  <option value="">Todos</option>
                  {choiceData.turnos?.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </>
          )}
          <div className="filter-actions">
            <button className="btn btn-primary" onClick={applyFilters}>Buscar</button>
            <button className="btn btn-secondary" onClick={clearFilters}>Limpiar</button>
          </div>
        </div>
      </div>

      {/* Tabla */}
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
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="8" style={{ textAlign: 'center', padding: 'var(--space-4)' }}><div className="spinner" style={{margin:'auto'}}/></td></tr>
            ) : data.length === 0 ? (
              <tr><td colSpan="8" style={{ textAlign: 'center', padding: 'var(--space-4)' }}>No se encontraron registros con los filtros actuales.</td></tr>
            ) : (
              data.map(item => (
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
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {activeTab === 'salidas' && user && (
                        <button className="btn btn-secondary btn-sm" onClick={() => openEditModal(item)}>
                          Editar
                        </button>
                      )}
                      {(user?.role === 'manager' || user?.role === 'supervisor') && (
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(item)}>
                          Eliminar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {totalCount > pageSize && (
        <div className="historial-pagination">
          <span className="pagination-info">
            Mostrando {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, totalCount)} de {totalCount} registros
          </span>
          <div className="pagination-controls">
            <select
              className="form-control pagination-page-size"
              value={pageSize}
              onChange={e => { setPageSize(Number(e.target.value)); setPage(1); setFetchKey(k => k + 1) }}
            >
              {PAGE_SIZES.map(ps => (
                <option key={ps} value={ps}>{ps} por página</option>
              ))}
            </select>
            <button
              className="btn btn-secondary"
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              &laquo; Anterior
            </button>
            <span className="pagination-page">Pág. {page} de {totalPages}</span>
            <button
              className="btn btn-secondary"
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              Siguiente &raquo;
            </button>
          </div>
        </div>
      )}

      {/* Modal editar salida */}
      {showEditModal && selectedItem && (
        <div className="modal-backdrop" onClick={closeEditModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ margin: 0 }}>Editar salida #{selectedItem.id}</h2>
              <button className="modal-close" onClick={closeEditModal}>×</button>
            </div>
            <form className="modal-body" onSubmit={saveEdit}>
              <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Cantidad</label>
                  <input
                    type="number"
                    className="form-control"
                    min="1"
                    value={editForm.cantidad || 0}
                    onChange={e => handleEditFieldChange('cantidad', Number(e.target.value))}
                    required
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Turno</label>
                  <select
                    className="form-control"
                    value={editForm.turno || '1st Shift'}
                    onChange={e => handleEditFieldChange('turno', e.target.value)}
                  >
                    {choiceData.turnos?.length > 0 ? (
                      choiceData.turnos.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))
                    ) : (
                      <>
                        <option value="1st Shift">1st Shift</option>
                        <option value="2nd Shift">2nd Shift</option>
                        <option value="3rd Shift">3rd Shift</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Línea</label>
                  <select
                    className="form-control"
                    value={editForm.linea || ''}
                    onChange={e => handleEditFieldChange('linea', e.target.value)}
                  >
                    <option value="">Selecciona una línea</option>
                    {choiceData.lineas?.map(linea => (
                      <option key={linea.value} value={linea.value}>{linea.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Área</label>
                  <select
                    className="form-control"
                    value={editForm.area || ''}
                    onChange={e => handleEditFieldChange('area', e.target.value)}
                  >
                    <option value="">Selecciona un área</option>
                    {choiceData.areas
                      ?.filter(area => !editForm.linea || area.linea === Number(editForm.linea))
                      .map(area => (
                        <option key={area.value} value={area.value}>{area.label}</option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label>No. de empleado</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editForm.empleado_no || ''}
                    onChange={e => handleEditFieldChange('empleado_no', e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Recibió</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editForm.recibio || ''}
                    onChange={e => handleEditFieldChange('recibio', e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Observaciones</label>
                <textarea
                  className="form-control"
                  rows="3"
                  value={editForm.observaciones || ''}
                  onChange={e => handleEditFieldChange('observaciones', e.target.value)}
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeEditModal}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={savingId === selectedItem.id}>
                  {savingId === selectedItem.id ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
