import { useState, useEffect, useCallback } from 'react'
import { usePersistentState } from '../../hooks/usePersistentState'
import api from '../../api/client'
import './Materiales.css'
import MaterialModal from './MaterialModal'
import ReportModal from './ReportModal'

export default function Materiales() {
  const [materiales, setMateriales] = useState([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = usePersistentState('hd_mat_search', '')
  const [estadoFilter, setEstado]   = usePersistentState('hd_mat_estado', '')
  const [page, setPage]             = usePersistentState('hd_mat_page', 1)
  const [count, setCount]           = useState(0)
  const [modalMaterial, setModalMaterial] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isReportOpen, setIsReportOpen] = useState(false)
  const PAGE_SIZE = 50

  const fetchMateriales = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page, page_size: PAGE_SIZE,
        ...(search      && { search }),
        ...(estadoFilter && { estado: estadoFilter }),
      })
      const { data } = await api.get(`/materials/?${params}`)
      setMateriales(data.results || data)
      setCount(data.count || (data.results || data).length)
    } catch { /* silenciar */ } finally { setLoading(false) }
  }, [search, estadoFilter, page])

  useEffect(() => { fetchMateriales() }, [fetchMateriales])

  const handleSearch = (e) => { setSearch(e.target.value); setPage(1) }
  const handleEstado = (e) => { setEstado(e.target.value); setPage(1) }

  return (
    <div>
      <div className="page-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end' }}>
        <div>
          <h1 className="page-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
            Materiales
          </h1>
          <p className="page-subtitle">Catálogo del almacén — {count} materiales</p>
        </div>
          <button 
            className="btn btn-primary"
            onClick={() => { setModalMaterial(null); setIsModalOpen(true); }}
          >
            + Nuevo Material
          </button>
          <button
            className="btn btn-secondary"
            style={{ marginLeft: 8 }}
            onClick={() => setIsReportOpen(true)}
          >
            Generar reporte
          </button>
      </div>

      {/* ─── Filtros ───────────────────────────────────── */}
      <div className="materiales-filters card mb-6">
        <input
          className="form-control"
          type="text"
          placeholder="Buscar por código o nombre..."
          value={search}
          onChange={handleSearch}
          style={{ flex: 1 }}
        />
        <select
          className="form-control"
          value={estadoFilter}
          onChange={handleEstado}
          style={{ width: 160 }}
        >
          <option value="">Todos los estados</option>
          <option value="ok">OK</option>
          <option value="ordenar">Ordenar</option>
          <option value="urge">Urge</option>
        </select>
      </div>

      {/* ─── Tabla ─────────────────────────────────────── */}
      {loading ? (
        <div className="loading-container">
          <div className="spinner" />
          <span>Cargando materiales...</span>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Categoría</th>
                <th>Unidad</th>
                <th className="text-right">Stock</th>
                <th className="text-right">Mínimo</th>
                <th className="text-right">Crítico</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {materiales.length === 0 ? (
                <tr>
                  <td colSpan={9} className="materiales-empty">
                    No se encontraron materiales con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                materiales.map(m => (
                  <tr key={m.id} className={`material-row material-row--${m.estado}`}>
                    <td><span className="font-mono">{m.code}</span></td>
                    <td className="material-name">{m.name}</td>
                    <td className="text-muted">{m.category_name || '—'}</td>
                    <td className="text-muted">{m.unit}</td>
                    <td className="text-right">
                      <span className={m.estado !== 'ok' ? `stock-number stock-number--${m.estado}` : ''}>
                        {m.stock_actual}
                      </span>
                    </td>
                    <td className="text-right text-muted">{m.stock_minimo}</td>
                    <td className="text-right text-muted">{m.stock_critico}</td>
                    <td>
                      <span className={`badge badge-${m.estado}`}>
                        {m.estado_label}
                      </span>
                    </td>
                    <td>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                        onClick={() => { setModalMaterial(m); setIsModalOpen(true); }}
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginación */}
      {count > PAGE_SIZE && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-4)' }}>
          <span className="text-muted text-sm">
            Mostrando {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, count)} de {count} materiales
          </span>
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
            <button
              className="btn btn-secondary btn-sm"
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              &laquo; Anterior
            </button>
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>
              Pág. {page} de {Math.ceil(count / PAGE_SIZE)}
            </span>
            <button
              className="btn btn-secondary btn-sm"
              disabled={page >= Math.ceil(count / PAGE_SIZE)}
              onClick={() => setPage(p => p + 1)}
            >
              Siguiente &raquo;
            </button>
          </div>
        </div>
      )}
      
      {isModalOpen && (
        <MaterialModal 
          material={modalMaterial} 
          onClose={() => setIsModalOpen(false)}
          onSaved={() => {
            setIsModalOpen(false)
            fetchMateriales()
          }}
        />
      )}
      {isReportOpen && (
        <ReportModal onClose={() => setIsReportOpen(false)} />
      )}
    </div>
  )
}
