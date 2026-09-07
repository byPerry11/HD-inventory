import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Icon } from '../../components/ui'
import './Login.css'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(form.username, form.password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(
        err.response?.data?.detail ||
        'Credenciales incorrectas. Verifica tu usuario y contraseña.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      {/* Fondo decorativo */}
      <div className="login-bg">
        <div className="login-bg-orb login-bg-orb--1" />
        <div className="login-bg-orb login-bg-orb--2" />
      </div>

      <div className="login-container">
        {/* Logo */}
        <div className="login-brand">
          <span className="login-logo"><Icon name="hexagon" size={44} /></span>
          <h1 className="login-title">Almacén de Materiales PE</h1>
          <p className="login-subtitle">Sistema de Control de Inventario</p>
        </div>

        {/* Card de login */}
        <form className="login-card" onSubmit={handleSubmit}>
          <h2 className="login-card-title">Iniciar Sesión</h2>

          {error && (
            <div className="alert alert-error">
              <Icon name="alert" size={16} />
              <span>{error}</span>
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="username">Usuario</label>
            <input
              id="username"
              className="form-control"
              type="text"
              placeholder="Nombre de usuario"
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              autoComplete="username"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Contraseña</label>
            <input
              id="password"
              className="form-control"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg w-full login-btn"
            disabled={loading}
          >
            {loading ? (
              <><div className="spinner" style={{width:18,height:18}} /> Verificando...</>
            ) : (
              'Entrar al Sistema'
            )}
          </button>
        </form>

        <p className="login-footer">
          ¿Problemas para ingresar? Contacta al administrador del sistema.
        </p>
      </div>
    </div>
  )
}
