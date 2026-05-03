import { useState, useEffect } from 'react'

/**
 * Hook para mantener un estado de React sincronizado con sessionStorage (por defecto).
 * Útil para búsquedas, filtros o formularios que no deben perderse al cambiar de página.
 * 
 * @param {string} key - La clave bajo la cual se guardará en storage.
 * @param {any} defaultValue - El valor inicial si no hay nada en storage.
 * @param {string} storageType - 'session' (por defecto) o 'local'.
 */
export function usePersistentState(key, defaultValue, storageType = 'session') {
  const [state, setState] = useState(() => {
    try {
      const storage = storageType === 'local' ? window.localStorage : window.sessionStorage
      const item = storage.getItem(key)
      if (item !== null && item !== undefined) {
        return JSON.parse(item)
      }
      return defaultValue
    } catch (error) {
      console.warn(`Error al leer storage ("${key}"):`, error)
      return defaultValue
    }
  })

  useEffect(() => {
    try {
      const storage = storageType === 'local' ? window.localStorage : window.sessionStorage
      if (state === undefined || state === null) {
        storage.removeItem(key)
      } else {
        storage.setItem(key, JSON.stringify(state))
      }
    } catch (error) {
      console.warn(`Error al guardar storage ("${key}"):`, error)
    }
  }, [key, state, storageType])

  return [state, setState]
}
