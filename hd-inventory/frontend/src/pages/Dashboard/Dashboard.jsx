import { useState, useEffect, useRef } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'
import api from '../../api/client'
import './Dashboard.css'

/* ─── SVG Icons (inline, consistentes con Layout.jsx) ────────── */
const IconBarChart = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
)
const IconAlertTriangle = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
)
const IconTrendingUp = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
)
const IconActivity = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
)
const IconPieChart = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>
)
const IconAward = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>
)
const IconFileText = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
)
const IconChevronLeft = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
)
const IconChevronRight = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
)

/* ─── Gallery Scroll Component ───────────────────────────────── */
function AlertaGallery({ items, type }) {
  const scrollRef = useRef(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const checkScroll = () => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4)
  }

  useEffect(() => {
    checkScroll()
    const el = scrollRef.current
    if (el) el.addEventListener('scroll', checkScroll, { passive: true })
    return () => el?.removeEventListener('scroll', checkScroll)
  }, [items])

  const scroll = (dir) => {
    scrollRef.current?.scrollBy({ left: dir * 220, behavior: 'smooth' })
  }

  return (
    <div className="alertas-gallery-wrapper">
      {canScrollLeft && (
        <button className="alertas-gallery-nav alertas-gallery-nav--left" onClick={() => scroll(-1)} aria-label="Scroll izquierda">
          <IconChevronLeft />
        </button>
      )}
      <div className="alertas-gallery" ref={scrollRef}>
        {items.map(m => (
          <div key={m.id} className={`alerta-card alerta-card--${type}`}>
            <div className="alerta-header">
              <div className="alerta-code font-mono">{m.code}</div>
              {m.active_order && (
                <div className={`alerta-order-badge alerta-order-badge--${m.active_order.status}`}>
                  {m.active_order.label}
                </div>
              )}
            </div>
            <div className="alerta-name">{m.name}</div>
            <div className="alerta-stock">
              <span className="alerta-stock-num">{m.stock_actual}</span>
              <span className="alerta-stock-unit">{m.unit}</span>
            </div>
          </div>
        ))}
      </div>
      {canScrollRight && (
        <button className="alertas-gallery-nav alertas-gallery-nav--right" onClick={() => scroll(1)} aria-label="Scroll derecha">
          <IconChevronRight />
        </button>
      )}
    </div>
  )
}

