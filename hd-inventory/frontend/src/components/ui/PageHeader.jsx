/** Encabezado de página estándar.
 *  Uso: <PageHeader title="Inventario" subtitle="..." actions={<><button className="btn btn-primary">…</button></>} icon="box" />
 */
import Icon from './Icon'

export default function PageHeader({ title, subtitle, actions, icon }) {
  return (
    <div className="page-header mb-8">
      <div className="page-header-text">
        <h1 className="page-title">
          {icon && <Icon name={icon} size={22} />}
          {title}
        </h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  )
}
