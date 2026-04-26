import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import Layout from './components/Layout/Layout'
import Login from './pages/Login/Login'
import Entradas from './pages/Entradas/Entradas'
import Salidas from './pages/Salidas/Salidas'
import Vales from './pages/Salidas/Vales'
import Materiales from './pages/Materiales/Materiales'
import Dashboard from './pages/Dashboard/Dashboard'
import Despachar from './pages/Despachar/Despachar'
import Historial from './pages/Historial/Historial'
import OrdenesCompra from './pages/OrdenesCompra/OrdenesCompra'
import './index.css'

/** Redirección base según rol */
function RootRedirect() {
  const { user } = useAuth()
  if (user?.role === 'capturista') return <Navigate to="/despachar" replace />
  return <Navigate to="/dashboard" replace />
}

/** Ruta protegida — redirige a login si no hay sesión */
function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading-container"><div className="spinner" /></div>
  return user ? children : <Navigate to="/login" replace />
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
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
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
              <Route path="salidas"    element={<Salidas />} />
              <Route path="vales"      element={<Vales />} />
              <Route path="materiales" element={<Materiales />} />

              {/* Rutas Admin/Supervisor */}
              <Route path="dashboard" element={<RoleRoute allowedRoles={['manager', 'supervisor']}><Dashboard /></RoleRoute>} />
              <Route path="historial" element={<RoleRoute allowedRoles={['manager', 'supervisor']}><Historial /></RoleRoute>} />
              <Route path="ordenes" element={<RoleRoute allowedRoles={['manager', 'supervisor']}><OrdenesCompra /></RoleRoute>} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