export default function Dashboard() {
  const [resumen, setResumen]         = useState(null)
  const [alertas, setAlertas]         = useState({ urge: [], ordenar: [] })
  const [sugerencias, setSugerencias] = useState([])
  const [consumo, setConsumo]         = useState([])
  const [topSalidas, setTopSalidas]   = useState([])
  const [recientes, setRecientes]     = useState({ entradas: [], salidas: [], vales: [] })
  const [loading, setLoading]         = useState(true)
  const [selectedVale, setSelectedVale] = useState(null)

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true)
      try {
        const [res, ale, sug, con, top, rec] = await Promise.all([
          api.get('/analytics/resumen/'),
          api.get('/analytics/alertas/'),
          api.get('/analytics/sugerencias-compra/'),
          api.get('/analytics/consumo-por-linea/'),
          api.get('/analytics/top-salidas/'),
          api.get('/analytics/movimientos-recientes/'),
        ])
        setResumen(res.data)
        setAlertas(ale.data)
        setSugerencias(sug.data || [])
        setConsumo(con.data.data || [])
        setTopSalidas(top.data.data || [])
        setRecientes(rec.data)
      } catch { /* silenciar */ } finally { setLoading(false) }
    }
    loadAll()
  }, [])

  if (loading) return (
    <div className="loading-container" style={{ minHeight: '60vh' }}>
      <div className="spinner" style={{ width: 36, height: 36 }} />
      <span>Cargando analíticas...</span>
    </div>
  )

  const pieData = resumen ? [
    { name: 'OK',      value: resumen.materiales_ok,      fill: '#3fb950' },
    { name: 'Ordenar', value: resumen.materiales_ordenar, fill: '#d29922' },
    { name: 'Urge',    value: resumen.materiales_urge,    fill: '#f85149' },
  ] : []

  return (
    <div className="dashboard">
      <div className="page-header">
        <h1 className="page-title"><IconBarChart /> Dashboard — Analíticas</h1>
        <p className="page-subtitle">Resumen del almacén y flujo de materiales</p>
      </div>

      {resumen && (
        <div className="stats-grid mb-8">
          <div className="stat-card" style={{ borderLeft: '4px solid #d29922' }}>
            <div className="stat-label">Órdenes Activas</div>
            <div className="stat-value">{resumen.ordenes_activas_count}</div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>En proceso de surtido</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Monto en Tránsito (MXN)</div>
            <div className="stat-value monetary">
              <span style={{ fontSize: '0.8em', verticalAlign: 'middle', marginRight: '4px' }}>$</span>
              {resumen.ordenes_activas_monto_mxn.toLocaleString()}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Monto en Tránsito (USD)</div>
            <div className="stat-value monetary">
              <span style={{ fontSize: '0.8em', verticalAlign: 'middle', marginRight: '4px' }}>$</span>
              {resumen.ordenes_activas_monto_usd.toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {/* ─── Stats Cards ──────────────────────────────── */}
      {resumen && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Total Materiales</div>
            <div className="stat-value accent">{resumen.materiales_total}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Estado OK</div>
            <div className="stat-value ok">{resumen.materiales_ok}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Por Ordenar</div>
            <div className="stat-value ordenar">{resumen.materiales_ordenar}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Urge Reorden</div>
            <div className="stat-value urge">{resumen.materiales_urge}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Entradas Hoy</div>
            <div className="stat-value accent">{resumen.entradas_hoy}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Salidas Hoy</div>
            <div className="stat-value accent">{resumen.salidas_hoy}</div>
          </div>
        </div>
      )}

      {/* ─── Alertas de Stock — Galería Horizontal ─────── */}
      {(alertas.urge.length > 0 || alertas.ordenar.length > 0) && (
        <div className="card mb-8">
          <h2 className="dashboard-section-title"><IconAlertTriangle /> Alertas de Stock</h2>

          {alertas.urge.length > 0 && (
            <div className="alertas-group">
              <h3 className="alertas-group-title alertas-group-title--urge">
                URGE — Acción inmediata ({alertas.urge.length})
              </h3>
              <AlertaGallery items={alertas.urge} type="urge" />
            </div>
          )}

          {alertas.ordenar.length > 0 && (
            <div className="alertas-group">
              <h3 className="alertas-group-title alertas-group-title--ordenar">
                ORDENAR — Stock bajo ({alertas.ordenar.length})
              </h3>
              <AlertaGallery items={alertas.ordenar} type="ordenar" />
            </div>
          )}
        </div>
      )}

      {/* ─── Sugerencias de Compra (Predicciones) ────── */}
      {sugerencias.length > 0 && (
        <div className="card mb-8">
          <h2 className="dashboard-section-title"><IconTrendingUp /> Sugerencias de Compra</h2>
          <p className="page-subtitle" style={{marginBottom: 'var(--space-4)'}}>Recomendaciones basadas en consumo reciente (últimos 60 días) y tiempos promedio de entrega.</p>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>No. Parte</th>
                  <th>Material</th>
                  <th>Stock. Act.</th>
                  <th>Consumo Estim. (día)</th>
                  <th>Días p/Agotar</th>
                  <th>T. Entrega (días)</th>
                  <th>Sugerencia</th>
                </tr>
              </thead>
              <tbody>
                {sugerencias.map(s => {
                  const urgente = s.dias_para_comprar <= 5
                  return (
                    <tr key={s.material_id} style={{ backgroundColor: urgente ? 'rgba(248, 81, 73, 0.05)' : 'transparent' }}>
                      <td className="font-mono">{s.code}</td>
                      <td>{s.name}</td>
                      <td style={{fontWeight: 'bold'}}>{s.stock_actual}</td>
                      <td className="text-secondary">{s.consumo_diario_estimado}</td>
                      <td>{s.dias_para_agotarse} días</td>
                      <td className="text-center">{s.tiempo_entrega_estimado}</td>
                      <td>
                        {s.dias_para_comprar <= 0 ? (
                          <span className="status-badge" style={{ backgroundColor: 'var(--color-bg-error)', color: 'var(--color-error)'}}>Comprar Inmediato</span>
                        ) : s.dias_para_comprar <= 7 ? (
                          <span className="status-badge" style={{ backgroundColor: 'var(--color-bg-warning)', color: 'var(--color-warning)'}}>Comprar en {s.dias_para_comprar} días</span>
                        ) : (
                          <span className="status-badge" style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--color-text-secondary)'}}>Suficiente (en {s.dias_para_comprar} días)</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Gráficas ─────────────────────────────────── */}
      <div className="dashboard-charts">
        {/* Consumo por línea */}
        <div className="card">
          <h2 className="dashboard-section-title"><IconActivity /> Consumo por Línea (30 días)</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={consumo} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="linea_nombre" tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }} />
              <YAxis tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  background: 'var(--color-bg-card)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                  color: 'var(--color-text-primary)',
                }}
              />
              <Bar dataKey="total_unidades" name="Unidades" fill="#1f6feb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Estado de stock — Pie */}
        <div className="card">
          <h2 className="dashboard-section-title"><IconPieChart /> Estado del Inventario</h2>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={110}
                paddingAngle={3}
                dataKey="value"
                label={({ name, value }) => value > 0 ? `${name}: ${value}` : ''}
                labelLine={{ stroke: 'var(--color-border)' }}
              >
                {pieData.map((entry, index) => (
                  <Cell key={index} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: 'var(--color-bg-card)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                  color: 'var(--color-text-primary)',
                }}
              />
              <Legend wrapperStyle={{ color: 'var(--color-text-secondary)', fontSize: 13 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ─── Top Salidas + Movimientos Recientes ────── */}
      <div className="dashboard-bottom">
        {/* Top materiales más despachados */}
        <div className="card">
          <h2 className="dashboard-section-title"><IconAward /> Top Materiales Despachados (30 días)</h2>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Código</th>
                  <th>Material</th>
                  <th className="text-right">Movimientos</th>
                  <th className="text-right">Unidades</th>
                </tr>
              </thead>
              <tbody>
                {topSalidas.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign:'center', padding:32, color:'var(--color-text-muted)' }}>Sin datos en los últimos 30 días</td></tr>
                ) : topSalidas.map((item, idx) => (
                  <tr key={item.material__id}>
                    <td className="text-muted">{idx + 1}</td>
                    <td><span className="font-mono">{item.material__code}</span></td>
                    <td>{item.material__name}</td>
                    <td className="text-right">{item.total_movimientos}</td>
                    <td className="text-right" style={{ fontWeight: 600 }}>{item.total_unidades}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Vales de Consumo (Salidas Recientes) */}
        <div className="card">
          <h2 className="dashboard-section-title"><IconFileText /> Vales de Consumo Recientes</h2>
          <div className="dashboard-vales-list">
            {recientes.vales?.length === 0 ? (
              <p className="text-muted text-center py-4">Sin vales registrados recientemente</p>
            ) : (
              recientes.vales?.map(vale => (
                <div key={vale.id} className="vale-card" onClick={() => setSelectedVale(vale)}>
                  <div className="vale-card-main">
                    <span className="vale-card-folio">VALE #{vale.recibo_no || vale.id}</span>
                    <span className="vale-card-dest">{vale.linea || 'General'} · {vale.area || 'Sin área'}</span>
                    <span className="vale-card-meta">
                      {vale.recibio} · {new Date(vale.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="vale-card-right">
                    <span className="vale-card-qty">-{vale.cantidad}</span>
                    <span className="font-mono" style={{fontSize: '10px', opacity: 0.7}}>{vale.material_code}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ─── Modal Vista Rápida ────────────────────────────── */}
      {selectedVale && (
        <div className="quick-view-overlay" onClick={() => setSelectedVale(null)}>
          <div className="quick-view-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>Detalle de Vale</h3>
              <button className="btn-close" onClick={() => setSelectedVale(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
                <span className="vale-card-folio" style={{ fontSize: '1rem' }}>VALE #{selectedVale.recibo_no || selectedVale.id}</span>
                <div style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>
                  Fecha: {new Date(selectedVale.fecha).toLocaleString()}
                </div>
              </div>

              <div className="detail-row">
                <span className="detail-label">Material:</span>
                <span className="detail-value">{selectedVale.material_name}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">No. Parte:</span>
                <span className="detail-value font-mono">{selectedVale.material_code}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Cantidad:</span>
                <span className="detail-value" style={{ color: 'var(--color-urge)' }}>-{selectedVale.cantidad}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Recibió:</span>
                <span className="detail-value">{selectedVale.recibio} (No. {selectedVale.empleado_no || '—'})</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Destino:</span>
                <span className="detail-value">{selectedVale.linea} / {selectedVale.area}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Turno:</span>
                <span className="detail-value">{selectedVale.turno}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Comentarios:</span>
                <span className="detail-value" style={{ fontStyle: 'italic' }}>{selectedVale.observaciones || 'Sin observaciones'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Capturado por:</span>
                <span className="detail-value">{selectedVale.usuario}</span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedVale(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
