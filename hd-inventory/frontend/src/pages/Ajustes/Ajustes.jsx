import { useState, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import api from '../../api/client'
import { useToast } from '../../context/ToastContext'

export default function Ajustes() {
  const { user, setUser } = useAuth()
  const { theme, setTheme, fontSize, setFontSize } = useTheme()
  const notify = useToast()
  
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    username: user?.username || '',
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
  })
  
  const fileInputRef = useRef(null)

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await api.patch('/auth/me/', formData)
      setUser(data)
      notify.success('Perfil actualizado correctamente')
    } catch (err) {
      notify.error('Error al actualizar perfil')
    } finally {
      setLoading(false)
    }
  }

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    const data = new FormData()
    data.append('avatar', file)

    setLoading(true)
    try {
      const response = await api.patch('/auth/me/', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setUser(response.data)
      notify.success('Imagen de perfil actualizada')
    } catch (err) {
      notify.error('Error al subir imagen')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="ajustes-page">
      <header className="page-header">
        <h1 className="page-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
          Configuración
        </h1>
        <p className="page-subtitle">Personaliza tu experiencia y perfil de usuario</p>
      </header>

      <div className="grid-ajustes" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 'var(--space-6)' }}>
        
        {/* Perfil */}
        <section className="card">
          <h2 className="mb-4 flex items-center gap-2" style={{ fontSize: 'var(--font-size-lg)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            Mi Perfil
          </h2>
          
          <div className="flex-center mb-6" style={{ flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div 
              className="avatar-large" 
              style={{ 
                width: '100px', 
                height: '100px', 
                borderRadius: '50%', 
                background: 'var(--color-bg-secondary)',
                border: '2px solid var(--color-accent)',
                overflow: 'hidden',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2rem'
              }}
            >
              {user?.avatar ? (
                <img src={user.avatar} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                (user?.first_name?.[0] || user?.username?.[0] || '?').toUpperCase()
              )}
              <button 
                className="btn-avatar-edit"
                onClick={() => fileInputRef.current.click()}
                style={{ 
                  position: 'absolute', 
                  bottom: 0, 
                  right: 0, 
                  background: 'var(--color-accent)', 
                  color: 'white',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
              </button>
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              accept="image/*"
              onChange={handleAvatarChange}
            />
            <div className="text-center">
              <div style={{ fontWeight: 600 }}>{user?.username}</div>
              <div className="text-muted text-sm">{user?.role_display}</div>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="flex" style={{ flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div className="form-group">
              <label className="form-label">Nombre de usuario</label>
              <input 
                className="form-control" 
                value={formData.username}
                onChange={e => setFormData({...formData, username: e.target.value})}
              />
            </div>
            <div className="form-row">
              <div className="form-group w-full">
                <label className="form-label">Nombre</label>
                <input 
                  className="form-control" 
                  value={formData.first_name}
                  onChange={e => setFormData({...formData, first_name: e.target.value})}
                />
              </div>
              <div className="form-group w-full">
                <label className="form-label">Apellidos</label>
                <input 
                  className="form-control" 
                  value={formData.last_name}
                  onChange={e => setFormData({...formData, last_name: e.target.value})}
                />
              </div>
            </div>
            <button className="btn btn-primary" disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </form>
        </section>

        {/* Apariencia */}
        <section className="card">
          <h2 className="mb-4 flex items-center gap-2" style={{ fontSize: 'var(--font-size-lg)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 2v20"></path><path d="M12 12l8.5 8.5"></path><path d="M20 4L12 12"></path></svg>
            Apariencia
          </h2>
          
          <div className="flex" style={{ flexDirection: 'column', gap: 'var(--space-6)' }}>
            <div className="form-group">
              <label className="form-label">Tema del sistema</label>
              <div className="flex gap-4">
                <button 
                  type="button"
                  className={`btn ${theme === 'light' ? 'btn-primary' : 'btn-secondary'} w-full flex-center gap-2`}
                  onClick={() => setTheme('light')}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
                  Claro
                </button>
                <button 
                  type="button"
                  className={`btn ${theme === 'dark' ? 'btn-primary' : 'btn-secondary'} w-full flex-center gap-2`}
                  onClick={() => setTheme('dark')}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
                  Oscuro
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Tamaño de fuente ({fontSize}px)</label>
              <input 
                type="range" 
                min="12" 
                max="20" 
                step="1"
                value={fontSize}
                onChange={e => setFontSize(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--color-accent)' }}
              />
              <div className="flex justify-between text-xs text-muted">
                <span>Pequeño</span>
                <span>Normal</span>
                <span>Grande</span>
              </div>
            </div>

            <div className="alert alert-info">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
              <p>Los cambios de apariencia se guardan localmente en este navegador.</p>
            </div>
          </div>
        </section>

      </div>
    </div>
  )
}
