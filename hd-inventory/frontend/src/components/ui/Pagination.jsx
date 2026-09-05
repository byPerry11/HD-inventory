import Icon from './Icon'

/** Paginación estándar. Reemplaza .vales-pagination/.historial-pagination/.ordenes-pagination */
export default function Pagination({ page, totalPages, total, itemLabel = 'registros', onPrev, onNext, pageSize, onPageSize }) {
  return (
    <div className="pagination">
      <span className="pagination-info">
        {total} {itemLabel} · Página {page} de {totalPages}
      </span>
      <div className="pagination-controls">
        {pageSize && (
          <select className="form-control pagination-page-size" value={pageSize.value} onChange={(e) => onPageSize?.(Number(e.target.value))} aria-label="Registros por página">
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>{n} / pág</option>
            ))}
          </select>
        )}
        <button className="btn btn-secondary btn-sm" onClick={onPrev} disabled={page <= 1}>
          <Icon name="chevronLeft" size={14} /> Anterior
        </button>
        <span className="pagination-page">{page} / {totalPages}</span>
        <button className="btn btn-secondary btn-sm" onClick={onNext} disabled={page >= totalPages}>
          Siguiente <Icon name="chevronRight" size={14} />
        </button>
      </div>
    </div>
  )
}
