import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import api from '../../api/client'
import './ChangePassword.css'

export default function ChangePassword() {
  const { user, checkAuth } = useAuth()
  const navigate = useNavigate()
  const notify = useToast()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  // Redirigir si no necesita cambiar contraseña
  useEffect(() => {
    if (user && !user.must_change_password) {
      navigate('/')
    }
  }, [user, navigate])

  const lengthOk = password.length >= 8
  const hasLetter = /[a-zA-Z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  const passwordsMatch = password === confirmPassword && password !== ''

  const isFormValid = lengthOk && hasLetter && hasNumber && passwordsMatch

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!isFormValid) return

    setLoading(true)
    try {
      await api.patch('/auth/change-password/', { new_password: password })
      notify.success('Contraseña actualizada con éxito. Redirigiendo...')
      
      // Actualizar contexto de auth para refrescar user.must_change_password
      await checkAuth()
      navigate('/')
      
    } catch (err) {
      notify.error(err.response?.data?.detail || 'Error al actualizar contraseña.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="change-password-container">
      <div className="change-password-card">
        <div className="change-password-header">
          <h2>Configura tu Contraseña</h2>
          <p>Por seguridad, debes cambiar tu contraseña inicial antes de acceder al sistema.</p>
        </div>

        <form onSubmit={handleSubmit} className="change-password-form">
          <div className="form-group">
            <label className="form-label">Nueva Contraseña</label>
            <input
              type="password"
              className="form-control"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ingresa tu nueva contraseña"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Confirmar Contraseña</label>
            <input
              type="password"
              className="form-control"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repite tu contraseña"
            />
          </div>

          <div className="password-requirements">
            <p className="requirements-title">Tu contraseña debe contener:</p>
            <ul className="requirements-list">
              <li className={lengthOk ? 'req-met' : ''}>
                <span className="req-icon">{lengthOk ? '✓' : '○'}</span> Mínimo 8 caracteres
              </li>
              <li className={hasLetter ? 'req-met' : ''}>
                <span className="req-icon">{hasLetter ? '✓' : '○'}</span> Al menos una letra
              </li>
              <li className={hasNumber ? 'req-met' : ''}>
                <span className="req-icon">{hasNumber ? '✓' : '○'}</span> Al menos un número
              </li>
              <li className={passwordsMatch ? 'req-met' : (confirmPassword ? 'req-error' : '')}>
                <span className="req-icon">{passwordsMatch ? '✓' : (confirmPassword ? '✗' : '○')}</span> Las contraseñas coinciden
              </li>
            </ul>
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={!isFormValid || loading}
            style={{ marginTop: '1rem', justifyContent: 'center' }}
          >
            {loading ? (
              <><span className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} /> Guardando...</>
            ) : (
              'Guardar y Continuar'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
