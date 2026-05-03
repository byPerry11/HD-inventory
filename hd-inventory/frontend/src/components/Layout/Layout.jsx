import { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import ChatWidget from '../Chat/ChatWidget'
import './Layout.css'

const NAV_ITEMS = [
  { to: '/despachar',  label: 'Despachar',  icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>, roles: ['manager','supervisor','capturista'] },
  { to: '/entradas',   label: 'Entradas',   icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>, roles: ['manager','supervisor','capturista'] },
  { to: '/materiales', label: 'Materiales', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>, roles: ['manager','supervisor','capturista'] },
  { to: '/categorias', label: 'Categorías', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>, roles: ['manager','supervisor'] },
  { to: '/proveedores',label: 'Proveedores', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>, roles: ['manager','supervisor'] },
  { to: '/dashboard',  label: 'Dashboard',  icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>, roles: ['manager','supervisor'] },
  { to: '/historial',  label: 'Historial',  icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>, roles: ['manager','supervisor'] },
  { to: '/ordenes',    label: 'Órdenes',    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>, roles: ['manager','supervisor'] },
  { to: '/ajustes',    label: 'Ajustes',    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>, roles: ['manager','supervisor','capturista'] },
]

const ROLE_COLOR = {
  manager:     '#1f6feb',
  supervisor:  '#3fb950',
  capturista:  '#8b949e',
}

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('hd_sidebar_collapsed') === 'true'
  })

  useEffect(() => {
    localStorage.setItem('hd_sidebar_collapsed', isCollapsed)
  }, [isCollapsed])

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  const navItems = NAV_ITEMS.filter(item => item.roles.includes(user?.role))
  const showChat = location.pathname !== '/despachar'

  const renderAvatar = () => {
    if (user?.avatar) {
      return <img src={user.avatar} alt="User" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
    }
    return (user?.first_name?.[0] || user?.username?.[0] || '?').toUpperCase()
  }

  return (
    <div className={`app-layout ${isCollapsed ? 'layout-collapsed' : ''}`}>
      {/* ─── Sidebar ────────────────────────────────────── */}
      <aside className="sidebar">
        {/* Logo / Brand */}
        <div className="sidebar-brand" style={{ justifyContent: isCollapsed ? 'center' : 'space-between', flexDirection: isCollapsed ? 'column' : 'row' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <span className="sidebar-logo" title="Almacén PE" style={{ cursor: 'pointer' }} onClick={() => setIsCollapsed(!isCollapsed)}>⬡</span>
            {!isCollapsed && (
              <div>
                <div className="sidebar-title">Almacén PE</div>
                <div className="sidebar-subtitle">Materiales</div>
              </div>
            )}
          </div>
          {!isCollapsed && (
            <button 
              className="btn-toggle-sidebar" 
              onClick={() => setIsCollapsed(true)}
              title="Ocultar menú"
            >
              «
            </button>
          )}
        </div>

        {/* Navegación */}
        <nav className="sidebar-nav">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'sidebar-link--active' : ''}`
              }
            >
              <span className="sidebar-icon" title={isCollapsed ? item.label : ''}>{item.icon}</span>
              {!isCollapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Usuario */}
        <div className="sidebar-footer" style={{ flexDirection: isCollapsed ? 'column' : 'row', gap: isCollapsed ? 'var(--space-2)' : 'var(--space-3)', justifyContent: 'center' }}>
          {!isCollapsed ? (
            <div className="sidebar-user" onClick={() => navigate('/ajustes')} style={{ cursor: 'pointer' }}>
              <div
                className="sidebar-avatar"
                style={{ background: user?.avatar ? 'transparent' : ROLE_COLOR[user?.role] }}
              >
                {renderAvatar()}
              </div>
              <div className="sidebar-user-info">
                <div className="sidebar-user-name">
                  {user?.first_name || user?.username}
                </div>
                <div
                  className="sidebar-user-role"
                  style={{ color: ROLE_COLOR[user?.role] }}
                >
                  {user?.role_display || user?.role}
                </div>
              </div>
            </div>
          ) : (
            <div
              className="sidebar-avatar"
              style={{ background: user?.avatar ? 'transparent' : ROLE_COLOR[user?.role] }}
              title={`${user?.first_name || user?.username} - ${user?.role}`}
              onClick={() => navigate('/ajustes')}
            >
              {renderAvatar()}
            </div>
          )}
          <button
            className="sidebar-logout"
            onClick={handleLogout}
            title="Cerrar sesión"
          >
            ⏻
          </button>
        </div>
      </aside>

      {/* ─── Contenido principal ─────────────────────────── */}
      <main className="main-content">
        <Outlet />
      </main>

      {/* Chat Widget */}
      {showChat && <ChatWidget />}
    </div>
  )
}
