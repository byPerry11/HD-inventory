import { useState, useEffect, useRef } from 'react'
import api from '../../api/client'
import { cleanBadgeID } from '../../utils/formatters'
import { useToast } from '../../context/ToastContext'

export default function ValeModal({ open, onClose, preselectedMaterial }) {
  const notify = useToast()
  const EMPTY = {
    empleado_no: '', empleado_nombre: '', linea: '', area: '', material: '', aut: '', cantidad: '', costo: '', observaciones: ''
  }
  const [form, setForm] = useState(EMPTY)
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(false)
  const [choices, setChoices] = useState({ lineas: [], areas: [], turnos: [] })
  const [filteredAreas, setFilteredAreas] = useState([])
  const searchTimer = useRef(null)

  useEffect(() => { 
    if (open) {
      fetchChoices()
      fetchMaterials('')
    }
  }, [open])

  const fetchMaterials = async (q) => {
    setSearching(true)
    try {
      const params = q ? `?search=${encodeURIComponent(q)}&page_size=20` : '?page_size=20'
      const { data } = await api.get(`/materials/${params}`)
      setSearchResults(data.results || data)
    } catch (e) { /* ignore */ } finally { setSearching(false) }
  }

  const doSearch = (q) => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => fetchMaterials(q), 300)
  }

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

  useEffect(() => {
    if (preselectedMaterial) {
      setSelected(preselectedMaterial)
      setForm(f => ({ ...f, material: preselectedMaterial.id, aut: preselectedMaterial.aut || '', costo: preselectedMaterial.costo || 0 }))
      setSearch(preselectedMaterial.code + ' — ' + preselectedMaterial.name)
    }
  }, [preselectedMaterial])

  const handleSelect = (m) => {
    setSelected(m)
    setForm(f => ({ ...f, material: m.id, aut: m.aut || '', costo: m.costo || 0 }))
    setSearch(m.code + ' — ' + m.name)
    setSearchResults([])
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    
    if (name === 'empleado_no') {
      const cleaned = cleanBadgeID(value)
      setForm(f => ({ ...f, [name]: cleaned }))
      
      // Si el número cambió o es válido, buscamos el nombre
      if (cleaned.length >= 4) {
        lookupEmpleado(cleaned)
      }
    } else {
      setForm(f => ({ ...f, [name]: value }))
    }
  }

  const lookupEmpleado = async (numero) => {
    try {
      const { data } = await api.get(`/inventory/empleados/?numero=${numero}`)
      const results = data.results || data
      if (results.length > 0) {
        setForm(f => ({ ...f, empleado_nombre: results[0].nombre }))
      }
    } catch (err) {
      console.error('Error buscando empleado:', err)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/inventory/vales/', form)
      notify.success('Vale creado correctamente')
      onClose(true)
    } catch (err) {
      notify.error('Error creando el vale')
    } finally { setLoading(false) }
  }

  if (!open) return null

  return (
    <div className="modal-backdrop" onClick={() => onClose(false)}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <header className="modal-header">
          <h2 className="flex items-center gap-2" style={{ fontSize: '1.25rem', fontWeight: 600 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2z"></path><line x1="13" y1="5" x2="13" y2="21"></line></svg>
            Crear Vale de Consumo
          </h2>
          <button className="modal-close" onClick={() => onClose(false)}>×</button>
        </header>
        
        <form onSubmit={handleSubmit} className="modal-body">
          {/* Empleado */}
          <div className="salidas-row">
            <div className="form-group">
              <label className="form-label">No. Empleado *</label>
              <input 
                name="empleado_no" 
                className="form-control"
                placeholder="Ej. 12140"
                value={form.empleado_no} 
                onChange={handleChange} 
                required 
              />
            </div>
            <div className="form-group" style={{ flex: 1.5 }}>
              <label className="form-label">Nombre del Empleado *</label>
              <input 
                name="empleado_nombre" 
                className="form-control"
                placeholder="Nombre completo..."
                value={form.empleado_nombre} 
                onChange={handleChange} 
                required 
              />
            </div>
          </div>

          {/* Material */}
          <div className="form-group">
            <label className="form-label">Buscar Parte / Material *</label>
            <div className="material-search-wrapper">
              <input 
                className="form-control"
                placeholder="Código o nombre..."
                value={search} 
                onChange={e => { const v = e.target.value; setSearch(v); setSelected(null); setForm(f => ({...f, material: ''})); doSearch(v) }} 
              />
              {!selected && searchResults.length > 0 && (
                <ul className="material-dropdown">
                  {searchResults.slice(0, 10).map(m => (
                    <li key={m.id} className="material-option" onClick={() => handleSelect(m)}>
                      <span className="font-mono">{m.code}</span>
                      <span className="text-muted"> — {m.name}</span>
                      <span className={`badge badge-${m.estado} ml-auto`}>{m.estado_label}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {selected && (
              <div className="selected-material-info">
                <span>Stock actual:</span>
                <strong>{selected.stock_actual} {selected.unit}</strong>
                <span className={`badge badge-${selected.estado}`}>{selected.estado_label}</span>
              </div>
            )}
          </div>

          {/* Cantidad + Costo */}
          <div className="salidas-row">
            <div className="form-group">
              <label className="form-label">Cantidad *</label>
              <input 
                type="number" 
                name="cantidad" 
                className="form-control"
                min="1" 
                placeholder="0"
                value={form.cantidad} 
                onChange={handleChange} 
                required 
              />
            </div>
            <div className="form-group">
              <label className="form-label">Costo unitario ($) *</label>
              <input 
                type="number" 
                name="costo" 
                className="form-control"
                step="0.01" 
                placeholder="0.00"
                value={form.costo} 
                onChange={handleChange} 
                required 
              />
            </div>
          </div>

          <div className="salidas-row">
            <div className="form-group">
              <label className="form-label">Línea *</label>
              <select 
                name="linea" 
                className="form-control"
                value={form.linea} 
                onChange={handleChange}
                required
              >
                <option value="">— Seleccionar —</option>
                {choices.lineas.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Área *</label>
              <select 
                name="area" 
                className="form-control"
                value={form.area} 
                onChange={handleChange}
                required
                disabled={!form.linea}
              >
                <option value="">— Seleccionar —</option>
                {filteredAreas.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Observaciones</label>
            <textarea 
              name="observaciones" 
              className="form-control"
              rows={2}
              placeholder="Notas opcionales..."
              value={form.observaciones} 
              onChange={handleChange} 
            />
          </div>

          <div className="modal-footer" style={{ marginTop: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={() => onClose(false)}>
              Cancelar
            </button>
            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={loading || !form.material}
            >
              {loading ? 'Guardando...' : 'Crear Vale'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
