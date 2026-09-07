import { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import ChatWidget from '../Chat/ChatWidget'
import Icon from '../ui/Icon'
import './Layout.css'

const NAV_ITEMS = [
  { to: '/despachar',  label: 'Salidas',    icon: 'cart',      roles: ['manager','supervisor','capturista'] },
  { to: '/entradas',   label: 'Entradas',   icon: 'download',  roles: ['manager','supervisor','capturista'] },
  { to: '/materiales', label: 'Inventario', icon: 'box',       roles: ['manager','supervisor','capturista'] },
  { to: '/categorias', label: 'Categorías', icon: 'folder',    roles: ['manager','supervisor'] },
  { to: '/proveedores',label: 'Proveedores', icon: 'users',    roles: ['manager','supervisor'] },
  { to: '/dashboard',  label: 'Dashboard',  icon: 'dashboard', roles: ['manager','supervisor'] },
  { to: '/vales',      label: 'Vales',      icon: 'file',      roles: ['manager','supervisor','capturista'] },
  { to: '/historial',  label: 'Historial',  icon: 'calendar',  roles: ['manager','supervisor','capturista'] },
  { to: '/ordenes',    label: 'Órdenes',    icon: 'package',   roles: ['manager','supervisor','capturista'] },
  { to: '/ajustes',    label: 'Ajustes',    icon: 'gear',      roles: ['manager','supervisor','capturista'] },
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
            <button className="btn-icon sidebar-logo-btn" title="Almacén PE — alternar menú" onClick={() => setIsCollapsed(!isCollapsed)} aria-label="Alternar menú">
              <Icon name="hexagon" size={26} />
            </button>
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
              aria-label="Ocultar menú"
            >
              <Icon name="chevronLeft" size={18} />
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
              <span className="sidebar-icon" title={isCollapsed ? item.label : ''}><Icon name={item.icon} size={18} /></span>
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
            aria-label="Cerrar sesión"
          >
            <Icon name="logout" size={16} />
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
