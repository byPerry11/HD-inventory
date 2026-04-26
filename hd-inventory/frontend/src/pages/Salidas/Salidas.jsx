import { useState, useEffect } from 'react'
import api from '../../api/client'
import './Salidas.css'
import ValeModal from './ValeModal'
import { useNavigate } from 'react-router-dom'
import { cleanBadgeID } from '../../utils/formatters'

const EMPTY_FORM = {
  material: '',
  cantidad: '',
  area: '',
  seccion: '',
  turno: '',
  empleado_no: '',
  recibio: '',
  observaciones: '',
}

export default function Salidas() {
  const [form, setForm] = useState(EMPTY_FORM)
  const [materiales, setMateriales] = useState([])
  const [selectedMaterial, setSelectedMaterial] = useState(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [showVale, setShowVale] = useState(false)
  const [choices, setChoices] = useState({ areas: [], secciones: [], turnos: [] })

  const navigate = useNavigate()
  useEffect(() => {
    fetchMateriales()
    fetchChoices()
  }, [])

  const fetchChoices = async () => {
    try {
      const { data } = await api.get('/inventory/salidas/choices/')
      setChoices(data)
    } catch (e) { console.error('Error fetching choices', e) }
  }

  const fetchMateriales = async () => {
    try {
      const { data } = await api.get('/materials/?page_size=500')
      setMateriales(data.results || data)
    } catch { /* silenciar */ }
  }

  const filteredMateriales = materiales.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.code.toLowerCase().includes(search.toLowerCase())
  )

  const handleMaterialSelect = (mat) => {
    setSelectedMaterial(mat)
    setForm(f => ({ ...f, material: mat.id }))
    setSearch(mat.code + ' — ' + mat.name)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess(false)
    setLoading(true)
    try {
      await api.post('/inventory/salidas/', form)
      setSuccess(true)
      setForm(EMPTY_FORM)
      setSelectedMaterial(null)
      setSearch('')
      fetchMateriales() // refresca stock
      setTimeout(() => setSuccess(false), 4000)
    } catch (err) {
      const data = err.response?.data
      const msg = data?.cantidad?.[0] || data?.detail || 'Error al registrar la salida.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    
    if (name === 'empleado_no') {
      const cleaned = cleanBadgeID(value)
      setForm(f => ({ ...f, [name]: cleaned }))
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
        setForm(f => ({ ...f, recibio: results[0].nombre }))
      }
    } catch (err) {
      console.error('Error buscando empleado:', err)
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">📤 Salida de Materiales</h1>
        <p className="page-subtitle">Registra la salida de material hacia una línea de producción</p>
        <div style={{ marginTop: 10 }}>
          <button className="btn btn-secondary" onClick={() => setShowVale(true)}>Crear vale</button>
          <button className="btn" style={{ marginLeft: 8 }} onClick={() => navigate('/vales')}>Ver vales</button>
        </div>
      </div>

      <div className="salidas-layout">
        {/* ─── Formulario ──────────────────────────────── */}
        <form className="card salidas-form" onSubmit={handleSubmit}>

          {success && (
            <div className="alert alert-success">
              <span>✓</span>
              <span>Salida registrada correctamente. Stock actualizado.</span>
            </div>
          )}
          {error && (
            <div className="alert alert-error">
              <span>⚠</span>
              <span>{error}</span>
            </div>
          )}

          {/* PARTE / Material */}
          <div className="form-group">
            <label className="form-label">Parte / Material *</label>
            <div className="material-search-wrapper">
              <input
                className="form-control"
                type="text"
                placeholder="Buscar por código o nombre..."
                value={search}
                onChange={e => { setSearch(e.target.value); setSelectedMaterial(null); setForm(f => ({...f, material: ''})) }}
              />
              {search && !selectedMaterial && filteredMateriales.length > 0 && (
                <ul className="material-dropdown">
                  {filteredMateriales.slice(0, 8).map(m => (
                    <li
                      key={m.id}
                      className="material-option"
                      onClick={() => handleMaterialSelect(m)}
                    >
                      <span className="font-mono">{m.code}</span>
                      <span className="text-muted"> — {m.name}</span>
                      <span className={`badge badge-${m.estado} ml-auto`}>{m.estado_label}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {selectedMaterial && (
              <div className="selected-material-info">
                <span>Stock disponible:</span>
                <strong>{selectedMaterial.stock_actual} {selectedMaterial.unit}</strong>
                <span className={`badge badge-${selectedMaterial.estado}`}>
                  {selectedMaterial.estado_label}
                </span>
              </div>
            )}
          </div>

          {/* CANTIDAD */}
          <div className="form-group">
            <label className="form-label" htmlFor="cantidad">Cantidad *</label>
            <input
              id="cantidad"
              name="cantidad"
              className="form-control"
              type="number"
              min="1"
              max={selectedMaterial?.stock_actual || undefined}
              placeholder="0"
              value={form.cantidad}
              onChange={handleChange}
              required
            />
          </div>

          {/* ÁREA + SECCIÓN + TURNO */}
          <div className="salidas-row">
            <div className="form-group">
              <label className="form-label" htmlFor="area">Área *</label>
              <select
                id="area"
                name="area"
                className="form-control"
                value={form.area}
                onChange={handleChange}
                required
              >
                <option value="">— Seleccionar —</option>
                {choices.areas.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="seccion">Sección</label>
              <select
                id="seccion"
                name="seccion"
                className="form-control"
                value={form.seccion}
                onChange={handleChange}
              >
                <option value="">— Seleccionar —</option>
                {choices.secciones.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="turno">Turno *</label>
              <select
                id="turno"
                name="turno"
                className="form-control"
                value={form.turno}
                onChange={handleChange}
                required
              >
                <option value="">— Seleccionar —</option>
                {choices.turnos.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          {/* NO. EMPLEADO + RECIBIÓ */}
          <div className="salidas-row">
            <div className="form-group">
              <label className="form-label" htmlFor="empleado_no">No. Empleado</label>
              <input
                id="empleado_no"
                name="empleado_no"
                className="form-control"
                type="text"
                placeholder="Escanea o escribe ID"
                value={form.empleado_no}
                onChange={handleChange}
              />
            </div>

            <div className="form-group" style={{ flex: 1.5 }}>
              <label className="form-label" htmlFor="recibio">Recibió *</label>
              <input
                id="recibio"
                name="recibio"
                className="form-control"
                type="text"
                placeholder="Nombre de quien retira"
                value={form.recibio}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          {/* COMENTARIOS */}
          <div className="form-group">
            <label className="form-label" htmlFor="observaciones">Comentarios</label>
            <textarea
              id="observaciones"
              name="observaciones"
              className="form-control"
              rows={3}
              placeholder="Observaciones opcionales..."
              value={form.observaciones}
              onChange={handleChange}
            />
          </div>

          {/* Acciones */}
          <div className="salidas-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => { setForm(EMPTY_FORM); setSelectedMaterial(null); setSearch('') }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-danger"
              disabled={loading || !form.material}
            >
              {loading
                ? <><div className="spinner" style={{width:16,height:16}} /> Registrando...</>
                : '📤 Registrar Salida'
              }
            </button>
          </div>
        </form>

        <ValeModal open={showVale} onClose={(created) => { setShowVale(false); if (created) { /* podría refrescar lista */ } }} preselectedMaterial={selectedMaterial} />

        {/* ─── Info lateral ─────────────────────────────── */}
        <div className="salidas-info">
          <div className="card">
            <h3 className="salidas-info-title">ℹ️ Instrucciones</h3>
            <ul className="salidas-instructions">
              <li>Busca el material por <strong>código</strong> o <strong>nombre</strong></li>
              <li>Verifica el <strong>stock disponible</strong> antes de registrar</li>
              <li>Si el stock es <span className="badge badge-urge" style={{display:'inline'}}>URGE</span>, notifica al área de compras</li>
              <li>El campo <strong>Recibió</strong> es la persona que retira el material</li>
              <li>Tu nombre se registra automáticamente como <strong>Capturado por</strong></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
