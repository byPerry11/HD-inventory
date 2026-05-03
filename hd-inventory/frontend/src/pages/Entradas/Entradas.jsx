import { useState, useEffect } from 'react'
import { usePersistentState } from '../../hooks/usePersistentState'
import api from '../../api/client'

const EMPTY_FORM = {
  material: '',
  cantidad: '',
  proveedor: '',
  numero_orden: '',
  observaciones: '',
}

export default function Entradas() {
  const [form, setForm]         = usePersistentState('hd_entr_form', EMPTY_FORM)
  const [materiales, setMateriales] = useState([])
  const [search, setSearch]     = usePersistentState('hd_entr_search', '')
  const [selected, setSelected] = usePersistentState('hd_entr_sel', null)
  const [loading, setLoading]   = useState(false)
  const [success, setSuccess]   = useState(false)
  const [error, setError]       = useState('')

  useEffect(() => { fetchMateriales() }, [])

  const fetchMateriales = async () => {
    try {
      const { data } = await api.get('/materials/?page_size=500')
      setMateriales(data.results || data)
    } catch { /* silenciar */ }
  }

  const filtered = materiales.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.code.toLowerCase().includes(search.toLowerCase())
  )

  const selectMaterial = (m) => {
    setSelected(m)
    setForm(f => ({ ...f, material: m.id }))
    setSearch(`${m.code} — ${m.name}`)
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(''); setSuccess(false); setLoading(true)
    try {
      await api.post('/inventory/entradas/', form)
      setSuccess(true)
      setForm(EMPTY_FORM); setSelected(null); setSearch('')
      fetchMateriales()
      setTimeout(() => setSuccess(false), 4000)
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al registrar la entrada.')
    } finally { setLoading(false) }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">📥 Entrada de Materiales</h1>
        <p className="page-subtitle">Registra el ingreso de material al almacén</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24, alignItems: 'start' }}>
        <form className="card" style={{ display: 'flex', flexDirection: 'column', gap: 20 }} onSubmit={handleSubmit}>
          {success && <div className="alert alert-success"><span>✓</span><span>Entrada registrada. Stock actualizado.</span></div>}
          {error   && <div className="alert alert-error"><span>⚠</span><span>{error}</span></div>}

          {/* Material */}
          <div className="form-group">
            <label className="form-label">Parte / Material *</label>
            <div style={{ position: 'relative' }}>
              <input
                className="form-control"
                type="text"
                placeholder="Buscar por código o nombre..."
                value={search}
                onChange={e => { setSearch(e.target.value); setSelected(null); setForm(f => ({...f, material:''})) }}
              />
              {search && !selected && filtered.length > 0 && (
                <ul style={{
                  position:'absolute', top:'calc(100% + 4px)', left:0, right:0,
                  background:'var(--color-bg-card)', border:'1px solid var(--color-border)',
                  borderRadius:'var(--radius-md)', boxShadow:'var(--shadow-lg)',
                  zIndex:50, maxHeight:240, overflowY:'auto', listStyle:'none'
                }}>
                  {filtered.slice(0, 8).map(m => (
                    <li key={m.id}
                      onClick={() => selectMaterial(m)}
                      style={{
                        display:'flex', alignItems:'center', gap:8,
                        padding:'10px 16px', cursor:'pointer',
                        fontSize:'var(--font-size-sm)',
                        borderBottom:'1px solid var(--color-border-light)'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <span className="font-mono">{m.code}</span>
                      <span className="text-muted"> — {m.name}</span>
                      <span className={`badge badge-${m.estado}`} style={{marginLeft:'auto'}}>{m.estado_label}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {selected && (
              <div style={{
                display:'flex', alignItems:'center', gap:12,
                padding:'10px 16px',
                background:'var(--color-accent-subtle)',
                border:'1px solid rgba(31,111,235,0.2)',
                borderRadius:'var(--radius-md)',
                fontSize:'var(--font-size-sm)',
                color:'var(--color-text-secondary)'
              }}>
                <span>Stock actual:</span>
                <strong style={{color:'var(--color-text-primary)', fontSize:'var(--font-size-md)'}}>
                  {selected.stock_actual} {selected.unit}
                </strong>
                <span className={`badge badge-${selected.estado}`}>{selected.estado_label}</span>
              </div>
            )}
          </div>

          {/* Cantidad */}
          <div className="form-group">
            <label className="form-label" htmlFor="e-cantidad">Cantidad *</label>
            <input id="e-cantidad" name="cantidad" className="form-control" type="number" min="1" placeholder="0" value={form.cantidad} onChange={handleChange} required />
          </div>

          {/* Proveedor + Orden */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-group">
              <label className="form-label" htmlFor="proveedor">Proveedor</label>
              <input id="proveedor" name="proveedor" className="form-control" type="text" placeholder="Nombre del proveedor" value={form.proveedor} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="numero_orden">No. Orden / Remisión</label>
              <input id="numero_orden" name="numero_orden" className="form-control" type="text" placeholder="Ej: OC-2026-001" value={form.numero_orden} onChange={handleChange} />
            </div>
          </div>

          {/* Observaciones */}
          <div className="form-group">
            <label className="form-label" htmlFor="obs-e">Observaciones</label>
            <textarea id="obs-e" name="observaciones" className="form-control" rows={3} placeholder="Notas opcionales..." value={form.observaciones} onChange={handleChange} />
          </div>

          {/* Acciones */}
          <div style={{ display:'flex', justifyContent:'flex-end', gap:12, paddingTop:16, borderTop:'1px solid var(--color-border)' }}>
            <button type="button" className="btn btn-secondary" onClick={() => { setForm(EMPTY_FORM); setSelected(null); setSearch('') }}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-success" disabled={loading || !form.material}>
              {loading
                ? <><div className="spinner" style={{width:16,height:16}} /> Registrando...</>
                : '📥 Registrar Entrada'
              }
            </button>
          </div>
        </form>

        {/* Tips */}
        <div className="card" style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <h3 style={{ fontSize:'var(--font-size-base)', fontWeight:600 }}>ℹ️ Instrucciones</h3>
          <ul style={{ listStyle:'none', display:'flex', flexDirection:'column', gap:12 }}>
            {[
              'Busca el material por código o nombre',
              'Ingresa la cantidad exacta del material recibido',
              'El número de orden sirve para rastreo con proveedores',
              'El stock se actualiza automáticamente al guardar',
            ].map((tip, i) => (
              <li key={i} style={{ fontSize:'var(--font-size-sm)', color:'var(--color-text-secondary)', display:'flex', gap:8 }}>
                <span style={{ color:'var(--color-accent-hover)', fontWeight:'bold' }}>›</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
