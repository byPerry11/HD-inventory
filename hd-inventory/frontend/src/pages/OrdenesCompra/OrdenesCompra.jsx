import { useState, useEffect } from 'react'
import api from '../../api/client'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import './OrdenesCompra.css'

export default function OrdenesCompra() {
  const { user } = useAuth()
  const isCapturista = user?.role === 'capturista'
  const [ordenes, setOrdenes] = useState([])
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [editValues, setEditValues] = useState({})
  
  const [isCreating, setIsCreating] = useState(false)
  const [newOc, setNewOc] = useState({
    no_parte: '',
    descripcion: '',
    cantidad: 1,
    costo_unitario: 0,
    moneda: 'MXN',
    vendedor: '',
    no_pr: '',
    es_remision: false
  })
  
  // Paso de flujo (Modal de avance)
  const [showStepModal, setShowStepModal] = useState(false)
  const [activeStepOrden, setActiveStepOrden] = useState(null)
  const [poNumberInput, setPoNumberInput] = useState('')
  const [recibidoPorInput, setRecibidoPorInput] = useState('')
  
  // Modal de detalles
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [selectedOrden, setSelectedOrden] = useState(null)
  
  // Sugerencias de número de parte
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  const notify = useToast()

  const STATUS_COLORS = {
    'pr_creada':    { bg: 'rgba(255, 255, 255, 0.05)', fg: '#8b949e', label: 'PR Creada' },
    'pr_aprobada':  { bg: 'rgba(210, 153, 34, 0.15)', fg: '#d2991f', label: 'PR Aprobada' },
    'po_aprobada':  { bg: 'rgba(139, 148, 158, 0.15)', fg: '#8b949e', label: 'PO Aprobada' },
    'ordenado':     { bg: 'rgba(31, 111, 235, 0.12)', fg: '#58a6ff', label: 'Ordenado' },
    'recibido':     { bg: 'rgba(46, 160, 67, 0.15)',  fg: '#3fb950', label: 'Recibido' },
    'pedido_rem':   { bg: 'rgba(163, 113, 247, 0.15)', fg: '#a371f7', label: 'Pedido REM' },
    'rem_recibido': { bg: 'rgba(46, 160, 67, 0.15)',  fg: '#3fb950', label: 'REM Recibido' },
    'cancelado':    { bg: 'rgba(248, 81, 73, 0.15)',   fg: '#f85149', label: 'Cancelado' },
  }

  const FLUJO_ESTANDAR = ['pr_creada', 'pr_aprobada', 'po_aprobada', 'ordenado', 'recibido']
  const FLUJO_REM      = ['pedido_rem', 'rem_recibido']

  useEffect(() => {
    fetchOrdenes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchOrdenes = async () => {
    try {
      const { data } = await api.get('/purchases/ordenes/')
      setOrdenes(data.results || data)
      setLoading(false)
    } catch (err) {
      notify.error('Error al cargar las órdenes')
      setLoading(false)
    }
  }

  const toggleEditMode = () => {
    if (isEditing) {
      setIsEditing(false)
      setEditValues({})
    } else {
      const initialEdits = {}
      ordenes.forEach(o => {
        initialEdits[o.id] = { ...o }
      })
      setEditValues(initialEdits)
      setIsEditing(true)
    }
  }

  const handleEditChange = (id, field, value) => {
    setEditValues(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value }
    }))
  }

  const handleSaveAll = async () => {
    try {
      const cambios = []
      ordenes.forEach(o => {
        const edits = editValues[o.id]
        if (!edits) return
        
        let hasChanges = false
        const payload = { id: o.id }
        
        if (edits.po_number !== o.po_number) { payload.po_number = edits.po_number; hasChanges = true }
        if (edits.no_pr !== o.no_pr) { payload.no_pr = edits.no_pr; hasChanges = true }
        if (edits.vendedor !== o.vendedor) { payload.vendedor = edits.vendedor; hasChanges = true }
        if (edits.comentarios !== o.comentarios) { payload.comentarios = edits.comentarios; hasChanges = true }
        if (edits.moneda !== o.moneda) { payload.moneda = edits.moneda; hasChanges = true }

        if (hasChanges) cambios.push(payload)
      })

      if (cambios.length === 0) {
        notify.info('No hay cambios que guardar')
        setIsEditing(false)
        return
      }

      const { data } = await api.patch('/purchases/ordenes/bulk-update/', cambios)
      notify.success(`${data.actualizados} registros actualizados`)
      setIsEditing(false)
      fetchOrdenes()
    } catch (err) {
      notify.error('Error al guardar los cambios')
    }
  }

  const handleAdvanceStep = async () => {
    if (!activeStepOrden) return
    
    try {
      const payload = {}
      if (getNextStatus(activeStepOrden) === 'po_aprobada') {
        if (!poNumberInput) {
          notify.warning('El número de PO es requerido')
          return
        }
        payload.po_number = poNumberInput
      }
      
      if (getNextStatus(activeStepOrden) === 'recibido' || getNextStatus(activeStepOrden) === 'rem_recibido') {
        if (!recibidoPorInput) {
          notify.warning('El nombre de quien recibe es requerido')
          return
        }
        payload.recibido_por = recibidoPorInput
      }

      await api.post(`/purchases/ordenes/${activeStepOrden.id}/advance-step/`, payload)
      notify.success('Estado actualizado correctamente')
      setShowStepModal(false)
      setActiveStepOrden(null)
      setPoNumberInput('')
      setRecibidoPorInput('')
      fetchOrdenes()
    } catch (err) {
      const msg = err.response?.data?.error || 'Error al avanzar de estado'
      notify.error(msg)
    }
  }

  const handleCancelOrder = async (id) => {
    if (!window.confirm('¿Estás seguro de que deseas cancelar esta orden?')) return
    try {
      await api.post(`/purchases/ordenes/${id}/cancel/`)
      notify.success('Orden cancelada')
      fetchOrdenes()
    } catch (err) {
      notify.error(err.response?.data?.error || 'No se pudo cancelar la orden')
    }
  }

  const getNextStatus = (orden) => {
    const flujo = orden.es_remision ? FLUJO_REM : FLUJO_ESTANDAR
    const idx = flujo.indexOf(orden.status)
    if (idx !== -1 && idx < flujo.length - 1) {
      return flujo[idx + 1]
    }
    return null
  }

  const handleCreateOc = async (e) => {
    e.preventDefault()
    try {
      await api.post('/purchases/ordenes/', newOc)
      notify.success('Orden creada exitosamente')
      setIsCreating(false)
      setNewOc({
        no_parte: '', descripcion: '', cantidad: 1, 
        costo_unitario: 0, moneda: 'MXN', vendedor: '',
        no_pr: '', es_remision: false
      })
      fetchOrdenes()
    } catch (err) {
      notify.error('Error al crear la orden')
    }
  }

  const handlePartNumberChange = async (e) => {
    const val = e.target.value
    setNewOc(prev => ({ ...prev, no_parte: val }))
    if (val.length < 2) {
      setSuggestions([]); setShowSuggestions(false); return
    }
    try {
      const { data } = await api.get(`/materials/?search=${val}`)
      setSuggestions((data.results || data).slice(0, 5))
      setShowSuggestions(true)
    } catch (err) {}
  }

  const selectSuggestion = async (mat) => {
    setNewOc(prev => ({ ...prev, no_parte: mat.code, descripcion: mat.name }))
    setShowSuggestions(false)
    try {
      const { data } = await api.get(`/purchases/ordenes/?search=${mat.code}`)
      const coincidencias = (data.results || data).filter(oc => oc.no_parte === mat.code)
      if (coincidencias.length > 0) {
        const lastOc = coincidencias[0] 
        setNewOc(prev => ({
          ...prev,
          costo_unitario: lastOc.costo_unitario || prev.costo_unitario,
          moneda: lastOc.moneda || prev.moneda,
          vendedor: lastOc.vendedor || prev.vendedor
        }))
        notify.info('Historial recuperado')
      }
    } catch (err) {}
  }

  const formatMoney = (amount, currency) => {
    if (amount == null) return '—'
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: currency || 'MXN' }).format(amount)
  }

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
            Control de Órdenes
          </h1>
          <p className="page-subtitle">Flujo lineal de adquisiciones y recepciones</p>
        </div>
        <div className="page-actions" style={{ display: 'flex', gap: '8px' }}>
          {isEditing ? (
            <>
              <button className="btn btn-secondary" onClick={toggleEditMode}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSaveAll}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                Guardar Datos
              </button>
            </>
          ) : (
            <>
              {!isCapturista && (
                <>
                  <button className="btn btn-secondary" onClick={toggleEditMode}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    Editar Datos
                  </button>
                  <button className="btn btn-primary" onClick={() => setIsCreating(true)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    Nueva Orden
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <div className="table-container">
        {loading ? (
          <div className="loading-container">
            <div className="spinner" />
            <span>Cargando flujo de órdenes...</span>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Emisión</th>
                <th>No. PR</th>
                <th>No. Parte</th>
                <th>Descripción</th>
                <th>Cant.</th>
                <th>Costo Un.</th>
                <th>Total</th>
                <th>Status (Paso)</th>
                <th>No. PO</th>
                <th>Proveedor</th>
                <th>Logística</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {ordenes.map(orden => {
                const isCerrada = orden.status === 'recibido' || orden.status === 'rem_recibido' || orden.status === 'cancelado'
                const isItemEditing = isEditing && editValues[orden.id] && !isCerrada
                const val = isItemEditing ? editValues[orden.id] : orden
                const nextStep = getNextStatus(orden)

                return (
                  <tr 
                    key={orden.id} 
                    className={`orden-row--${orden.status} ${isItemEditing ? 'row-editing' : ''} ${isCerrada ? 'row-locked' : ''}`}
                    onDoubleClick={() => {
                      setSelectedOrden(orden)
                      setShowDetailsModal(true)
                    }}
                    title="Doble clic para ver detalles"
                  >
                    <td className="text-secondary" style={{ whiteSpace: 'nowrap' }}>{orden.fecha_emision}</td>
                    
                    {/* No. PR */}
                    <td>
                      {isItemEditing ? (
                        <input
                          type="text"
                          className="input-text compact"
                          value={val.no_pr || ''}
                          onChange={(e) => handleEditChange(orden.id, 'no_pr', e.target.value)}
                          placeholder="PR-XXXX"
                        />
                      ) : (
                        <span className="fw-500">{orden.no_pr || (orden.es_remision ? 'REM' : '—')}</span>
                      )}
                    </td>

                    <td className="fw-600">{orden.no_parte}</td>
                    <td><div className="truncate-2" title={orden.descripcion}>{orden.descripcion}</div></td>
                    <td className="text-center fw-600">{orden.cantidad}</td>
                    
                    <td>
                      <div className="costo-edit-group">
                        <span className="text-secondary">{formatMoney(orden.costo_unitario, val.moneda)}</span>
                        {isItemEditing && (
                          <select 
                            className="input-select compact"
                            value={val.moneda}
                            onChange={(e) => handleEditChange(orden.id, 'moneda', e.target.value)}
                          >
                            <option value="MXN">MXN</option>
                            <option value="USD">USD</option>
                          </select>
                        )}
                      </div>
                    </td>

                    <td className="fw-600 text-right">{formatMoney(orden.costo_total, val.moneda)}</td>
                    
                    {/* Status con Stepper */}
                    <td>
                      <div className="status-cell">
                        <button 
                          className={`status-badge-btn ${!nextStep || isCapturista ? 'is-final' : ''}`}
                          disabled={!nextStep || isCapturista}
                          onClick={() => {
                            setActiveStepOrden(orden)
                            setShowStepModal(true)
                          }}
                          style={{ 
                            backgroundColor: STATUS_COLORS[orden.status]?.bg, 
                            color: STATUS_COLORS[orden.status]?.fg 
                          }}
                        >
                          {STATUS_COLORS[orden.status]?.label}
                          {nextStep && !isCapturista && <span className="advance-icon">→</span>}
                        </button>

                        {(orden.status === 'recibido' || orden.status === 'rem_recibido') && orden.recibido_por && (
                          <div className="received-by-info" style={{ fontSize: '0.75rem', marginTop: '4px', opacity: 0.8, fontWeight: 500 }}>
                            Recibió: {orden.recibido_por}
                          </div>
                        )}
                        
                        <div className="mini-stepper">
                           {(orden.es_remision ? FLUJO_REM : FLUJO_ESTANDAR).map(s => (
                             <div 
                               key={s} 
                               className={`step-dot ${s === orden.status ? 'is-active' : ''} ${
                                 (orden.es_remision ? FLUJO_REM : FLUJO_ESTANDAR).indexOf(s) < (orden.es_remision ? FLUJO_REM : FLUJO_ESTANDAR).indexOf(orden.status) ? 'is-done' : ''
                               }`}
                             />
                           ))}
                        </div>
                      </div>
                    </td>

                    {/* No. PO */}
                    <td>
                      {isItemEditing ? (
                        <input
                          type="text"
                          className="input-text compact"
                          value={val.po_number || ''}
                          onChange={(e) => handleEditChange(orden.id, 'po_number', e.target.value)}
                          placeholder="PO-XXXX"
                        />
                      ) : (
                        <span className="font-mono">{orden.po_number || '—'}</span>
                      )}
                    </td>

                    <td>
                      {isItemEditing ? (
                        <input
                          type="text"
                          className="input-text compact"
                          value={val.vendedor || ''}
                          onChange={(e) => handleEditChange(orden.id, 'vendedor', e.target.value)}
                        />
                      ) : (
                        <span className="truncate">{orden.vendedor || '—'}</span>
                      )}
                    </td>

                    <td className="text-secondary text-center">
                       {orden.tiempo_entrega_dias != null ? `${orden.tiempo_entrega_dias}d` : '—'}
                    </td>

                    <td>
                      <div className="row-actions">
                        {!isCerrada && !isCapturista && (
                          <button 
                            className="btn-icon text-urge" 
                            title="Cancelar Orden"
                            onClick={() => handleCancelOrder(orden.id)}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>
                          </button>
                        )}
                        {orden.comentarios && (
                          <div className="comment-indicator" title={orden.comentarios}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal: Nueva Orden */}
      {isCreating && (
        <div className="modal-overlay" onClick={() => setIsCreating(false)}>
          <div className="modal-content modal-content--create" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Nueva Requisición / Compra</h2>
              <button className="btn-close" onClick={() => setIsCreating(false)}>&times;</button>
            </div>
            <form className="modal-form modal-form--scrollable" onSubmit={handleCreateOc}>
              <div className="form-row">
                <div className="form-group" style={{ flex: 2 }}>
                  <label>Tipo de Orden</label>
                  <div className="checkbox-group">
                    <label className="checkbox-label">
                      <input 
                        type="checkbox" 
                        checked={newOc.es_remision}
                        onChange={e => setNewOc({...newOc, es_remision: e.target.checked})}
                      />
                      Es Pedido por Remisión (REM)
                    </label>
                  </div>
                </div>
                {!newOc.es_remision && (
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>No. PR</label>
                    <input 
                      type="text" className="input-text" required
                      value={newOc.no_pr}
                      onChange={e => setNewOc({...newOc, no_pr: e.target.value})}
                      placeholder="PR-000"
                    />
                  </div>
                )}
              </div>

              <div className="form-group" style={{ position: 'relative' }}>
                <label>Número de Parte</label>
                <input 
                  type="text" className="input-text" required autoFocus
                  value={newOc.no_parte}
                  onChange={handlePartNumberChange}
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  autoComplete="off"
                />
                {showSuggestions && suggestions.length > 0 && (
                  <div className="suggestions-dropdown">
                    {suggestions.map(mat => (
                      <div 
                        key={mat.id} 
                        className="suggestion-item" 
                        onMouseDown={(e) => {
                          e.preventDefault() // Evita que el input pierda el foco antes del evento
                          selectSuggestion(mat)
                        }}
                      >
                        <span className="suggestion-code">{mat.code}</span>
                        <span className="suggestion-desc">{mat.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>Descripción</label>
                <input 
                  type="text" className="input-text" required
                  value={newOc.descripcion}
                  onChange={e => setNewOc({...newOc, descripcion: e.target.value})}
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Cantidad</label>
                  <input 
                    type="number" className="input-text" min="1" required
                    value={newOc.cantidad}
                    onChange={e => {
                      const v = e.target.value
                      setNewOc({...newOc, cantidad: v === '' ? '' : (parseInt(v) || 1)})
                    }}
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Costo Unitario</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input 
                      type="number" className="input-text" min="0" step="0.0001" required
                      value={newOc.costo_unitario} style={{ flex: 1 }}
                      onChange={e => {
                        const v = e.target.value
                        setNewOc({...newOc, costo_unitario: v === '' ? '' : (parseFloat(v) || 0)})
                      }}
                    />
                    <select 
                      className="input-select" value={newOc.moneda}
                      onChange={e => setNewOc({...newOc, moneda: e.target.value})}
                      style={{ width: '80px' }}
                    >
                      <option value="MXN">MXN</option>
                      <option value="USD">USD</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label>Proveedor Sugerido</label>
                <input 
                  type="text" className="input-text" 
                  value={newOc.vendedor}
                  onChange={e => setNewOc({...newOc, vendedor: e.target.value})}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setIsCreating(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Crear Orden</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Avance de Paso */}
      {showStepModal && activeStepOrden && (
        <div className="modal-overlay" onClick={() => setShowStepModal(false)}>
          <div className="modal-content modal-content--step" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Avance de Proceso</h2>
              <button className="btn-close" onClick={() => setShowStepModal(false)}>&times;</button>
            </div>
            <div className="modal-body p-6">
               <div className="step-transition-visual">
                  <div className="step-box current">
                    <span className="step-label">Actual</span>
                    <span className="step-name">{STATUS_COLORS[activeStepOrden.status]?.label}</span>
                  </div>
                  <div className="step-arrow">→</div>
                  <div className="step-box next">
                    <span className="step-label">Siguiente</span>
                    <span className="step-name">{STATUS_COLORS[getNextStatus(activeStepOrden)]?.label}</span>
                  </div>
               </div>

               <p className="mt-4 text-secondary">
                 ¿Deseas confirmar el avance de esta orden al siguiente paso? 
                 {getNextStatus(activeStepOrden) === 'recibido' && ' Esta acción sumará el material al inventario.'}
               </p>

                 {getNextStatus(activeStepOrden) === 'po_aprobada' && (
                  <div className="form-group mt-6">
                     <label>Ingresa el No. de PO para continuar</label>
                     <input 
                       type="text" 
                       className="input-text" 
                       placeholder="PO-XXXX"
                       autoFocus
                       value={poNumberInput}
                       onChange={e => setPoNumberInput(e.target.value)}
                     />
                  </div>
                )}

                {(getNextStatus(activeStepOrden) === 'recibido' || getNextStatus(activeStepOrden) === 'rem_recibido') && (
                  <div className="form-group mt-6">
                     <label>¿Quién recibe el material?</label>
                     <input 
                       type="text" 
                       className="input-text" 
                       placeholder="Nombre completo"
                       autoFocus
                       value={recibidoPorInput}
                       onChange={e => setRecibidoPorInput(e.target.value)}
                     />
                  </div>
                )}
            </div>
            <div className="modal-actions p-6">
              <button className="btn btn-secondary" onClick={() => setShowStepModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleAdvanceStep}>Confirmar Avance</button>
            </div>
          </div>
        </div>
      )}
      {/* Modal: Detalles de la Orden */}
      {showDetailsModal && selectedOrden && (() => {
        // Calcular tiempo total de proceso
        let tiempoTotalLabel = null
        if (selectedOrden.fecha_emision && selectedOrden.fecha_recibido) {
          const inicio = new Date(selectedOrden.fecha_emision)
          const fin = new Date(selectedOrden.fecha_recibido)
          const diffDias = Math.round((fin - inicio) / (1000 * 60 * 60 * 24))
          tiempoTotalLabel = diffDias === 0 ? 'Mismo día' : `${diffDias} día${diffDias !== 1 ? 's' : ''}`
        }

        return (
        <div className="modal-overlay" onClick={() => setShowDetailsModal(false)}>
          <div className="modal-content modal-content--details" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Detalles de la Orden #{selectedOrden.id}</h2>
              <button className="btn-close" onClick={() => setShowDetailsModal(false)}>&times;</button>
            </div>
            <div className="modal-body p-6">
              <div className="details-grid">
                <div className="details-main">
                  <div className="detail-item">
                    <label>No. Parte</label>
                    <span className="fw-600">{selectedOrden.no_parte}</span>
                  </div>
                  <div className="detail-item">
                    <label>Descripción</label>
                    <span>{selectedOrden.descripcion}</span>
                  </div>
                  <div className="detail-item">
                    <label>Cantidad</label>
                    <span>{selectedOrden.cantidad}</span>
                  </div>
                  {selectedOrden.vendedor && (
                    <div className="detail-item">
                      <label>Proveedor</label>
                      <span>{selectedOrden.vendedor}</span>
                    </div>
                  )}
                  {selectedOrden.po_number && (
                    <div className="detail-item">
                      <label>No. PO</label>
                      <span className="font-mono fw-600">{selectedOrden.po_number}</span>
                    </div>
                  )}
                  {selectedOrden.no_pr && (
                    <div className="detail-item">
                      <label>No. PR</label>
                      <span className="font-mono">{selectedOrden.no_pr}</span>
                    </div>
                  )}
                  <div className="detail-item">
                    <label>Creado por</label>
                    <span>{selectedOrden.creado_por_nombre || 'Desconocido'}</span>
                  </div>
                  {selectedOrden.recibido_por && (
                    <div className="detail-item">
                      <label>Recibido por</label>
                      <span className="text-success fw-600">{selectedOrden.recibido_por}</span>
                    </div>
                  )}
                  {tiempoTotalLabel && (
                    <div className="detail-item">
                      <label>Tiempo Total de Proceso</label>
                      <span className="fw-600" style={{ color: 'var(--color-accent)' }}>{tiempoTotalLabel}</span>
                    </div>
                  )}
                  {selectedOrden.tiempo_entrega_dias != null && (
                    <div className="detail-item">
                      <label>Lead Time (PO → Recibido)</label>
                      <span>{selectedOrden.tiempo_entrega_dias} días</span>
                    </div>
                  )}
                </div>

                <div className="details-timeline">
                  <h3 className="timeline-title">Línea de Tiempo</h3>
                  <div className="timeline-container">
                    {[
                      { key: 'fecha_emision', label: 'Emisión de Orden', status: 'pr_creada' },
                      ...(selectedOrden.es_remision ? [
                        { key: 'fecha_pr', label: 'Pedido REM', status: 'pedido_rem' },
                        { key: 'fecha_recibido', label: 'REM Recibido', status: 'rem_recibido', showRecibidoPor: true },
                      ] : [
                        { key: 'fecha_pr', label: 'PR Creada', status: 'pr_creada' },
                        { key: 'fecha_pr_aprobada', label: 'PR Aprobada', status: 'pr_aprobada' },
                        { key: 'fecha_po_aprobada', label: 'PO Aprobada', status: 'po_aprobada' },
                        { key: 'fecha_ordenado', label: 'Ordenado', status: 'ordenado' },
                        { key: 'fecha_recibido', label: 'Recibido', status: 'recibido', showRecibidoPor: true },
                      ])
                    ].map((step, idx) => {
                      const dateVal = selectedOrden[step.key]
                      const isDone = !!dateVal
                      const isCurrent = selectedOrden.status === step.status && !isDone
                      
                      return (
                        <div key={step.key} className={`timeline-step ${isDone ? 'is-done' : ''} ${isCurrent ? 'is-current' : ''}`}>
                          <div className="timeline-marker">
                            <div className="timeline-dot"></div>
                            {idx < (selectedOrden.es_remision ? 2 : 5) && <div className="timeline-line"></div>}
                          </div>
                          <div className="timeline-content">
                            <span className="timeline-label">{step.label}</span>
                            <span className="timeline-date">
                              {dateVal ? new Date(dateVal).toLocaleString('es-MX', { 
                                year: 'numeric', month: 'short', day: 'numeric', 
                                hour: '2-digit', minute: '2-digit' 
                              }) : (isCurrent ? 'En curso...' : 'Pendiente')}
                            </span>
                            {step.showRecibidoPor && selectedOrden.recibido_por && isDone && (
                              <span className="timeline-receiver">
                                Recibió: {selectedOrden.recibido_por}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-actions p-6">
              <button className="btn btn-secondary" onClick={() => setShowDetailsModal(false)}>Cerrar</button>
            </div>
          </div>
        </div>
        )
      })()}
    </div>
  )
}
