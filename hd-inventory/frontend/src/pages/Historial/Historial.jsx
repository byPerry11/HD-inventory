import { useState, useEffect, useCallback, useRef } from 'react'
import client from '../../api/client'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import ConfirmModal from '../../components/ConfirmModal'
import { Icon, SearchField } from '../../components/ui'
import './Historial.css'

const PAGE_SIZES = [25, 50, 100]
const EMPTY_FILTERS = { search: '', linea: '', turno: '' }

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

  // Draft filters — lo que el usuario escribe (NUNCA dispara búsqueda,
  // salvo limpiar la barra principal)
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  // Active filters — lo que realmente se busca (cambia solo con "Buscar"/Enter)
  const activeFiltersRef = useRef(EMPTY_FILTERS)
  // Orden por fecha: true = más recientes primero (-fecha)
  const [orderDesc, setOrderDesc] = useState(true)

  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [savingId, setSavingId] = useState(null)
  const [confirmItem, setConfirmItem] = useState(null)

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
      params.set('ordering', orderDesc ? '-fecha' : 'fecha')
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
  }, [activeTab, page, pageSize, orderDesc, notify])

  // Solo dispara fetch cuando cambia fetchKey, activeTab, page o pageSize
  useEffect(() => {
    fetchData()
  }, [fetchData, fetchKey])

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }))
  }

  const applyWith = (next) => {
    activeFiltersRef.current = { ...next }
    setPage(1)
    setFetchKey(k => k + 1)
  }

  const applyFilters = () => {
    applyWith(filters)
  }

  // La barra principal: Enter/Buscar aplica; limpiar (vaciar) muestra todo al instante
  const handleSearchChange = (value) => {
    const next = { ...filters, search: value }
    setFilters(next)
    if (!value) applyWith(next)
  }

  const toggleOrder = () => {
    setOrderDesc(d => !d)
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
    try {
      await client.delete(`/inventory/${activeTab}/${item.id}/`)
      notify.success('Registro eliminado')
      setConfirmItem(null)
      setFetchKey(k => k + 1)
    } catch (err) {
      notify.error(err.response?.data?.detail || 'Error al eliminar')
      setConfirmItem(null)
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-header-text">
          <h1 className="page-title">
            <Icon name="calendar" size={20} />
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
              <Icon name="arrowUp" size={14} />
              Salidas
            </button>
            <button
              className={`tab-btn ${activeTab === 'entradas' ? 'active active-entradas' : ''}`}
              onClick={() => { setActiveTab('entradas'); setPage(1); setFetchKey(k => k + 1) }}
            >
              <Icon name="arrowDown" size={14} />
              Entradas
            </button>
          </div>
          <span className="pagination-count">{totalCount} registros</span>
        </div>
      </div>

      {/* Búsqueda unificada — una sola barra; Enter o Buscar filtra.
          El orden por fecha vive en un solo botón de dos estados. */}
      <div className="card mb-6 p-4 historial-search-card">
        <SearchField
          value={filters.search}
          onChange={handleSearchChange}
          onSubmit={applyFilters}
          placeholder="Buscar por código, material, proveedor, orden o empleado…"
        />
        <div className="filters">
          {activeTab === 'salidas' && (
            <>
              <div className="filter-group">
                <label className="filter-label" htmlFor="hist-linea">Línea</label>
                <select
                  id="hist-linea"
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
                <label className="filter-label" htmlFor="hist-turno">Turno</label>
                <select
                  id="hist-turno"
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
          <div className="filter-group">
            <span className="filter-label" id="hist-orden-label">Orden por fecha</span>
            <button
              type="button"
              className="btn btn-secondary sort-toggle-btn"
              onClick={toggleOrder}
              aria-pressed={!orderDesc}
              aria-describedby="hist-orden-label"
              title={orderDesc ? 'Cambiar a los más antiguos primero' : 'Cambiar a los más recientes primero'}
            >
              <Icon name={orderDesc ? 'arrowDown' : 'arrowUp'} size={15} />
              {orderDesc ? 'Más recientes' : 'Más antiguos'}
            </button>
          </div>
          <div className="filter-actions">
            <button className="btn btn-primary" onClick={applyFilters}><Icon name="search" size={15} /> Buscar</button>
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
                        <button className="btn btn-danger btn-sm" onClick={() => setConfirmItem(item)}>
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
        <div className="pagination">
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
              <Icon name="chevronLeft" size={15} /> Anterior
            </button>
            <span className="pagination-page">Pág. {page} de {totalPages}</span>
            <button
              className="btn btn-secondary"
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              Siguiente <Icon name="chevronRight" size={15} />
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
              <button className="modal-close" onClick={closeEditModal} aria-label="Cerrar" title="Cerrar"><Icon name="x" size={18} /></button>
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

      <ConfirmModal
        open={!!confirmItem}
        title={`¿Eliminar ${activeTab === 'salidas' ? 'salida' : 'entrada'} #${confirmItem?.id}?`}
        message={`Se eliminará ${activeTab === 'salidas' ? 'la salida' : 'la entrada'} de ${confirmItem?.material_info?.code || 'este material'}. Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        onConfirm={() => handleDelete(confirmItem)}
        onCancel={() => setConfirmItem(null)}
      />
    </div>
  )
}
