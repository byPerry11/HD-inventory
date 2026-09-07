/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useRef } from 'react'
import Icon from '../components/ui/Icon'
import './Toast.css'

/* ─── Tipos de toast ────────────────────────────────────────────── */
// success | error | warning | info

const ToastContext = createContext(null)

let _id = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef({})

  const dismiss = useCallback((id) => {
    // Marcar como saliendo para animación de salida
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t))
    // Eliminar después de la animación
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 320)
    clearTimeout(timers.current[id])
  }, [])

  const toast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++_id
    setToasts(prev => [...prev, { id, message, type, exiting: false }])

    if (duration > 0) {
      timers.current[id] = setTimeout(() => dismiss(id), duration)
    }
    return id
  }, [dismiss])

  // Atajos por tipo
  const notify = {
    success: (msg, d) => toast(msg, 'success', d),
    error:   (msg, d) => toast(msg, 'error',   d ?? 6000),
    warning: (msg, d) => toast(msg, 'warning', d),
    info:    (msg, d) => toast(msg, 'info',    d),
    toast,
    showToast: (msg, type = 'info', d) => toast(msg, type, d),
  }

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`toast toast--${t.type} ${t.exiting ? 'toast--exit' : ''}`}
            role="alert"
          >
            <span className="toast-icon"><Icon name={TOAST_ICONS[t.type]} size={18} /></span>
            <span className="toast-message">{t.message}</span>
            <button className="toast-close" onClick={() => dismiss(t.id)} aria-label="Cerrar" title="Cerrar">
              <Icon name="x" size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

const TOAST_ICONS = {
  success: 'checkCircle',
  error: 'xCircle',
  warning: 'alert',
  info: 'info',
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>')
  return ctx
}
