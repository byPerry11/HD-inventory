import { useState, useEffect, useCallback } from 'react'
import api from '../../api/client'
import { useToast } from '../../context/ToastContext'
import { Icon } from '../../components/ui'

// Inline SVG Icons
const IconCheckSquare = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 11 12 14 22 4"></polyline>
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
  </svg>
)

const IconSquare = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
  </svg>
)

const IconDownload = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
    <polyline points="7 10 12 15 17 10"></polyline>
    <line x1="12" y1="15" x2="12" y2="3"></line>
  </svg>
)

export default function ReportModal({ onClose }) {
  const notify = useToast()
  const [categories, setCategories] = useState([])
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [loadingCats, setLoadingCats] = useState(true)
  const [downloading, setDownloading] = useState(false)

  const fetchCategories = useCallback(async () => {
    try {
      setLoadingCats(true)
      const resp = await api.get('/materials/categorias/')
      setCategories(resp.data.results || resp.data)
    } catch (err) {
      console.error('Error fetching categories:', err)
      notify.error('Error al cargar categorías para el reporte.')
    } finally {
      setLoadingCats(false)
    }
  }, [notify])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  const toggleCategory = (id) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const toggleAll = () => {
    if (selectedIds.size === categories.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(categories.map(c => c.id)))
    }
  }

  const handleDownload = async () => {
    if (selectedIds.size === 0) {
      notify.warning('Por favor selecciona al menos una categoría.')
      return
    }

    try {
      setDownloading(true)
      const idsParam = Array.from(selectedIds).join(',')
      const resp = await api.get(`/materials/reports/custom-inventory/?categories=${idsParam}`, { 
        responseType: 'blob' 
      })
      
      const blob = new Blob([resp.data], { type: resp.headers['content-type'] })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      
      const disposition = resp.headers['content-disposition'] || ''
      let filename = 'Inventario.xlsx'
      if (disposition) {
        const match = /filename="?([^";]+)"?/.exec(disposition)
        if (match) filename = match[1]
      }
      
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      
      notify.success('Reporte descargado correctamente.')
      onClose()
    } catch (err) {
      console.error('Error descargando reporte', err)
      notify.error('Error al generar el reporte de inventario.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Generar Reporte de Inventario</h2>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar" title="Cerrar"><Icon name="x" size={18} /></button>
        </div>
        
        <div className="modal-body">
          <p style={{ marginBottom: '1rem', color: 'var(--color-text-muted)' }}>
            Selecciona las categorías que deseas incluir en el reporte de Excel.
          </p>
          
          {loadingCats ? (
            <div className="loading-container" style={{ minHeight: '100px' }}>
              <div className="spinner" />
            </div>
          ) : (
            <div className="categories-selection">
              <div 
                style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--color-border)' }}
              >
                <span style={{ fontWeight: 600 }}>Categorías ({selectedIds.size}/{categories.length})</span>
                <button 
                  type="button" 
                  className="btn btn-sm btn-ghost" 
                  onClick={toggleAll}
                >
                  {selectedIds.size === categories.length ? 'Deseleccionar todas' : 'Seleccionar todas'}
                </button>
              </div>
              
              <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {categories.map(cat => (
                  <label 
                    key={cat.id} 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.75rem', 
                      padding: '0.5rem', 
                      cursor: 'pointer',
                      borderRadius: 'var(--radius-md)',
                      background: selectedIds.has(cat.id) ? 'var(--color-bg-hover)' : 'transparent',
                      transition: 'background 0.2s'
                    }}
                    onClick={() => toggleCategory(cat.id)}
                  >
                    <div style={{ color: selectedIds.has(cat.id) ? 'var(--color-accent)' : 'var(--color-text-muted)', display: 'flex' }}>
                      {selectedIds.has(cat.id) ? <IconCheckSquare size={20} /> : <IconSquare size={20} />}
                    </div>
                    <span>{cat.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <div className="modal-footer" style={{ justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={downloading}>
            Cancelar
          </button>
          <button 
            className="btn btn-primary" 
            onClick={handleDownload}
            disabled={downloading || selectedIds.size === 0}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            {downloading ? (
              <>
                <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
                Generando...
              </>
            ) : (
              <>
                <IconDownload size={18} />
                Descargar Excel
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
