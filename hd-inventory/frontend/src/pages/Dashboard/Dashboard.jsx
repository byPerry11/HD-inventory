import { useState, useEffect, useRef, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'
import api from '../../api/client'
import { Icon } from '../../components/ui'
import './Dashboard.css'

/* Iconos del tablero: set compartido (components/ui/Icon) */

const IconBarChart = () => <Icon name="dashboard" size={20} />
const IconAlertTriangle = () => <Icon name="alert" size={18} />
const IconTrendingUp = () => <Icon name="trendingUp" size={18} />
const IconActivity = () => <Icon name="activity" size={18} />
const IconPieChart = () => <Icon name="pie" size={18} />
const IconAward = () => <Icon name="award" size={18} />
const IconFileText = () => <Icon name="file" size={18} />
const IconChevronLeft = () => <Icon name="chevronLeft" size={18} />
const IconChevronRight = () => <Icon name="chevronRight" size={18} />

const PERIODOS_FLUJO = [
  { key: '24h', label: '24 h', title: 'Últimas 24 horas' },
  { key: '3d', label: '3 d', title: 'Últimos 3 días' },
  { key: '7d', label: '7 d', title: 'Últimos 7 días' },
  { key: '15d', label: '15 d', title: 'Últimos 15 días' },
]

const formatUnidades = (value) => (value ?? 0).toLocaleString('es-MX')

/* ─── Flujo de materiales — Top despachados ─────────────────── */
function FlujoMaterialesCard() {
  const [periodos, setPeriodos] = useState([])
  const [periodoKey, setPeriodoKey] = useState('7d')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const { data } = await api.get('/analytics/flujo-materiales/?limite=10')
      setPeriodos(data.periodos || [])
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const periodo = periodos.find(p => p.key === periodoKey) || periodos[2] || periodos[0]
  const filas = periodo?.data || []
  const activo = PERIODOS_FLUJO.find(p => p.key === periodoKey) || PERIODOS_FLUJO[2]

  return (
    <div className="card flujo-card">
      <div className="flujo-head">
        <div className="flujo-heading">
          <span className="flujo-heading-icon"><IconAward /></span>
          <div>
            <h2 className="flujo-title">Flujo de materiales</h2>
            <p className="flujo-subtitle">Los más despachados · {activo.title.toLowerCase()}</p>
          </div>
        </div>
        <div className="flujo-tabs" role="group" aria-label="Periodo del flujo de materiales">
          {PERIODOS_FLUJO.map(p => (
            <button
              key={p.key}
              type="button"
              className={`flujo-tab${p.key === periodoKey ? ' is-active' : ''}`}
              aria-pressed={p.key === periodoKey}
              title={p.title}
              onClick={() => setPeriodoKey(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flujo-summary" aria-live="polite">
        <span className="flujo-legend flujo-legend--out">
          <Icon name="triangleUp" size={11} fill="currentColor" />
          Salidas
          <strong>{loading ? '—' : formatUnidades(periodo?.salidas)}</strong>
        </span>
        <span className="flujo-legend flujo-legend--in">
          <Icon name="triangleDown" size={11} fill="currentColor" />
          Entradas
          <strong>{loading ? '—' : formatUnidades(periodo?.entradas)}</strong>
        </span>
        {!loading && !error && periodo && (
          <span className="flujo-count">{periodo.data.length} materiales</span>
        )}
      </div>

      {error ? (
        <div className="flujo-state">
          <Icon name="alert" size={22} />
          <p>No se pudo cargar el flujo de materiales.</p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={load}>Reintentar</button>
        </div>
      ) : loading ? (
        <div className="flujo-list flujo-list--loading" aria-busy="true" aria-label="Cargando flujo de materiales">
          {Array.from({ length: 10 }).map((_, i) => (
            <div className="flujo-row flujo-row--skeleton" key={i}>
              <span className="flujo-skeleton flujo-skeleton--rank" />
              <span className="flujo-skeleton flujo-skeleton--name" />
              <span className="flujo-skeleton flujo-skeleton--qty" />
              <span className="flujo-skeleton flujo-skeleton--qty" />
            </div>
          ))}
        </div>
      ) : filas.length === 0 ? (
        <div className="flujo-state">
          <Icon name="package" size={24} />
          <p>Sin movimientos en {activo.title.toLowerCase()}.</p>
        </div>
      ) : (
        <div className="flujo-list" role="list" aria-label={`Materiales más despachados en ${activo.title.toLowerCase()}`}>
          <div className="flujo-columns" aria-hidden="true">
            <span className="flujo-rank">#</span>
            <span>Material</span>
            <span className="flujo-qty flujo-qty--out">Salidas</span>
            <span className="flujo-qty flujo-qty--in">Entradas</span>
          </div>
          {filas.map((m, idx) => (
            <div className="flujo-row" role="listitem" key={m.material_id}>
              <span className={`flujo-rank${idx < 3 ? ' is-top' : ''}`}>
                {String(idx + 1).padStart(2, '0')}
              </span>
              <div className="flujo-material">
                <span className="flujo-name" title={m.name}>{m.name}</span>
                <span className="flujo-code">{m.code} · {m.unit}</span>
              </div>
              <span
                className="flujo-qty flujo-qty--out"
                title={`${formatUnidades(m.salidas)} unidades en ${m.movimientos_salida} salida${m.movimientos_salida === 1 ? '' : 's'}`}
              >
                <Icon name="triangleUp" size={11} fill="currentColor" />
                {formatUnidades(m.salidas)}
              </span>
              <span
                className={`flujo-qty flujo-qty--in${m.entradas === 0 ? ' is-zero' : ''}`}
                title={`${formatUnidades(m.entradas)} unidades en ${m.movimientos_entrada} entrada${m.movimientos_entrada === 1 ? '' : 's'}`}
              >
                <Icon name="triangleDown" size={11} fill="currentColor" />
                {formatUnidades(m.entradas)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

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
  const [recientes, setRecientes]     = useState({ entradas: [], salidas: [], vales: [] })
  const [loading, setLoading]         = useState(true)
  const [selectedVale, setSelectedVale] = useState(null)
  const [periodo, setPeriodo]         = useState(30)

  const loadAll = useCallback(async (dias) => {
    setLoading(true)
    try {
      const [res, ale, sug, con, rec] = await Promise.all([
        api.get('/analytics/resumen/'),
        api.get('/analytics/alertas/'),
        api.get('/analytics/sugerencias-compra/'),
        api.get(`/analytics/consumo-por-linea/?dias=${dias}`),
        api.get('/analytics/movimientos-recientes/'),
      ])
      setResumen(res.data)
      setAlertas(ale.data)
      setSugerencias(sug.data || [])
      setConsumo(con.data.data || [])
      setRecientes(rec.data)
    } catch { /* silenciar */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { loadAll(periodo) }, [periodo, loadAll])

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
        <div className="page-header-text">
          <h1 className="page-title"><IconBarChart /> Dashboard — Analíticas</h1>
          <p className="page-subtitle">Resumen del almacén y flujo de materiales</p>
        </div>
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
          <div className="stat-card" style={{ borderLeft: '4px solid #1f6feb' }}>
            <div className="stat-label">Costo Consumo (30 días)</div>
            <div className="stat-value monetary" style={{ color: 'var(--color-text-primary)' }}>
              <span style={{ fontSize: '0.8em', verticalAlign: 'middle', marginRight: '4px' }}>$</span>
              {(resumen.costo_consumo_mes || 0).toLocaleString()}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>Materiales vía vales</div>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
            <h2 className="dashboard-section-title" style={{ margin: 0 }}><IconActivity /> Consumo por Línea</h2>
            <select className="form-control" value={periodo} onChange={e => setPeriodo(Number(e.target.value))}
              style={{ width: 'auto', fontSize: '0.8rem' }}>
              <option value={7}>7 días</option>
              <option value={30}>30 días</option>
              <option value={60}>60 días</option>
              <option value={90}>90 días</option>
            </select>
          </div>
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

      {/* ─── Flujo de Materiales + Vales Recientes ────── */}
      <div className="dashboard-bottom">
        <FlujoMaterialesCard />

        {/* Vales de Consumo (Recientes) */}
        <div className="card">
          <h2 className="dashboard-section-title"><IconFileText /> Vales de Consumo Recientes</h2>
          <div className="dashboard-vales-list">
            {recientes.vales?.length === 0 ? (
              <p className="text-muted text-center py-4">Sin vales registrados recientemente</p>
            ) : (
              recientes.vales?.map(vale => {
                const qty = vale.items?.length > 0
                  ? vale.items.reduce((s, i) => s + i.cantidad, 0)
                  : vale.cantidad
                return (
                  <div key={vale.id} className="vale-card" onClick={() => setSelectedVale(vale)}>
                    <div className="vale-card-main">
                      <span className="vale-card-folio">VALE #{vale.recibo_no || vale.id}</span>
                      <span className="vale-card-dest">{vale.linea || 'General'} · {vale.area || 'Sin área'}</span>
                      <span className="vale-card-meta">
                        {vale.recibio} · {new Date(vale.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="vale-card-right">
                      <span className="vale-card-qty">-{qty}</span>
                      {vale.items?.length > 0 ? (
                        <span style={{ fontSize: '9px', opacity: 0.6 }}>{vale.items.length} artículos</span>
                      ) : (
                        <span className="font-mono" style={{ fontSize: '10px', opacity: 0.7 }}>{vale.material_code}</span>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* ─── Modal Vista Rápida Vale ────────────────────────── */}
      {selectedVale && selectedVale.tipo === 'vale' && (
        <div className="modal-backdrop" onClick={() => setSelectedVale(null)}>
          <div className="modal-content" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>Detalle de Vale</h3>
              <button className="modal-close" onClick={() => setSelectedVale(null)} aria-label="Cerrar" title="Cerrar"><Icon name="x" size={18} /></button>
            </div>
            <div className="modal-body">
              <div style={{ textAlign: 'center', marginBottom: 'var(--space-4)' }}>
                <span className="vale-card-folio" style={{ fontSize: '1rem' }}>VALE #{selectedVale.recibo_no || selectedVale.id}</span>
                <div style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>
                  {new Date(selectedVale.fecha).toLocaleString()}
                </div>
              </div>

              <div className="detail-row">
                <span className="detail-label">Recibió:</span>
                <span className="detail-value">{selectedVale.recibio} (No. {selectedVale.empleado_no || '—'})</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Destino:</span>
                <span className="detail-value">{selectedVale.linea} / {selectedVale.area}</span>
              </div>
              {selectedVale.observaciones && (
                <div className="detail-row">
                  <span className="detail-label">Comentarios:</span>
                  <span className="detail-value" style={{ fontStyle: 'italic' }}>{selectedVale.observaciones}</span>
                </div>
              )}
              <div className="detail-row">
                <span className="detail-label">Capturado por:</span>
                <span className="detail-value">{selectedVale.usuario}</span>
              </div>

              {selectedVale.items && selectedVale.items.length > 0 ? (
                <div style={{ marginTop: 'var(--space-3)' }}>
                  <span className="detail-label">Artículos</span>
                  <table className="table" style={{ marginTop: 4 }}>
                    <thead>
                      <tr>
                        <th>Código</th>
                        <th>Nombre</th>
                        <th>Cantidad</th>
                        <th>Costo</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedVale.items.map((item, i) => (
                        <tr key={i}>
                          <td className="font-mono">{item.material_code}</td>
                          <td>{item.material_name}</td>
                          <td>{item.cantidad}</td>
                          <td>${(item.costo || 0).toFixed(2)}</td>
                          <td>${((item.cantidad || 0) * (item.costo || 0)).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="detail-row">
                  <span className="detail-label">Material:</span>
                  <span className="detail-value">{selectedVale.material_name}</span>
                </div>
              )}

              <div className="detail-row">
                <span className="detail-label">Cantidad total:</span>
                <span className="detail-value" style={{ color: 'var(--color-urge)', fontWeight: 600 }}>
                  -{selectedVale.cantidad}
                </span>
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
