import { useState, useEffect, useRef } from 'react'
import api from '../../api/client'
import { cleanBadgeID } from '../../utils/formatters'
import { useToast } from '../../context/ToastContext'
import { Icon } from '../../components/ui'

const EMPTY_ITEM = { material: '', search: '', selected: null, cantidad: '1', costo: '0' }

const FIRMAS = [
  { key: 'firma_supervisor', label: 'Supervisor', nameKey: 'firma_supervisor_nombre' },
  { key: 'firma_gerente', label: 'Gerente', nameKey: 'firma_gerente_nombre' },
  { key: 'firma_empleado', label: 'Empleado', nameKey: 'firma_empleado_nombre' },
  { key: 'firma_entrega', label: 'Quien Entrega', nameKey: 'firma_entrega_nombre' },
]

const EMPTY_FORM = {
  empleado_no: '', empleado_nombre: '', linea: '', area: '', observaciones: '',
}

export default function ValeModal({ open, onClose, preselectedMaterial }) {
  const notify = useToast()
  const [form, setForm] = useState(EMPTY_FORM)
  const [items, setItems] = useState([{ ...EMPTY_ITEM }])
  const [choices, setChoices] = useState({ lineas: [], areas: [], turnos: [] })
  const [filteredAreas, setFilteredAreas] = useState([])
  const [signatures, setSignatures] = useState({})
  const [loading, setLoading] = useState(false)
  const [searchResults, setSearchResults] = useState({})
  const searchTimer = useRef({})

  useEffect(() => {
    if (open) {
      setForm(EMPTY_FORM)
      setItems([{ ...EMPTY_ITEM }])
      setSignatures({})
      setSearchResults({})
      fetchChoices()
    }
  }, [open])

  useEffect(() => {
    if (preselectedMaterial) {
      const newItem = {
        material: preselectedMaterial.id,
        search: preselectedMaterial.code + ' — ' + preselectedMaterial.name,
        selected: preselectedMaterial,
        cantidad: '1',
        costo: preselectedMaterial.costo || '0',
      }
      setItems([newItem])
    }
  }, [preselectedMaterial])

  const fetchChoices = async () => {
    try {
      const { data } = await api.get('/inventory/salidas/choices/')
      setChoices(data)
    } catch (e) { console.error('Error fetching choices', e) }
  }

  useEffect(() => {
    if (form.linea) {
      const filtered = choices.areas.filter(a => a.linea === parseInt(form.linea))
      setFilteredAreas(filtered)
      if (form.area && !filtered.find(a => a.value === parseInt(form.area))) {
        setForm(f => ({ ...f, area: '' }))
      }
    } else {
      setFilteredAreas([])
      setForm(f => ({ ...f, area: '' }))
    }
  }, [form.linea, choices.areas])

  const lookupEmpleado = async (numero) => {
    try {
      const { data } = await api.get(`/inventory/empleados/?numero=${numero}`)
      const results = data.results || data
      if (results.length > 0) {
        setForm(f => ({ ...f, empleado_nombre: results[0].nombre }))
      }
    } catch (err) { console.error('Error buscando empleado:', err) }
  }

  const handleFormChange = (name, value) => {
    if (name === 'empleado_no') {
      const cleaned = cleanBadgeID(value)
      setForm(f => ({ ...f, empleado_no: cleaned }))
      if (cleaned.length >= 4) lookupEmpleado(cleaned)
    } else if (name === 'empleado_nombre') {
      setForm(f => ({ ...f, empleado_nombre: value }))
      if (value && !signatures.firma_empleado_nombre) {
        setSignatures(s => ({ ...s, firma_empleado_nombre: value }))
      }
    } else {
      setForm(f => ({ ...f, [name]: value }))
    }
  }

  const handleSignatureChange = (key, value) => {
    setSignatures(s => ({ ...s, [key]: value }))
  }

  const fetchMaterials = async (q, idx) => {
    if (!q) { setSearchResults(s => ({ ...s, [idx]: [] })); return }
    try {
      const { data } = await api.get(`/materials/?search=${encodeURIComponent(q)}&page_size=10`)
      setSearchResults(s => ({ ...s, [idx]: data.results || data }))
    } catch { /* ignore */ }
  }

  const doSearch = (q, idx) => {
    if (searchTimer.current[idx]) clearTimeout(searchTimer.current[idx])
    searchTimer.current[idx] = setTimeout(() => fetchMaterials(q, idx), 300)
  }

  const handleItemChange = (idx, field, value) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  const handleMaterialSearch = (idx, value) => {
    setItems(prev => prev.map((item, i) =>
      i === idx ? { ...item, search: value, material: '', selected: null } : item
    ))
    doSearch(value, idx)
  }

  const selectMaterial = (idx, m) => {
    setItems(prev => prev.map((item, i) =>
      i === idx ? { ...item, material: m.id, search: m.code + ' — ' + m.name, selected: m, costo: m.costo || '0' } : item
    ))
    setSearchResults(s => ({ ...s, [idx]: [] }))
  }

  const addItem = () => {
    setItems(prev => [...prev, { ...EMPTY_ITEM }])
  }

  const removeItem = (idx) => {
    if (items.length <= 1) return
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const validItems = items.filter(i => i.material)
    if (validItems.length === 0) {
      notify.error('Agrega al menos un material al vale.')
      return
    }
    setLoading(true)
    try {
      await api.post('/inventory/vales/', {
        ...form,
        ...signatures,
        items: validItems.map(i => ({ material: i.material, cantidad: parseInt(i.cantidad) || 1, costo: parseFloat(i.costo) || 0 })),
      })
      notify.success('Vale creado correctamente')
      onClose(true)
    } catch (err) {
      notify.error('Error creando el vale')
    } finally { setLoading(false) }
  }

  if (!open) return null

  return (
    <div className="modal-backdrop" onClick={() => onClose(false)}>
      <div className="modal-content modal-content--wide" onClick={e => e.stopPropagation()}>
        <header className="modal-header">
          <h2 className="flex items-center gap-2" style={{ fontSize: '1.25rem', fontWeight: 600 }}>
            <Icon name="file" size={20} />
            Crear Vale de Consumo
          </h2>
          <button className="modal-close" onClick={() => onClose(false)} aria-label="Cerrar" title="Cerrar"><Icon name="x" size={18} /></button>
        </header>

        <form onSubmit={handleSubmit} className="modal-body">
          {/* Empleado */}
          <div className="salidas-row">
            <div className="form-group">
              <label className="form-label">No. Empleado *</label>
              <input className="form-control" placeholder="Ej. 12140"
                value={form.empleado_no} onChange={e => handleFormChange('empleado_no', e.target.value)} required />
            </div>
            <div className="form-group" style={{ flex: 1.5 }}>
              <label className="form-label">Nombre del Empleado *</label>
              <input className="form-control" placeholder="Nombre completo..."
                value={form.empleado_nombre} onChange={e => handleFormChange('empleado_nombre', e.target.value)} required />
            </div>
          </div>

          {/* Línea + Área */}
          <div className="salidas-row">
            <div className="form-group">
              <label className="form-label">Línea *</label>
              <select className="form-control" value={form.linea}
                onChange={e => handleFormChange('linea', e.target.value)} required>
                <option value="">— Seleccionar —</option>
                {choices.lineas.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Área *</label>
              <select className="form-control" value={form.area}
                onChange={e => handleFormChange('area', e.target.value)} required
                disabled={!form.linea}>
                <option value="">— Seleccionar —</option>
                {filteredAreas.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </div>
          </div>

          {/* Artículos */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
              <label className="form-label" style={{ margin: 0 }}>Artículos</label>
              <button type="button" className="btn btn-sm btn-primary" onClick={addItem}><Icon name="plus" size={14} /> Agregar otro</button>
            </div>

            {items.map((item, idx) => (
              <div key={idx} className="card" style={{ padding: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-1)' }}>
                  <strong style={{ fontSize: '0.85rem' }}>Artículo #{idx + 1}</strong>
                  {items.length > 1 && (
                    <button type="button" className="btn btn-sm btn-danger" onClick={() => removeItem(idx)}>Eliminar</button>
                  )}
                </div>

                <div className="form-group" style={{ marginBottom: 'var(--space-2)' }}>
                  <label className="form-label">Material *</label>
                  <div className="material-search-wrapper">
                    <input className="form-control" placeholder="Código o nombre..."
                      value={item.search} onChange={e => handleMaterialSearch(idx, e.target.value)} />
                    {item.search && !item.selected && (searchResults[idx] || []).length > 0 && (
                      <ul className="material-dropdown">
                        {(searchResults[idx] || []).slice(0, 8).map(m => (
                          <li key={m.id} className="material-option" onClick={() => selectMaterial(idx, m)}>
                            <span className="font-mono">{m.code}</span>
                            <span className="text-muted"> — {m.name}</span>
                            <span className={`badge badge-${m.estado} ml-auto`}>{m.estado_label}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {item.selected && (
                    <div className="selected-material-info" style={{ marginTop: 4 }}>
                      <span>Stock:</span>
                      <strong>{item.selected.stock_actual} {item.selected.unit}</strong>
                      <span className={`badge badge-${item.selected.estado}`}>{item.selected.estado_label}</span>
                    </div>
                  )}
                </div>

                <div className="salidas-row">
                  <div className="form-group">
                    <label className="form-label">Cantidad *</label>
                    <input type="number" className="form-control" min="1" placeholder="0"
                      value={item.cantidad} onChange={e => handleItemChange(idx, 'cantidad', e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Costo unitario *</label>
                    <input type="number" className="form-control" step="0.01" placeholder="0.00"
                      value={item.costo} onChange={e => handleItemChange(idx, 'costo', e.target.value)} required />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Firmas */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
            <label className="form-label" style={{ marginBottom: 'var(--space-2)' }}>Firmas</label>
            <div className="signature-grid">
              {FIRMAS.map(f => (
                <div key={f.key} className={`signature-item ${signatures[f.key] ? 'signed' : 'pending'}`}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer', fontSize: '0.85rem' }}>
                      <input
                        type="checkbox"
                        checked={signatures[f.key] || false}
                        onChange={e => handleSignatureChange(f.key, e.target.checked)}
                      />
                      {f.label}
                      <span className="signature-status">
                        {signatures[f.key] ? 'Firmado' : 'Pendiente'}
                      </span>
                    </label>
                    {signatures[f.key] && (
                      <input
                        className="form-control"
                        placeholder="Nombre de quien firma"
                        value={signatures[f.nameKey] || ''}
                        onChange={e => handleSignatureChange(f.nameKey, e.target.value)}
                        style={{ fontSize: '0.8rem' }}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Observaciones */}
          <div className="form-group">
            <label className="form-label">Observaciones</label>
            <textarea className="form-control" rows={2} placeholder="Notas opcionales..."
              value={form.observaciones} onChange={e => handleFormChange('observaciones', e.target.value)} />
          </div>

          <div className="modal-footer" style={{ marginTop: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={() => onClose(false)}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={loading || !items.some(i => i.material)}>
              {loading ? 'Guardando...' : 'Crear Vale'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
