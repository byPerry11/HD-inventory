import './ConfirmModal.css'

const ICON_DANGER = (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
)
const ICON_INFO = (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="16" x2="12" y2="12"/>
    <line x1="12" y1="8" x2="12.01" y2="8"/>
  </svg>
)

/**
 * Ventana emergente de confirmación dentro de la app (sin window.confirm).
 *
 * props:
 *  - open        (bool)   visible
 *  - title       (string) título del modal
 *  - message     (string) mensaje de advertencia / pregunta
 *  - confirmText (string) texto del botón confirmar (default: 'Confirmar')
 *  - cancelText  (string) texto del botón cancelar (default: 'Cancelar')
 *  - danger      (bool)   estilo rojo de advertencia (default: true)
 *  - loading     (bool)   deshabilita botones y muestra spinner
 *  - onConfirm   (fn)     se llama al confirmar
 *  - onCancel    (fn)     se llama al cancelar/cerrar
 */
export default function ConfirmModal({
  open,
  title = '¿Estás seguro?',
  message = '',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  danger = true,
  loading = false,
  children,
  onConfirm,
  onCancel,
}) {
  if (!open) return null

  return (
    <div className="confirm-modal-backdrop" onClick={() => !loading && onCancel()}>
      <div
        className="confirm-modal"
        role="dialog"
        aria-modal="true"
        onClick={e => e.stopPropagation()}
      >
        <div className={`confirm-icon ${danger ? 'confirm-icon--danger' : 'confirm-icon--info'}`}>
          {danger ? ICON_DANGER : ICON_INFO}
        </div>
        <h3 className="confirm-title">{title}</h3>
        {message && <p className="confirm-message">{message}</p>}
        {children}
        <div className="confirm-actions">
          <button className="btn btn-secondary" onClick={onCancel} disabled={loading}>
            {cancelText}
          </button>
          <button
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="spinner" style={{ width: 14, height: 14 }} /> Procesando...
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
