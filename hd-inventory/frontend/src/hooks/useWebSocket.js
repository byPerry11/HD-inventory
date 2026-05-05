import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * Hook para manejar la conexión WebSocket del chat con reconexión automática.
 * 
 * Usa refs para los callbacks para evitar reconexiones infinitas
 * cuando los callbacks se recrean en cada render del componente padre.
 * 
 * @param {string|number} conversationId - ID de la conversación.
 * @param {object} options - Callbacks: onMessage, onTyping, onDelete, onPresence.
 */
export function useWebSocket(conversationId, options = {}) {
  const [status, setStatus] = useState('disconnected') // 'connecting', 'connected', 'disconnected'
  const ws = useRef(null)
  const reconnectTimeout = useRef(null)
  const retryCount = useRef(0)
  const maxDelay = 30000

  // Estabilizar callbacks con refs para que no causen reconexiones
  const callbacksRef = useRef(options)
  useEffect(() => {
    callbacksRef.current = options
  }, [options])

  const connect = useCallback(() => {
    if (!conversationId) return

    const token = localStorage.getItem('access_token')
    if (!token) {
      console.error('WebSocket: No se encontró token de acceso.')
      return
    }

    // Cerrar conexión previa si existe
    if (ws.current && ws.current.readyState !== WebSocket.CLOSED) {
      ws.current.close()
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const wsUrl = `${protocol}//${host}/ws/chat/${conversationId}/?token=${token}`

    console.log(`WebSocket: Conectando a ${wsUrl}...`)
    setStatus('connecting')

    const socket = new WebSocket(wsUrl)

    socket.onopen = () => {
      console.log('WebSocket: Conectado.')
      setStatus('connected')
      retryCount.current = 0
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current)
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
        }
      } catch (err) {
        console.error('WebSocket: Error al procesar mensaje', err)
      }
    }

    socket.onclose = (e) => {
      console.log(`WebSocket: Desconectado (código: ${e.code}). Reintentando...`)
      setStatus('disconnected')
      
      // Reintento con backoff exponencial
      const delay = Math.min(1000 * Math.pow(2, retryCount.current), maxDelay)
      retryCount.current++
      
      reconnectTimeout.current = setTimeout(() => {
        connect()
      }, delay)
    }

    socket.onerror = (err) => {
      console.error('WebSocket: Error detectado.', err)
      // No llamar a socket.close() aquí, el onclose se disparará automáticamente
    }

    ws.current = socket
  }, [conversationId]) // Solo depende del ID de la conversación

  useEffect(() => {
    connect()
    return () => {
      if (ws.current) {
        // Silenciar handlers para evitar logs de error al desmontar (StrictMode)
        ws.current.onclose = null
        ws.current.onerror = null
        if (ws.current.readyState === WebSocket.OPEN || ws.current.readyState === WebSocket.CONNECTING) {
          ws.current.close()
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

  return { status, sendMessage, sendTyping }
}
