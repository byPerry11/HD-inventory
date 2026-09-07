import { useState, useEffect, useRef, useCallback } from 'react'
import axios from 'axios'

// Códigos de cierre de app del consumer (ver backend chat/consumers.py)
const CLOSE_UNAUTHORIZED = 4401
const CLOSE_FORBIDDEN = 4403
const CLOSE_NOT_FOUND = 4404

const MAX_ATTEMPTS = 8
const MAX_DELAY = 30000

function isExpired(token, skewSecs = 60) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return Date.now() / 1000 > payload.exp - skewSecs
  } catch {
    return true
  }
}

/** Devuelve un access token válido, renovándolo con el refresh sitoca. */
async function getValidToken() {
  let token = localStorage.getItem('access_token')
  if (token && !isExpired(token)) return token
  const refresh = localStorage.getItem('refresh_token')
  if (!refresh) return null
  try {
    const { data } = await axios.post('/api/auth/token/refresh/', { refresh })
    if (data.access) {
      localStorage.setItem('access_token', data.access)
      if (data.refresh) localStorage.setItem('refresh_token', data.refresh)
      return data.access
    }
  } catch {
    return null
  }
  return null
}

/**
 * Hook para manejar la conexión WebSocket del chat con reconexión acotada.
 *
 * Usa refs para los callbacks para evitar reconexiones infinitas
 * cuando los callbacks se recrean en cada render del componente padre.
 *
 * @param {string|number} conversationId - ID de la conversación.
 * @param {object} options - Callbacks: onMessage, onTyping, onDelete, onPresence, onError.
 * @returns {{status, sendMessage, sendTyping, sendHeartbeat, reconnect}}
 *   status: 'connecting' | 'connected' | 'disconnected' |
 *           'unauthorized' | 'forbidden' | 'notfound' | 'failed'
 */
export function useWebSocket(conversationId, options = {}) {
  const [status, setStatus] = useState('disconnected')
  const ws = useRef(null)
  const reconnectTimeout = useRef(null)
  const retryCount = useRef(0)
  const mounted = useRef(true)

  // Estabilizar callbacks con refs para que no causen reconexiones
  const callbacksRef = useRef(options)
  useEffect(() => {
    callbacksRef.current = options
  }, [options])

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const stopRetrying = useCallback((nextStatus) => {
    if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current)
    if (mounted.current) setStatus(nextStatus)
  }, [])

  const scheduleReconnect = useCallback(() => {
    if (retryCount.current >= MAX_ATTEMPTS) {
      stopRetrying('failed')
      console.error(`WebSocket: ${MAX_ATTEMPTS} intentos fallidos. Reconexión detenida.`)
      return
    }
    const delay = Math.min(1000 * Math.pow(2, retryCount.current), MAX_DELAY)
    retryCount.current++
    reconnectTimeout.current = setTimeout(() => {
      connect()
    }, delay)
  }, [stopRetrying]) // eslint-disable-line react-hooks/exhaustive-deps

  const connect = useCallback(async () => {
    if (!conversationId || !mounted.current) return

    // Cerrar conexión previa si existe
    if (ws.current && ws.current.readyState !== WebSocket.CLOSED) {
      ws.current.close()
    }

    if (mounted.current) setStatus('connecting')

    const token = await getValidToken()
    if (!mounted.current) return
    if (!token) {
      stopRetrying('unauthorized')
      console.error('WebSocket: sin token válido (sesión expirada).')
      return
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const wsUrl = `${protocol}//${host}/ws/chat/${conversationId}/?token=${token}`

    console.log(`WebSocket: Conectando a ${wsUrl}...`)

    const socket = new WebSocket(wsUrl)

    socket.onopen = () => {
      console.log('WebSocket: Conectado.')
      retryCount.current = 0
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current)
      if (mounted.current) setStatus('connected')
    }

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        const cbs = callbacksRef.current

        if (data.type === 'chat_message' && cbs.onMessage) {
          cbs.onMessage(data)
        } else if (data.type === 'user_typing' && cbs.onTyping) {
          cbs.onTyping(data)
        } else if (data.type === 'message_deleted' && cbs.onDelete) {
          cbs.onDelete(data)
        } else if (data.type === 'user_presence' && cbs.onPresence) {
          cbs.onPresence(data)
        } else if (data.type === 'error' && cbs.onError) {
          cbs.onError(data)
        } else if (data.type === 'error') {
          console.error('WebSocket: error del servidor:', data.detail)
        }
      } catch (err) {
        console.error('WebSocket: Error al procesar mensaje', err)
      }
    }

    socket.onclose = (e) => {
      if (!mounted.current) return
      // Socket obsoleto (reemplazado por una reconexión o desmontaje): ignorar
      if (ws.current !== socket) return
      if (e.code === CLOSE_UNAUTHORIZED) {
        // Token rechazado: limpiar token y reintentar una vez con refresh
        localStorage.removeItem('access_token')
        console.warn('WebSocket: token rechazado (4401). Reintentando con refresh...')
        scheduleReconnect()
        return
      }
      if (e.code === CLOSE_FORBIDDEN) {
        stopRetrying('forbidden')
        console.error('WebSocket: sin acceso a esta conversación (4403).')
        return
      }
      if (e.code === CLOSE_NOT_FOUND) {
        stopRetrying('notfound')
        console.error('WebSocket: conversación no existe (4404).')
        return
      }
      console.log(`WebSocket: Desconectado (código: ${e.code}). Reintentando...`)
      if (mounted.current) setStatus('disconnected')
      scheduleReconnect()
    }

    socket.onerror = () => {
      // El detalle real llega vía onclose; aquí solo log sutil
      console.error('WebSocket: Error detectado (ver código de cierre).')
      // No llamar a socket.close() aquí, el onclose se disparará automáticamente
    }

    ws.current = socket
  }, [conversationId, scheduleReconnect, stopRetrying])

  const reconnect = useCallback(() => {
    retryCount.current = 0
    if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current)
    connect()
  }, [connect])

  useEffect(() => {
    connect()
    return () => {
      if (ws.current) {
        const sock = ws.current
        ws.current = null // marca cierre propio para no reintentar en onclose
        // Silenciar handlers para evitar logs de error al desmontar (StrictMode)
        sock.onclose = null
        sock.onerror = null
        if (sock.readyState === WebSocket.OPEN || sock.readyState === WebSocket.CONNECTING) {
          sock.close()
        }
      }
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current)
    }
  }, [connect])

  const sendMessage = useCallback((message) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: 'message', message }))
      return true
    }
    return false
  }, [])

  const sendTyping = useCallback((isTyping) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: 'typing', is_typing: isTyping }))
    }
  }, [])

  const sendHeartbeat = useCallback(() => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: 'heartbeat' }))
    }
  }, [])

  return { status, sendMessage, sendTyping, sendHeartbeat, reconnect }
}
