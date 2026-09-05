import Icon from './Icon'

/** Estado vacío estándar con acción opcional */
export default function EmptyState({ icon = 'box', title = 'Sin registros', hint, action }) {
  return (
    <div className="empty-state">
      <Icon name={icon} size={32} />
      <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{title}</div>
      {hint && <div className="text-sm">{hint}</div>}
      {action}
    </div>
  )
}
