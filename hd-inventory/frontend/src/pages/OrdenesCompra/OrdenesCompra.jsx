import { useState, useEffect } from 'react'
import api from '../../api/client'
import { useToast } from '../../context/ToastContext'
import './OrdenesCompra.css'

export default function OrdenesCompra() {
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
    vendedor: ''
  })
  
  // Confirmación de recepción
  const [showConfirmReceived, setShowConfirmReceived] = useState(false)
  const [itemsToReceive, setItemsToReceive] = useState([])
  const [pendingChanges, setPendingChanges] = useState(null)
  
  // Sugerencias de número de parte
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  const notify = useToast()

  const STATUS_COLORS = {
    'en_proceso':   { bg: 'var(--color-ordenar-bg)', fg: 'var(--color-ordenar)' },
    'ordenado':     { bg: 'rgba(31, 111, 235, 0.12)', fg: '#58a6ff' },
    'pr_aprobada':  { bg: 'rgba(210, 153, 34, 0.15)', fg: '#d2991f' },
    'po_aprobada':  { bg: 'rgba(210, 153, 34, 0.15)', fg: '#d2991f' },
    'rem_recibido': { bg: 'var(--color-ok-bg)',      fg: 'var(--color-ok)' },
    'recibido':     { bg: 'var(--color-ok-bg)',      fg: 'var(--color-ok)' },
    'cancelado':    { bg: 'var(--color-urge-bg)',    fg: 'var(--color-urge)' },
  }

  useEffect(() => {
    fetchOrdenes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchOrdenes = async () => {
    try {
      const { data } = await api.get('/purchases/ordenes/')
      // DRF devuelve paginación { count, results: [...] } o directo la lista
      setOrdenes(data.results || data)
      setLoading(false)
    } catch (err) {
      notify.error('Error al cargar las órdenes')
      setLoading(false)
    }
  }

  const toggleEditMode = () => {
    if (isEditing) {
      // Confirmar descartar cambios si no se ha guardado
      setIsEditing(false)
      setEditValues({})
    } else {
      // Iniciar edición
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
      [id]: {
        ...prev[id],
        [field]: value
      }
    }))
  }

  const handleSaveAll = async () => {
    try {
      // Filtrar solo los que realmente cambiaron para optimizar
      const cambios = []
      const aRecibir = []

      ordenes.forEach(o => {
        const edits = editValues[o.id]
        if (!edits) return
        
        let hasChanges = false
        const payload = { id: o.id }
        
        if (edits.status !== o.status) { 
          payload.status = edits.status
          hasChanges = true 
          // Si está pasando a un estado de recepción
          if (edits.status === 'recibido' || edits.status === 'rem_recibido') {
            aRecibir.push({
              no_parte: o.no_parte,
              descripcion: o.descripcion,
              cantidad: o.cantidad,
              nuevo_status: edits.status === 'recibido' ? 'Recibido' : 'REM recibida'
            })
          }
        }
        if (edits.po_number !== o.po_number) { payload.po_number = edits.po_number; hasChanges = true }
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

      // Si hay recepciones, pedir confirmación antes de enviar
      if (aRecibir.length > 0) {
        setItemsToReceive(aRecibir)
        setPendingChanges(cambios)
        setShowConfirmReceived(true)
        return
      }

      await executeUpdate(cambios)
    } catch (err) {
      notify.error('Error al guardar los cambios masivos')
    }
  }

  const executeUpdate = async (cambios) => {
    try {
      const { data } = await api.patch('/purchases/ordenes/bulk-update/', cambios)
      notify.success(`${data.actualizados} órdenes actualizadas`)
      if (data.errores?.length > 0) {
        notify.warning('Algunas órdenes tuvieron errores al guardar')
      }
      setIsEditing(false)
      setShowConfirmReceived(false)
      fetchOrdenes()
    } catch (err) {
      notify.error('Error al procesar la actualización')
    }
  }

  const handleCreateOc = async (e) => {
    e.preventDefault()
    try {
      await api.post('/purchases/ordenes/', newOc)
      notify.success('Orden de Compra creada exitosamente')
      setIsCreating(false)
      setNewOc({
        no_parte: '',
        descripcion: '',
        cantidad: 1,
        costo_unitario: 0,
        moneda: 'MXN',
        vendedor: ''
      })
      fetchOrdenes()
    } catch (err) {
      notify.error('No se pudo crear la Orden de Compra')
    }
  }

  const handlePartNumberChange = async (e) => {
    const val = e.target.value
    setNewOc(prev => ({ ...prev, no_parte: val }))
    if (val.length < 2) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }
    try {
      // DRF search para materials
      const { data } = await api.get(`/materials/?search=${val}`)
      const res = data.results || data
      setSuggestions(res.slice(0, 5)) // Solo mostrar las mejores 5 coincidencias
      setShowSuggestions(true)
    } catch (err) {
      // Fallo silencioso si falla la red en tipeo
    }
  }

  const selectSuggestion = async (mat) => {
    setNewOc(prev => ({
      ...prev,
      no_parte: mat.code,
      descripcion: mat.name
    }))
    setShowSuggestions(false)
    
    // Intenta buscar el historial de compras para ese número de parte
    try {
      const { data } = await api.get(`/purchases/ordenes/?search=${mat.code}`)
      const coincidencias = data.results || data
      
      // Filtrar coincidencias exactas y buscar la más reciente
      const historialExacto = coincidencias.filter(oc => oc.no_parte === mat.code)
      if (historialExacto.length > 0) {
        // Asumiendo que vienen por ID u ordenadas por fecha descendente
        const lastOc = historialExacto[0] 
        setNewOc(prev => ({
          ...prev,
          costo_unitario: lastOc.costo_unitario || prev.costo_unitario,
          moneda: lastOc.moneda || prev.moneda,
          vendedor: lastOc.vendedor || prev.vendedor
        }))
        notify.info('Datos de costo y proveedor recuperados')
      }
    } catch (err) {
      // fallo silencioso
    }
  }

  const formatMoney = (amount, currency) => {
    if (!amount) return '—'
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: currency || 'MXN' }).format(amount)
  }

  return (
    <div className="ordenes-view animate-fade-in">
      <header className="ordenes-header">
        <div>
          <h1 className="ordenes-title">Control de Órdenes</h1>
          <p className="ordenes-subtitle">Gestión de compras y recepciones (PO)</p>
        </div>
        <div className="ordenes-actions">
          {isEditing ? (
            <>
              <button className="btn btn-secondary" onClick={toggleEditMode}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSaveAll}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                Guardar Cambios
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-secondary" onClick={toggleEditMode}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                Editar Tabla
              </button>
              <button className="btn btn-primary" onClick={() => setIsCreating(true)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                Nueva Orden
              </button>
            </>
          )}
        </div>
      </header>

      <div className="ordenes-table-container">
        {loading ? (
          <div className="loading-state">Cargando órdenes...</div>
        ) : (
          <table className="ordenes-table">
            <thead>
              <tr>
                <th>Fecha Emisión</th>
                <th>No. Parte</th>
                <th>Descripción</th>
                <th>Cant.</th>
                <th>Costo Un.</th>
                <th>Total</th>
                <th>Status</th>
                <th>PO Number</th>
                <th>Vendedor</th>
                <th>Entrega Estim.</th>
                <th>Comentarios</th>
              </tr>
            </thead>
            <tbody>
              {ordenes.map(orden => {
                const isReceived = orden.status === 'recibido' || orden.status === 'rem_recibido'
                const isItemEditing = isEditing && editValues[orden.id] && !isReceived
                const val = isItemEditing ? editValues[orden.id] : orden

                return (
                  <tr key={orden.id} className={`orden-row--${orden.status} ${isItemEditing ? 'row-editing' : ''} ${isReceived ? 'row-locked' : ''}`}>
                    <td className="text-secondary">{orden.fecha_emision}</td>
                    <td className="fw-500">{orden.no_parte}</td>
                    <td>{orden.descripcion}</td>
                    <td className="text-center">{orden.cantidad}</td>
                    
                    {/* Costo con moneda */}
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

                    <td className="fw-500 text-right">{formatMoney(orden.costo_total, val.moneda)}</td>
                    
                    {/* Status */}
                    <td>
                      {isItemEditing ? (
                        <select
                          className="input-select"
                          value={val.status}
                          onChange={(e) => handleEditChange(orden.id, 'status', e.target.value)}
                        >
                          <option value="en_proceso">En Proceso</option>
                          <option value="ordenado">Ordenado</option>
                          <option value="pr_aprobada">PR aprobada</option>
                          <option value="po_aprobada">PO aprobada</option>
                          <option value="rem_recibido">REM recibida</option>
                          <option value="recibido">Recibido</option>
                          <option value="cancelado">Cancelado</option>
                        </select>
                      ) : (
                        <span 
                          className="status-badge" 
                          style={{ 
                            backgroundColor: STATUS_COLORS[orden.status]?.bg, 
                            color: STATUS_COLORS[orden.status]?.fg 
                          }}
                        >
                          {orden.status_label}
                        </span>
                      )}
                    </td>

                    {/* PO Number */}
                    <td>
                      {isItemEditing ? (
                        <input
                          type="text"
                          className="input-text compact"
                          value={val.po_number || ''}
                          onChange={(e) => handleEditChange(orden.id, 'po_number', e.target.value)}
                          placeholder="No. PO"
                        />
                      ) : (
                        <span>{orden.po_number || '—'}</span>
                      )}
                    </td>

                    {/* Vendedor */}
                    <td>
                      {isItemEditing ? (
                        <input
                          type="text"
                          className="input-text compact"
                          value={val.vendedor || ''}
                          onChange={(e) => handleEditChange(orden.id, 'vendedor', e.target.value)}
                          placeholder="Proveedor"
                        />
                      ) : (
                        <span>{orden.vendedor || '—'}</span>
                      )}
                    </td>

                    {/* Tiempo de entrega */}
                    <td className="text-center text-secondary">
                      {orden.tiempo_entrega_dias != null ? `${orden.tiempo_entrega_dias} días` : '—'}
                    </td>

                    {/* Comentarios */}
                    <td>
                      {isItemEditing ? (
                        <input
                          type="text"
                          className="input-text compact"
                          value={val.comentarios || ''}
                          onChange={(e) => handleEditChange(orden.id, 'comentarios', e.target.value)}
                          placeholder="Notas..."
                        />
                      ) : (
                        <span className="truncate" title={orden.comentarios}>{orden.comentarios || '—'}</span>
                      )}
                    </td>
                  </tr>
                )
              })}
              {ordenes.length === 0 && !loading && (
                <tr>
                  <td colSpan="11" className="text-center text-secondary py-4">No hay órdenes de compra registradas.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal para Crear Nueva Orden */}
      {isCreating && (
        <div className="modal-overlay" onClick={() => setIsCreating(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Emitir Nueva Orden de Compra</h2>
              <button className="btn-close" onClick={() => setIsCreating(false)}>&times;</button>
            </div>
            <form className="modal-form" onSubmit={handleCreateOc}>
              <div className="form-group" style={{ position: 'relative' }}>
                <label>Num. de Parte</label>
                <input 
                  type="text" 
                  className="input-text" 
                  autoFocus
                  required
                  value={newOc.no_parte}
                  onChange={handlePartNumberChange}
                  onFocus={() => { if(suggestions.length > 0) setShowSuggestions(true) }}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  placeholder="Ej: RES-10K"
                  autoComplete="off"
                />
                {showSuggestions && suggestions.length > 0 && (
                  <div className="suggestions-dropdown">
                    {suggestions.map(mat => (
                      <div 
                        key={mat.id} 
                        className="suggestion-item"
                        onClick={() => selectSuggestion(mat)}
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
                  type="text" 
                  className="input-text" 
                  required
                  value={newOc.descripcion}
                  onChange={e => setNewOc({...newOc, descripcion: e.target.value})}
                  placeholder="Descripción de la pieza"
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Cantidad (Uzs.)</label>
                  <input 
                    type="number" 
                    className="input-text" 
                    min="1" required
                    value={newOc.cantidad}
                    onChange={e => setNewOc({...newOc, cantidad: parseInt(e.target.value) || 1})}
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Costo Unitario</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input 
                      type="number" 
                      className="input-text" 
                      min="0" step="0.0001" required
                      value={newOc.costo_unitario}
                      style={{ flex: 1 }}
                      onChange={e => setNewOc({...newOc, costo_unitario: parseFloat(e.target.value) || 0})}
                    />
                    <select 
                      className="input-select"
                      value={newOc.moneda}
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
                <label>Vendedor / Proveedor</label>
                <input 
                  type="text" 
                  className="input-text" 
                  value={newOc.vendedor}
                  onChange={e => setNewOc({...newOc, vendedor: e.target.value})}
                  placeholder="Mouser, DigiKey, etc."
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setIsCreating(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Crear Órden
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Recepción */}
      {showConfirmReceived && (
        <div className="modal-overlay" onClick={() => setShowConfirmReceived(false)}>
          <div className="modal-content modal-content--confirm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title flex items-center gap-2">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-warning)' }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                Confirmar Recepción de Material
              </h2>
              <button className="btn-close" onClick={() => setShowConfirmReceived(false)}>&times;</button>
            </div>
            <div className="modal-body p-6">
              <p className="mb-4">Estás por marcar los siguientes materiales como <strong>recibidos</strong>. Esto sumará las cantidades al inventario actual y la orden dejará de ser editable.</p>
              
              <div className="confirm-items-list mb-6">
                {itemsToReceive.map((item, idx) => (
                  <div key={idx} className="confirm-item-row">
                    <span className="confirm-item-label">{item.nuevo_status}:</span>
                    <span className="font-mono fw-600">{item.no_parte}</span>
                    <span className="text-secondary">— {item.descripcion}</span>
                    <span className="confirm-item-qty">x{item.cantidad}</span>
                  </div>
                ))}
              </div>
              
              <p className="text-warning fw-500">¿Deseas proceder con la actualización del inventario?</p>
            </div>
            <div className="modal-actions p-6" style={{ borderTop: '1px solid var(--color-border)', backgroundColor: 'rgba(0,0,0,0.1)' }}>
              <button className="btn btn-secondary" onClick={() => setShowConfirmReceived(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={() => executeUpdate(pendingChanges)}>
                Confirmar y Recibir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
