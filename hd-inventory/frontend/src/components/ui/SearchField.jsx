import Icon from './Icon'

/**
 * Campo de búsqueda estándar de la app.
 * Icono de lupa a la izquierda, botón limpiar (icono) a la derecha.
 * Uso:
 *   <SearchField label="Buscar" value={q} onChange={setQ} placeholder="..." />
 */
export default function SearchField({
  value,
  onChange,
  onKeyDown,
  onSubmit,
  placeholder = 'Buscar...',
  label,
  id,
  autoFocus = false,
  inputRef,
  width,
}) {
  const inputId = id || (label ? `search-${String(label).toLowerCase().replace(/\s+/g, '-')}` : undefined)

  const handleChange = (e) => {
    onChange?.(e.target.value, e)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && onSubmit) {
      e.preventDefault()
      onSubmit(e.target.value, e)
    }
    onKeyDown?.(e)
  }

  const clear = () => onChange?.('', undefined)

  return (
    <div className="search-field-group" style={width ? { width } : undefined}>
      {label && (
        <label className="filter-label" htmlFor={inputId}>
          {label}
        </label>
      )}
      <div className="search-field">
        <span className="search-field-icon" aria-hidden="true">
          <Icon name="search" size={16} />
        </span>
        <input
          id={inputId}
          ref={inputRef}
          type="search"
          className="form-control search-field-input"
          placeholder={placeholder}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          autoFocus={autoFocus}
          aria-label={label || placeholder}
        />
        {value && (
          <button
            type="button"
            className="btn-icon search-field-clear"
            onClick={clear}
            title="Limpiar búsqueda"
            aria-label="Limpiar búsqueda"
          >
            <Icon name="x" size={15} />
          </button>
        )}
      </div>
    </div>
  )
}
