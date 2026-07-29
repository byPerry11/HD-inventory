import { useState, useEffect, useRef, useCallback } from 'react'
import { usePersistentState } from '../../hooks/usePersistentState'
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

  const [searchResults, setSearchResults] = useState([])
  const [categories, setCategories] = useState([])
  const [selectedCategory, setSelectedCategory] = usePersistentState('hd_desp_cat', '')
  const [cart, setCart] = usePersistentState('hd_desp_cart', [])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = usePersistentState('hd_desp_search', '')
  const [showVale, setShowVale] = useState(false)
  const searchInputRef = useRef(null)
  const searchTimer = useRef(null)

  // Opciones
  const [lineas, setLineas] = useState([])
  const [turnos, setTurnos] = useState([])
  const [allAreas, setAllAreas] = useState([])
  const [filteredAreas, setFilteredAreas] = useState([])

  // Formularios con persistencia
  const [config, setConfig] = usePersistentState('hd_despachar_config', { linea: '', area: '', turno: '', empleado_no: '', recibio: '', observaciones: '' }, 'local')

  const fetchMaterials = useCallback(async (query, categoryId) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (query) params.set('search', query)
      if (categoryId) params.set('category', categoryId)
      params.set('page_size', '50')
      const { data } = await client.get(`/materials/?${params.toString()}`)
      setSearchResults(data.results || data)
    } catch { /* ignore */ } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    fetchData()
  }, [])

  // Load initial materials and search when search/category changes
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      fetchMaterials(search || undefined, selectedCategory || undefined)
    }, 300)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [search, selectedCategory, fetchMaterials])

  // Filtrar áreas cuando cambia la línea seleccionada
  useEffect(() => {
    if (config.linea) {
      const filtered = allAreas.filter(a => a.linea === parseInt(config.linea))
      setFilteredAreas(filtered)
      if (config.area && !filtered.find(a => a.id === parseInt(config.area))) {
        setConfig(prev => ({ ...prev, area: '' }))
      }
    } else {
      setFilteredAreas([])
      setConfig(prev => ({ ...prev, area: '' }))
    }
  }, [config.linea, allAreas])

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
      const [optsRes, catRes] = await Promise.all([
        client.get('/inventory/salidas/choices/'),
        client.get('/materials/categorias/'),
      ])
      setLineas(optsRes.data.lineas || [])
      setTurnos(optsRes.data.turnos || [])
      setCategories(catRes.data.results || catRes.data)
      setAllAreas(optsRes.data.areas || [])
    } catch (err) {
      console.error('Error fetching despachar data:', err)
      notify.error('No se pudo cargar el catálogo de materiales.')
    }
  }

  const lookupMaterialByCode = async (code) => {
    try {
      const { data } = await client.get(`/materials/?search=${encodeURIComponent(code)}&page_size=1`)
      const results = data.results || data
      return results.length > 0 ? results[0] : null
    } catch { return null }
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
  }, [searchResults])

  const handleScan = async (code) => {
    // First try in current results
    const localMatch = searchResults.find(m =>
      (m.barcode && m.barcode.toLowerCase() === code.toLowerCase()) ||
      (m.code && m.code.toLowerCase() === code.toLowerCase())
    )
    if (localMatch) {
      addToCart(localMatch)
      return
    }
    // Fallback: server lookup
    const serverMatch = await lookupMaterialByCode(code)
    if (serverMatch) {
      addToCart(serverMatch)
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
    if (value === '' || value === '0') {
      setCart(prev => prev.map(item => {
        if (item.material.id === id) return { ...item, cantidad: '' }
        return item
      }))
      return
    }
    const num = parseInt(value, 10)
    if (isNaN(num) || num < 1) return
    setCart(prev => prev.map(item => {
      if (item.material.id === id) {
        const newQty = Math.min(num, item.material.stock_actual)
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
    if (!config.linea || !config.turno || !config.recibio.trim()) {
      notify.warning('Completa Línea, Turno y Quien Recibe antes de confirmar.')
      return
    }

    for (const item of cart) {
      if (!item.cantidad || item.cantidad < 1) {
        notify.warning(`Cantidad inválida para ${item.material.code}`)
        setLoading(false)
        return
      }
    }

    setLoading(true)
    try {
      const payload = {
        items: cart.map(i => ({ material: i.material.id, cantidad: Number(i.cantidad), observaciones: i.observaciones })),
        linea: config.linea,
        area: config.area || null,
        turno: config.turno,
        empleado_no: config.empleado_no,
        recibio: config.recibio,
      }
      await client.post('/inventory/salidas/bulk/', payload)

      setCart([])
      fetchMaterials(search || undefined, selectedCategory || undefined)
      notify.success(`${cart.length} salida${cart.length > 1 ? 's' : ''} registrada${cart.length > 1 ? 's' : ''} correctamente.`)
    } catch (err) {
      console.error(err)
      notify.error(err.response?.data?.detail || 'Error al registrar las salidas.')
    } finally {
      setLoading(false)
    }
  }

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
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleScan(search.trim())
                  setSearch('')
                  e.preventDefault()
                }
              }}
              autoFocus
            />
          </div>
        </div>

        <div className="catalog-grid">
          {loading && searchResults.length === 0 ? <div className="loading-container"><div className="spinner" /></div> : (
            searchResults.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                {search || selectedCategory ? 'Sin resultados' : 'Escribe para buscar materiales...'}
              </div>
            ) : (
              searchResults.map(m => (
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
              ))
            )
          )}
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
              <label>Línea *</label>
              <select
                className="form-control"
                style={{ height: '38px' }}
                value={config.linea}
                onChange={e => setConfig({...config, linea: e.target.value})}
              >
                <option value="">Selecciona...</option>
                {lineas.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>
          </div>
          <div className="config-row">
            <div className="form-group" style={{ marginBottom: 0, position: 'relative' }}>
              <label>Área</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <select
                  className="form-control"
                  style={{ height: '38px', flex: 1 }}
                  value={config.area || ''}
                  onChange={e => setConfig({...config, area: e.target.value})}
                  disabled={!config.linea}
                >
                  <option value="">Selecciona...</option>
                  {filteredAreas.map(area => <option key={area.value} value={area.value}>{area.label}</option>)}
                </select>
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
