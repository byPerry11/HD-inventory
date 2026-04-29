import { useState, useEffect, useRef } from 'react'
import client from '../../api/client'
import { cleanBadgeID } from '../../utils/formatters'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import './Despachar.css'
import ValeModal from '../Vales/ValeModal'
export default function Despachar() {
  const notify = useToast()
  const { user } = useAuth()
  const isPrivileged = user?.role === 'manager' || user?.role === 'supervisor'

  const [materials, setMaterials] = useState([])
  const [categories, setCategories] = useState([])
  const [selectedCategory, setSelectedCategory] = useState('')
  const [cart, setCart] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [showVale, setShowVale] = useState(false)
  const searchInputRef = useRef(null)

  // Opciones
  const [areas, setAreas] = useState([])
  const [turnos, setTurnos] = useState([])
  const [secciones, setSecciones] = useState([])

  // Formularios con persistencia
  const [config, setConfig] = useState(() => {
    const saved = localStorage.getItem('hd_despachar_config')
    return saved ? JSON.parse(saved) : { area: '', seccion: '', turno: '', empleado_no: '', recibio: '', observaciones: '' }
  })

  useEffect(() => {
    localStorage.setItem('hd_despachar_config', JSON.stringify(config))
  }, [config])

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const lookupEmpleado = async (numero) => {
    try {
      const { data } = await client.get(`/inventory/empleados/?numero=${numero}`)
      const results = data.results || data
      if (results.length > 0) {
        setConfig(prev => ({ ...prev, recibio: results[0].nombre }))
      } else {
        notify.warning('Empleado no encontrado')
      }
    } catch (err) {
      console.error(err)
      notify.error('Error al buscar empleado')
    }
  }

  const handleConfigChange = (name, value) => {
    if (name === 'empleado_no') {
      const cleaned = cleanBadgeID(value)
      setConfig(prev => ({ ...prev, [name]: cleaned }))
      if (cleaned.length >= 4) {
        lookupEmpleado(cleaned)
      }
    } else {
      setConfig(prev => ({ ...prev, [name]: value }))
    }
  }

  const fetchData = async () => {
    try {
      const [matRes, optsRes, catRes] = await Promise.all([
        client.get('/materials/?page_size=1000'),
        client.get('/inventory/salidas/choices/'),
        client.get('/materials/categorias/'),
        client.get('/inventory/secciones/?page_size=1000')
      ])
      setMaterials(matRes.data.results || matRes.data)
      setAreas(optsRes.data.areas || [])
      setTurnos(optsRes.data.turnos || [])
      setCategories(catRes.data.results || catRes.data)
      setSecciones(optsRes.data.secciones || [])
    } catch (err) {
      console.error('Error fetching despachar data:', err)
      notify.error('No se pudo cargar el catálogo de materiales.')
    }
  }

  const handleCreateSeccion = async () => {
    const nombre = prompt('Ingresa el nombre de la nueva sección:')
    if (!nombre) return

    try {
      setLoading(true)
      const res = await client.post('/inventory/secciones/', { nombre: nombre.trim() })
      setSecciones(prev => [...prev, res.data].sort((a, b) => a.nombre.localeCompare(b.nombre)))
      setConfig(prev => ({ ...prev, seccion: res.data.nombre }))
      notify.success('Sección registrada correctamente')
    } catch (err) {
      console.error(err)
      notify.error(err.response?.data?.nombre?.[0] || 'Error al crear la sección')
    } finally {
      setLoading(false)
    }
  }

  // Escáner Global
  useEffect(() => {
    let buffer = ''
    let lastTime = Date.now()

    const handleKeyDown = (e) => {
      if (
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) &&
        e.target !== searchInputRef.current
      ) {
        return
      }

      const currentTime = Date.now()
      if (currentTime - lastTime > 100) {
        buffer = ''
      }
      lastTime = currentTime

      if (e.key === 'Enter') {
        if (buffer.trim()) {
          handleScan(buffer.trim())
          buffer = ''
          e.preventDefault()
          setSearch('')
        }
      } else if (e.key.length === 1) {
        buffer += e.key
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materials])

  const handleScan = (code) => {
    const matched = materials.find(m =>
      (m.barcode && m.barcode.toLowerCase() === code.toLowerCase()) ||
      (m.code && m.code.toLowerCase() === code.toLowerCase())
    )
    if (matched) {
      addToCart(matched)
    } else {
      notify.warning(`No se encontró material con código: ${code}`)
    }
  }

  const triggerFlyAnimation = (startNode) => {
    const cartIcon = document.getElementById('cart-panel-header')
    if (!cartIcon || !startNode) return

    const startRect = startNode.getBoundingClientRect()
    const endRect = cartIcon.getBoundingClientRect()

    const ghost = document.createElement('div')
    ghost.className = 'fly-ghost'
    ghost.innerText = '+1'
    ghost.style.left = `${startRect.left + startRect.width / 2}px`
    ghost.style.top = `${startRect.top + startRect.height / 2}px`
    
    const diffX = endRect.left - (startRect.left + startRect.width / 2)
    const diffY = endRect.top - (startRect.top + startRect.height / 2)
    
    ghost.style.setProperty('--target-x', `${diffX}px`)
    ghost.style.setProperty('--target-y', `${diffY}px`)

    document.body.appendChild(ghost)
    setTimeout(() => ghost.remove(), 700)
  }

  const addToCart = (material, e = null) => {
    if (material.stock_actual <= 0) {
      notify.error(`Sin stock: ${material.code} — ${material.name}`)
      return
    }

    // Animación
    if (e && e.currentTarget) {
      triggerFlyAnimation(e.currentTarget)
    }

    setCart(prev => {
      const existing = prev.find(i => i.material.id === material.id)
      if (existing) {
        if (existing.cantidad + 1 > material.stock_actual) {
          notify.warning('No puedes exceder el stock disponible')
          return prev
        }
        return prev.map(i =>
          i.material.id === material.id
            ? { ...i, cantidad: i.cantidad + 1, observaciones: config.observaciones }
            : i
        )
      }
      return [{ material, cantidad: 1, observaciones: config.observaciones }, ...prev]
    })
  }

  const updateCartQty = (id, delta) => {
    setCart(prev => prev.map(item => {
      if (item.material.id === id) {
        const newQty = Math.max(1, Math.min(item.cantidad + delta, item.material.stock_actual))
        return { ...item, cantidad: newQty }
      }
      return item
    }))
  }

  const setExactCartQty = (id, value) => {
    const val = parseInt(value) || 1
    setCart(prev => prev.map(item => {
      if (item.material.id === id) {
        const newQty = Math.max(1, Math.min(val, item.material.stock_actual))
        return { ...item, cantidad: newQty }
      }
      return item
    }))
  }

  const removeFromCart = (id) => {
    setCart(prev => prev.filter(i => i.material.id !== id))
  }

  const handleCheckout = async () => {
    if (!cart.length) return
    if (!config.area || !config.turno || !config.recibio.trim()) {
      notify.warning('Completa Área, Turno y Quien Recibe antes de confirmar.')
      return
    }

    setLoading(true)
    try {
      const payload = {
        items: cart.map(i => ({ material: i.material.id, cantidad: i.cantidad, observaciones: i.observaciones })),
        area: config.area,
        seccion: config.seccion,
        turno: config.turno,
        empleado_no: config.empleado_no,
        recibio: config.recibio,
      }
      await client.post('/inventory/salidas/bulk/', payload)

      setCart([])
      await fetchData()
      notify.success(`${cart.length} salida${cart.length > 1 ? 's' : ''} registrada${cart.length > 1 ? 's' : ''} correctamente.`)
    } catch (err) {
      console.error(err)
      notify.error(err.response?.data?.detail || 'Error al registrar las salidas.')
    } finally {
      setLoading(false)
    }
  }

  // Filtrado del catálogo
  const filteredMaterials = materials.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(search.toLowerCase()) ||
                          m.code.toLowerCase().includes(search.toLowerCase()) ||
                          (m.barcode && m.barcode.toLowerCase().includes(search.toLowerCase()))
    const matchesCategory = selectedCategory === '' || m.category_name === selectedCategory
    return matchesSearch && matchesCategory
  })

  return (
    <div className="despachar-layout">
      {/* ─── Panel Izquierdo: Buscador y Catálogo ──────────────── */}
      <div className="despachar-catalog">
        <div className="despachar-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="title-section">
              <h2 style={{ margin: 0 }}>Modo Despacho</h2>
              <span style={{ color: 'var(--text-muted)' }}>Busca, escanea o selecciona</span>
            </div>
            <button className="btn btn-primary" onClick={() => setShowVale(true)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2z"></path><line x1="13" y1="5" x2="13" y2="21"></line></svg>
              Crear Vale
            </button>
          </div>

          <div className="category-pills">
            <button
              className={`category-pill ${selectedCategory === '' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('')}
            >
              Todos
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                className={`category-pill ${selectedCategory === cat.name ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat.name)}
              >
                {cat.name}
              </button>
            ))}
          </div>

          <div className="despachar-search-wrapper">
            <span className="despachar-search-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            </span>
            <input
              ref={searchInputRef}
              type="text"
              className="despachar-search-input"
              placeholder="Escanea el código de barras o busca material..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        <div className="catalog-grid">
          {filteredMaterials.map(m => (
            <div key={m.id} className="catalog-item" onClick={(e) => addToCart(m, e)}>
              <div className="catalog-item-img-wrapper">
                {m.image ? (
                  <img src={m.image} alt={m.name} className="catalog-item-img" />
                ) : (
                  <span className="catalog-item-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                  </span>
                )}
              </div>
              <div className="catalog-item-code">{m.code}</div>
              <div className="catalog-item-name">{m.name}</div>
              {m.ubicacion && (
                <div className="catalog-item-location">
                  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  {m.ubicacion}
                </div>
              )}
              <div className={`catalog-item-stock stock-badge--${m.estado}`}>
                Stock: {m.stock_actual} {m.unit}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Panel Derecho: Configuración y Carrito ──────────────── */}
      <div className="despachar-cart">
        <div className="cart-config">
          <h3 id="cart-panel-header" style={{ margin: 0 }}>Destino</h3>
          <div className="config-row">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Turno *</label>
              <select
                className="form-control"
                style={{ height: '38px' }}
                value={config.turno}
                onChange={e => setConfig({...config, turno: e.target.value})}
              >
                <option value="">Selecciona...</option>
                {turnos.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Área *</label>
              <select
                className="form-control"
                style={{ height: '38px' }}
                value={config.area}
                onChange={e => setConfig({...config, area: e.target.value})}
              >
                <option value="">Selecciona...</option>
                {areas.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </div>
          </div>
          <div className="config-row">
            <div className="form-group" style={{ marginBottom: 0, position: 'relative' }}>
              <label>Sección</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <select
                  className="form-control"
                  style={{ height: '38px', flex: 1 }}
                  value={config.seccion || ''}
                  onChange={e => setConfig({...config, seccion: e.target.value})}
                >
                  <option value="">Selecciona...</option>
                  {secciones.map(sec => <option key={sec.value} value={sec.value}>{sec.label}</option>)}
                </select>

                {isPrivileged && (
                  <button 
                    className="btn btn-secondary" 
                    style={{ height: '38px', padding: '0 12px' }}
                    onClick={handleCreateSeccion}
                    title="Registrar nueva sección"
                  >
                    + Nueva
                  </button>
                )}
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>No. Empleado</label>
              <input
                type="text"
                className="form-control"
                placeholder="Escanea o escribe..."
                value={config.empleado_no || ''}
                onChange={e => handleConfigChange('empleado_no', e.target.value)}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Recibe *</label>
              <input
                type="text"
                className="form-control"
                placeholder="Nombre de quien recibe"
                value={config.recibio}
                onChange={e => handleConfigChange('recibio', e.target.value)}
              />
            </div>
          </div>
          <div className="config-row">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Observaciones (Por defecto para items)</label>
              <input
                type="text"
                className="form-control"
                placeholder="Opcional..."
                value={config.observaciones || ''}
                onChange={e => setConfig({...config, observaciones: e.target.value})}
              />
            </div>
          </div>
        </div>

        <div className="cart-items">
          {cart.length === 0 ? (
            <div className="cart-empty">
              <div className="cart-empty-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
              </div>
              <p>El carrito está vacío</p>
              <p style={{ fontSize: '0.9rem' }}>Comienza a escanear productos</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.material.id} className="cart-item">
                <div className="cart-item-info">
                  <div className="cart-item-code">{item.material.code}</div>
                  <div className="cart-item-name" title={item.material.name}>{item.material.name}</div>
                  {item.material.ubicacion && (
                    <div className="cart-item-location">📍 {item.material.ubicacion}</div>
                  )}
                </div>
                <div className="cart-item-qty">
                  <button className="qty-btn" onClick={() => updateCartQty(item.material.id, -1)}>-</button>
                  <input
                    type="number"
                    className="qty-input"
                    value={item.cantidad}
                    onChange={e => setExactCartQty(item.material.id, e.target.value)}
                  />
                  <button className="qty-btn" onClick={() => updateCartQty(item.material.id, 1)}>+</button>
                </div>
                <button
                  className="cart-item-remove"
                  onClick={() => removeFromCart(item.material.id)}
                  title="Quitar"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>

        <div className="cart-footer">
          <button
            className="btn-checkout"
            onClick={handleCheckout}
            disabled={cart.length === 0 || loading}
          >
            {loading ? 'Procesando...' : `Confirmar ${cart.length} salida${cart.length > 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
      <ValeModal open={showVale} onClose={() => setShowVale(false)} />
    </div>
  )
}
