import { useState, useCallback } from 'react'

// Sonido de notificación del chat. El archivo vive en el backend
// (hd-inventory/media/sounds/) y se sirve por /media en dev y prod.
const SOUND_URL = '/media/sounds/notification_o14egLP.mp3'
const STORAGE_KEY = 'hd_chat_sound_muted'

let audio = null
let unlocked = false

function getAudio() {
  if (!audio) {
    audio = new Audio(SOUND_URL)
    audio.preload = 'auto'
    audio.volume = 0.8
  }
  return audio
}

// Los navegadores bloquean el audio hasta el primer gesto del usuario.
// Este desbloqueo único permite que el sonido suene al llegar mensajes.
function unlockOnce() {
  if (unlocked) return
  unlocked = true
  try {
    const a = getAudio()
    // Carga el archivo dentro del gesto para habilitar futuras reproducciones
    const p = a.play()
    if (p) {
      p.then(() => {
        a.pause()
        a.currentTime = 0
      }).catch(() => {})
    }
  } catch {
    /* sin audio disponible */
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', unlockOnce, { once: true })
  window.addEventListener('keydown', unlockOnce, { once: true })
}

export function isChatSoundMuted() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function setChatSoundMuted(muted) {
  try {
    localStorage.setItem(STORAGE_KEY, muted ? '1' : '0')
  } catch {
    /* almacenamiento no disponible */
  }
}

/** Reproduce el sonido de mensaje recibido (respeta silencio y autoplay). */
export function playChatSound() {
  if (isChatSoundMuted()) return
  try {
    const a = getAudio()
    a.currentTime = 0
    const p = a.play()
    if (p) p.catch(() => {})
  } catch {
    /* archivo no disponible o autoplay bloqueado */
  }
}

/** Estado del interruptor de sonido para la interfaz. */
export function useChatSound() {
  const [muted, setMuted] = useState(isChatSoundMuted)
  const toggle = useCallback(() => {
    setMuted(prev => {
      const next = !prev
      setChatSoundMuted(next)
      return next
    })
  }, [])
  return [muted, toggle]
}
