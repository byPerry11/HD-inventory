import Icon from './ui/Icon'
import './ConfirmModal.css'

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
          <Icon name={danger ? 'alert' : 'info'} size={40} />
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
