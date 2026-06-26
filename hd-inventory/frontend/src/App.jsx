import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { ThemeProvider } from './context/ThemeContext'
import Layout from './components/Layout/Layout'
import Login from './pages/Login/Login'
import ChangePassword from './pages/Auth/ChangePassword'
import Entradas from './pages/Entradas/Entradas'
import Vales from './pages/Vales/Vales'
import Materiales from './pages/Materiales/Materiales'
import Dashboard from './pages/Dashboard/Dashboard'
import Despachar from './pages/Despachar/Despachar'
import Historial from './pages/Historial/Historial'
import OrdenesCompra from './pages/OrdenesCompra/OrdenesCompra'
import Categorias from './pages/Categorias/Categorias'
import Proveedores from './pages/Proveedores/Proveedores'
import Ajustes from './pages/Ajustes/Ajustes'
import './index.css'

/** Redirección base según rol */
function RootRedirect() {
  const { user } = useAuth()
  if (user?.role === 'capturista') return <Navigate to="/despachar" replace />
  return <Navigate to="/dashboard" replace />
}

/** Ruta protegida — redirige a login si no hay sesión */
function PrivateRoute({ children, checkPasswordChange = true }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading-container"><div className="spinner" /></div>
  
  if (!user) return <Navigate to="/login" replace />
  
  if (checkPasswordChange && user.must_change_password) {
    return <Navigate to="/cambiar-password" replace />
  }

  return children
}

/** Ruta protegida por rol */
function RoleRoute({ children, allowedRoles }) {
  const { user } = useAuth()
  if (!allowedRoles.includes(user?.role)) {
    return <Navigate to="/" replace />
  }
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/cambiar-password" element={<PrivateRoute checkPasswordChange={false}><ChangePassword /></PrivateRoute>} />
              <Route
                path="/"
                element={
                  <PrivateRoute>
                    <Layout />
                  </PrivateRoute>
                }
              >
                {/* Redirect raíz según rol */}
                <Route index element={<RootRedirect />} />

                {/* Accesible para todos los roles */}
                <Route path="despachar"  element={<Despachar />} />
                <Route path="entradas"   element={<Entradas />} />
                <Route path="vales"      element={<Vales />} />
                <Route path="materiales" element={<Materiales />} />
                <Route path="ajustes"    element={<Ajustes />} />

                {/* Rutas Admin/Supervisor */}
                <Route path="dashboard"   element={<RoleRoute allowedRoles={['manager', 'supervisor']}><Dashboard /></RoleRoute>} />
                <Route path="historial"   element={<RoleRoute allowedRoles={['manager', 'supervisor']}><Historial /></RoleRoute>} />
                <Route path="ordenes"     element={<RoleRoute allowedRoles={['manager', 'supervisor', 'capturista']}><OrdenesCompra /></RoleRoute>} />
                <Route path="categorias"  element={<RoleRoute allowedRoles={['manager', 'supervisor']}><Categorias /></RoleRoute>} />
                <Route path="proveedores" element={<RoleRoute allowedRoles={['manager', 'supervisor']}><Proveedores /></RoleRoute>} />
              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
