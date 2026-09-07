import { useState, useEffect, useRef } from 'react'
import client from '../../api/client'
import { useToast } from '../../context/ToastContext'
import ConfirmModal from '../../components/ConfirmModal'
import { Icon } from '../../components/ui'
import './MaterialModal.css'

export default function MaterialModal({ material, onClose, onSaved }) {
  const isEdit = !!material
  const notify = useToast()
  const [loading, setLoading] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [categories, setCategories] = useState([])
  const [dragActive, setDragActive] = useState(false)
  const [isNewCategory, setIsNewCategory] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const fileInputRef = useRef(null)

  const [formData, setFormData] = useState({
    code:          material?.code          || '',
    barcode:       material?.barcode       || '',
    name:          material?.name          || '',
    category:      material?.category      || '',
    unit:          material?.unit          || 'pza',
    descripcion:   material?.descripcion   || '',
    ubicacion:     material?.ubicacion     || '',
    stock_minimo:  material?.stock_minimo  || 10,
    stock_critico: material?.stock_critico || 5,
    activo:        material?.activo !== false
  })

  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(material?.image || null)

  const fetchCategories = () => {
    client.get('/materials/categorias/').then(res => {
      setCategories(res.data.results || res.data)
    }).catch(err => console.error(err))
  }

  useEffect(() => {
    fetchCategories()
  }, [])

  const handleCreateCategory = async () => {
    if (!newCatName.trim()) return
    try {
      const res = await client.post('/materials/categorias/', { name: newCatName.trim() })
      setCategories(prev => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)))
      setFormData(prev => ({ ...prev, category: res.data.id }))
      setIsNewCategory(false)
      setNewCatName('')
      notify.success(`Categoría "${res.data.name}" creada correctamente.`)
    } catch (err) {
      const msg = err.response?.data?.name?.[0] || err.response?.data?.detail || 'Error al crear la categoría.'
      notify.error(msg)
    }
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const setFile = (file) => {
    if (file && file.type.startsWith('image/')) {
      setImageFile(file)
      setImagePreview(URL.createObjectURL(file))
    }
  }

  const handleImageChange = (e) => { setFile(e.target.files[0]) }

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true)
    else if (e.type === 'dragleave') setDragActive(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0])
    }
  }

  const handlePaste = (e) => {
    if (e.clipboardData.files && e.clipboardData.files.length > 0) {
      setFile(e.clipboardData.files[0])
    }
  }

  const handleRemoveImage = () => {
    setImageFile(null)
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    const data = new FormData()
    Object.keys(formData).forEach(key => {
      if (formData[key] !== null && formData[key] !== undefined) {
        data.append(key, formData[key])
      }
    })

    if (imageFile) {
      data.append('image', imageFile)
    } else if (isEdit && !imagePreview && material.image) {
      data.append('image', '')
    }

    try {
      if (isEdit) {
        await client.patch(`/materials/${material.id}/`, data, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
        notify.success(`Material "${formData.name}" actualizado correctamente.`)
      } else {
        await client.post('/materials/', data, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
        notify.success(`Material "${formData.name}" creado correctamente.`)
      }
      onSaved()
    } catch (err) {
      console.error(err)
      const errData = err.response?.data
      if (errData && typeof errData === 'object') {
        // Mostrar primer error de campo si existe
        const firstField = Object.keys(errData)[0]
        const firstMsg = Array.isArray(errData[firstField]) ? errData[firstField][0] : errData[firstField]
        notify.error(`${firstField}: ${firstMsg}`)
      } else {
        notify.error('Error al guardar el material. Revisa los datos.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    setLoading(true)
    try {
      await client.delete(`/materials/${material.id}/`)
      notify.success(`Material "${formData.name}" desactivado.`)
      onSaved()
    } catch (err) {
      notify.error('Error al desactivar el material.')
    } finally { setLoading(false) }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} onPaste={handlePaste}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? 'Editar Material' : 'Nuevo Material'}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar" title="Cerrar"><Icon name="x" size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          {/* Código + Barcode */}
          <div className="form-row">
            <div className="form-group flex-1">
              <label>Código Interno *</label>
              <input required type="text" name="code" className="form-control"
                value={formData.code} onChange={handleChange} />
            </div>
            <div className="form-group flex-1">
              <label>Código de Barras</label>
              <input type="text" name="barcode" className="form-control"
                value={formData.barcode} onChange={handleChange} placeholder="Opcional" />
            </div>
          </div>

          {/* Nombre */}
          <div className="form-group">
            <label>Nombre *</label>
            <input required type="text" name="name" className="form-control"
              value={formData.name} onChange={handleChange} />
          </div>

          {/* Categoría + Unidad */}
          <div className="form-row">
            <div className="form-group flex-1">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <label>Categoría</label>
                <button
                  type="button"
                  className="btn-link"
                  onClick={() => setIsNewCategory(!isNewCategory)}
                  style={{ background: 'none', border: 'none', color: 'var(--color-accent)', cursor: 'pointer', fontSize: '0.85rem' }}
                >
                  {isNewCategory ? 'Seleccionar existente' : 'Nueva categoría'}
                </button>
              </div>
              {isNewCategory ? (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text" className="form-control"
                    placeholder="Nombre de la categoría..."
                    value={newCatName}
                    onChange={e => setNewCatName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleCreateCategory())}
                  />
                  <button type="button" className="btn btn-secondary" onClick={handleCreateCategory}>
                    Crear
                  </button>
                </div>
              ) : (
                <select name="category" className="form-control" value={formData.category} onChange={handleChange}>
                  <option value="">Sin categoría</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
            </div>
            <div className="form-group flex-1">
              <label>Unidad *</label>
              <select required name="unit" className="form-control" value={formData.unit} onChange={handleChange}>
                <option value="pza">Pieza</option>
                <option value="kg">Kilogramo</option>
                <option value="lt">Litro</option>
                <option value="mt">Metro</option>
                <option value="caja">Caja</option>
                <option value="rollo">Rollo</option>
                <option value="bolsa">Bolsa</option>
                <option value="par">Par</option>
                <option value="juego">Juego</option>
                <option value="otro">Otro</option>
              </select>
            </div>
          </div>

          {/* Ubicación */}
          <div className="form-group">
            <label>
              Ubicación en Almacén
              <span style={{ color: 'var(--color-text-secondary)', fontWeight: 400, marginLeft: 6 }}>
                — (ej. <code style={{ fontSize: '0.85em' }}>Locker 13-B</code>, <code style={{ fontSize: '0.85em' }}>5-A</code>)
              </span>
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--color-text-muted)', pointerEvents: 'none'
              }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              </span>
              <input
                type="text"
                name="ubicacion"
                className="form-control"
                placeholder="Ej. Locker 13-B, LOKER-amarillo, 5-A..."
                value={formData.ubicacion}
                onChange={handleChange}
                style={{ paddingLeft: 34 }}
                pattern="^[A-Za-z0-9\s\-_]+$"
                title="Solo letras, números, espacios y guiones"
              />
            </div>
          </div>

          {/* Stock mínimo + crítico */}
          <div className="form-row">
            <div className="form-group flex-1">
              <label>Stock Mínimo <span style={{ color: 'var(--color-ordenar)' }}>●</span></label>
              <input required type="number" name="stock_minimo" className="form-control"
                value={formData.stock_minimo} onChange={handleChange} min="0" />
            </div>
            <div className="form-group flex-1">
              <label>Stock Crítico <span style={{ color: 'var(--color-urge)' }}>●</span></label>
              <input required type="number" name="stock_critico" className="form-control"
                value={formData.stock_critico} onChange={handleChange} min="0" />
            </div>
          </div>

          {/* Descripción */}
          <div className="form-group">
            <label>Descripción</label>
            <textarea name="descripcion" className="form-control" rows="2"
              value={formData.descripcion} onChange={handleChange}></textarea>
          </div>

          {/* Imagen */}
          <div className="form-group">
            <label>Imagen del Producto <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>(arrastra, pega Ctrl+V, o haz clic)</span></label>
            <div
              className={`image-upload-wrapper ${dragActive ? 'drag-active' : ''}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              {imagePreview && (
                <div className="image-preview">
                  <img src={imagePreview} alt="Preview" />
                  <button type="button" className="btn-remove-img" onClick={handleRemoveImage}>×</button>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="form-control"
                style={{ display: imagePreview ? 'none' : 'block' }}
              />
            </div>
          </div>

          {/* Activo */}
          <div className="form-group checkbox-group">
            <label>
              <input type="checkbox" name="activo" checked={formData.activo} onChange={handleChange} />
              Material Activo (Visible en inventario)
            </label>
          </div>

          <div className="modal-footer">
            <div style={{ display: 'flex', gap: 'var(--space-2)', marginRight: 'auto' }}>
              {isEdit && (
                <button type="button" className="btn btn-danger" onClick={() => setConfirmOpen(true)} disabled={loading}>
                  Eliminar
                </button>
              )}
            </div>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar Material'}
            </button>
          </div>
        </form>

        <ConfirmModal
          open={confirmOpen}
          title={`¿Desactivar material "${formData.name}"?`}
          message={`Al desactivarlo se ocultará del inventario, pero los registros históricos (entradas, salidas, vales, órdenes de compra) se conservarán. ¿Deseas continuar?`}
          confirmText="Desactivar"
          loading={loading}
          onConfirm={handleDelete}
          onCancel={() => setConfirmOpen(false)}
        />
      </div>
    </div>
  )
}
