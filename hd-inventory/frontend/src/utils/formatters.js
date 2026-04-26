/**
 * Limpia el código de barras de la credencial del empleado.
 * Formato esperado: un dígito al inicio (usualmente 0) + número de nómina + una letra al final.
 * Ejemplo: 018598A -> 18598
 */
export const cleanBadgeID = (raw) => {
  if (!raw) return ''
  
  // Si tiene el formato de credencial (ej: 0 + números + letra)
  // Generalmente son 7 u 8 caracteres en total
  const regex = /^(\d)(\d+)([A-Za-z])$/
  const match = raw.match(regex)
  
  if (match) {
    // Retornamos solo el grupo del centro (el número de nómina)
    return match[2]
  }
  
  return raw
}
