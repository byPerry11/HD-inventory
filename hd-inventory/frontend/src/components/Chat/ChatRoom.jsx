import { useState, useEffect, useRef } from 'react'
import { useWebSocket } from '../../hooks/useWebSocket'
import api from '../../api/client'
import ChatMessage from './ChatMessage'
import ChatInput from './ChatInput'
import ConfirmModal from '../ConfirmModal'
import { playChatSound } from './chatSound'
import { BackIcon, SearchIcon, CloseIcon, RetryIcon } from './ChatIcons'

export default function ChatRoom({ conversation, onBack, currentUser }) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [typingUser, setTypingUser] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [confirmMsg, setConfirmMsg] = useState(null)
  const [uploadError, setUploadError] = useState(null)
  const [uploadProgress, setUploadProgress] = useState(null)
  const [onlineIds, setOnlineIds] = useState([])
  const [lastSeen, setLastSeen] = useState({})
  const scrollRef = useRef(null)

  // WebSocket
  const { status, sendMessage, sendTyping, sendHeartbeat, reconnect } = useWebSocket(conversation.id, {
    onMessage: (data) => {
      // Sonido solo si el mensaje es de otra persona (no el eco propio)
      const senderId = data.sender_id ?? data.sender
      if (senderId && currentUser?.id && Number(senderId) !== Number(currentUser.id)) {
        playChatSound()
      }
      setMessages(prev => {
        // Evitar duplicados (si el mensaje optimista ya tiene el mismo ID o timestamp exacto)
        // El mensaje real del WS tendrá un ID de base de datos
        if (data.id && prev.some(m => m.id === data.id)) return prev
        
        // Si hay un mensaje pendiente con el mismo contenido enviado hace muy poco, lo reemplazamos
        const pendingIdx = prev.findLastIndex(m => m.pending && m.content === data.content)
        if (pendingIdx !== -1) {
          const newMessages = [...prev]
          newMessages[pendingIdx] = { ...data, pending: false }
          return newMessages
        }

        return [...prev, data]
      })
      
      // Auto-scroll solo si el usuario está cerca del fondo
      if (scrollRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 150
        if (isNearBottom) scrollToBottom()
      }
    },
    onTyping: (data) => {
      if (data.is_typing) {
        setTypingUser(data.username)
      } else {
        setTypingUser(null)
      }
    },
    onDelete: (data) => {
      setMessages(prev => prev.filter(m => m.id !== data.id))
    },
    onPresence: (data) => {
      setOnlineIds(prev => {
        const next = new Set(prev)
        if (data.status === 'online') next.add(data.user_id)
        else next.delete(data.user_id)
        return [...next]
      })
    },
    onError: (data) => {
      console.error('Chat: error del servidor:', data.detail)
    }
  })

  // Snapshot inicial de presencia
  useEffect(() => {
    let cancelled = false
    const fetchOnline = async () => {
      try {
        const res = await api.get(`/chat/conversations/${conversation.id}/online/`)
        if (cancelled) return
        const users = res.data.users || []
        setOnlineIds(users.filter(u => u.online).map(u => u.user_id))
        const seen = {}
        users.forEach(u => { if (u.last_seen) seen[u.user_id] = u.last_seen })
        setLastSeen(seen)
      } catch (err) {
        console.error('Error fetching presence', err)
      }
    }
    fetchOnline()
    return () => { cancelled = true }
  }, [conversation.id])

  // Heartbeat cada 30 s mientras hay conexión (TTL 75 s en backend)
  useEffect(() => {
    if (status !== 'connected') return
    sendHeartbeat()
    const t = setInterval(sendHeartbeat, 30000)
    return () => clearInterval(t)
  }, [status, sendHeartbeat])

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const res = await api.get(`/chat/conversations/${conversation.id}/messages/`)
        const msgs = Array.isArray(res.data) ? res.data : (res.data.results || [])
        setMessages(msgs)
        scrollToBottom()
        api.post(`/chat/conversations/${conversation.id}/mark_read/`)
      } catch (err) {
        console.error('Error fetching messages', err)
        setMessages([])
      } finally {
        setLoading(false)
      }
    }
    fetchMessages()
  }, [conversation.id])

  const scrollToBottom = () => {
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      }
    }, 50)
  }

  const handleSendMessage = async (text) => {
    if (!text.trim()) return

    // Optimistic UI: Añadir mensaje local inmediatamente
    const tempMsg = {
      id: `temp-${Date.now()}`,
      content: text,
      sender_id: currentUser?.id,
      sender_name: currentUser?.username,
      sender_avatar: currentUser?.avatar,
      timestamp: new Date().toISOString(),
      message_type: 'text',
      pending: true
    }

    if (sendMessage(text)) {
      setMessages(prev => [...prev, tempMsg])
      scrollToBottom()
      return
    }

    // Sin WS: fallback REST para no perder el mensaje
    setMessages(prev => [...prev, tempMsg])
    scrollToBottom()
    try {
      const res = await api.post('/chat/messages/', {
        conversation: conversation.id,
        content: text,
      })
      const d = res.data
      const realMsg = {
        id: d.id,
        content: d.content,
        sender_id: d.sender,
        sender: d.sender,
        sender_name: d.sender_name,
        sender_avatar: d.sender_avatar,
        timestamp: d.timestamp,
        message_type: d.message_type || 'text',
      }
      setMessages(prev => prev.map(m => m.id === tempMsg.id ? realMsg : m))
    } catch (err) {
      console.error('Error enviando mensaje por REST', err)
      setMessages(prev => prev.map(m =>
        m.id === tempMsg.id ? { ...m, pending: false, failed: true } : m
      ))
    }
  }

  const handleRetryMessage = (msg) => {
    setMessages(prev => prev.filter(m => m.id !== msg.id))
    handleSendMessage(msg.content || '')
  }

  const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

  const handleSendFile = async (file, onProgress) => {
    setUploadError(null)
    if (!file) return
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError('Archivo excede 10MB.')
      return
    }
    const ct = file.type || ''
    const allowed = ct.startsWith('image/') || ct.startsWith('application/')
      || ct.startsWith('text/') || ct.startsWith('video/') || ct.startsWith('audio/')
    if (ct && !allowed) {
      setUploadError(`Tipo no permitido: ${ct}`)
      return
    }
    const formData = new FormData()
    formData.append('file', file)
    setUploadProgress(0)
    try {
      // El mensaje se añade desde la respuesta: visible aunque el WS esté caído.
      // (El eco WS posterior se deduplica por id.)
      const res = await api.post(`/chat/conversations/${conversation.id}/upload_attachment/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (e.total) {
            const pct = Math.round((e.loaded * 100) / e.total)
            setUploadProgress(pct)
            onProgress?.(pct)
          }
        },
      })
      const d = res.data
      const msg = {
        id: d.id,
        content: d.content ?? '',
        sender_id: d.sender_id ?? d.sender,
        sender: d.sender,
        sender_name: d.sender_name,
        sender_avatar: d.sender_avatar,
        timestamp: d.timestamp,
        message_type: d.message_type || 'file',
        attachment_url: d.attachment_url,
        file_name: d.file_name,
        file_size: d.file_size,
      }
      setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
      scrollToBottom()
    } catch (err) {
      console.error('Error uploading file', err)
      setUploadError(err.response?.data?.error || 'No se pudo subir el archivo.')
    } finally {
      setUploadProgress(null)
    }
  }

  const handlePinMessage = async (msg) => {
    if (msg.pending) return // No fijar mensajes temporales
    try {
      const response = await api.post(`/chat/messages/${msg.id}/pin/`)
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, is_pinned: response.data.is_pinned } : m))
    } catch (err) {
      console.error('Error pinning message', err)
    }
  }

  const handleDeleteMessage = async (msg) => {
    if (msg.pending) return // No eliminar mensajes temporales
    // Optimistic UI: quitar al instante; rollback si falla
    const snapshot = msg
    setMessages(prev => prev.filter(m => m.id !== msg.id))
    setConfirmMsg(null)
    try {
      await api.delete(`/chat/messages/${msg.id}/`)
      // El evento WS message_deleted confirmará (no-op si ya se quitó)
    } catch (err) {
      console.error('Error deleting message', err)
      setMessages(prev => {
        if (prev.some(m => m.id === snapshot.id)) return prev
        return [...prev, snapshot].sort((a, b) =>
          new Date(a.timestamp) - new Date(b.timestamp))
      })
      setConfirmMsg(null)
    }
  }

  const handleMessageAction = (type, m) => {
    if (type === 'delete') setConfirmMsg(m)
    else if (type === 'retry') handleRetryMessage(m)
  }

  const formatLastSeen = (ts) => {
    if (!ts) return null
    const diff = Date.now() / 1000 - ts
    if (diff < 60) return 'últ. vez hace un momento'
    if (diff < 3600) return `últ. vez hace ${Math.floor(diff / 60)} min`
    if (diff < 86400) return `últ. vez hace ${Math.floor(diff / 3600)} h`
    return `últ. vez hace ${Math.floor(diff / 86400)} d`
  }

  const presenceLabel = (() => {
    if (status !== 'connected') return null
    if (conversation.is_group) {
      const n = onlineIds.length
      return n === 0 ? 'Solo tú en línea' : `${n} en línea`
    }
    if (onlineIds.length > 0) return 'En línea'
    const peerSeen = Object.values(lastSeen)[0]
    return formatLastSeen(peerSeen) || 'Desconectado'
  })()

  const statusLabel = presenceLabel || {
    connected: 'En línea',
    connecting: 'Conectando...',
    disconnected: 'Reconectando...',
    unauthorized: 'Sesión expirada',
    forbidden: 'Sin acceso',
    notfound: 'Conversación eliminada',
    failed: 'Sin conexión',
  }[status] || 'Conectando...'

  const filteredMessages = messages.filter(m => 
    m.content?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.file_name?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="chat-room">
      <div className="chat-view-header">
        <button type="button" className="icon-btn back-btn" onClick={onBack} title="Volver a chats" aria-label="Volver a chats"><BackIcon /></button>
        <div className="chat-header-info">
          <div className="header-avatar">
            {conversation.display_avatar ? (
              <img src={conversation.display_avatar} alt={conversation.display_name} />
            ) : (
              <div className="header-avatar-placeholder">{(conversation.display_name?.[0] || '?').toUpperCase()}</div>
            )}
          </div>
          <div className="header-text">
            <div className="header-name">{conversation.display_name}</div>
            <div className={`header-status ${status}`}>
              {statusLabel}
              {(status === 'failed' || status === 'disconnected') && (
                <button type="button" className="ws-retry-btn" onClick={reconnect} title="Reintentar conexión">
                  <RetryIcon size={12} /> Reintentar
                </button>
              )}
            </div>
          </div>
        </div>
        <button type="button" className="icon-btn search-toggle-btn" onClick={() => setShowSearch(!showSearch)} title="Buscar en la conversación" aria-label="Buscar en la conversación" aria-expanded={showSearch}>
          <SearchIcon />
        </button>
      </div>

      {showSearch && (
        <div className="chat-search-bar">
          <input 
            type="text" 
            placeholder="Buscar en la conversación..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
          />
          <button type="button" className="icon-btn" onClick={() => { setSearchTerm(''); setShowSearch(false); }} title="Cerrar búsqueda" aria-label="Cerrar búsqueda"><CloseIcon size={16} /></button>
        </div>
      )}

      <div className="messages-area" ref={scrollRef}>
        {loading ? (
          <div className="loading-messages">Cargando mensajes...</div>
        ) : (
          <>
            {filteredMessages.map(msg => (
              <ChatMessage 
                key={msg.id || msg.timestamp} 
                message={msg} 
                isOwn={msg.sender_id === currentUser?.id || msg.sender === currentUser?.id}
                onPin={handlePinMessage}
                onAction={handleMessageAction}
              />
            ))}
            {typingUser && (
              <div className="typing-indicator">
                {typingUser} está escribiendo...
              </div>
            )}
          </>
        )}
      </div>

      <ChatInput 
        onSendMessage={handleSendMessage} 
        onSendFile={handleSendFile}
        onTyping={sendTyping}
        uploadProgress={uploadProgress}
      />
      {uploadError && (
        <div className="chat-upload-error" role="alert">{uploadError}</div>
      )}

      <ConfirmModal
        open={!!confirmMsg}
        title="¿Eliminar mensaje?"
        message="Este mensaje se eliminará de forma permanente para todos los participantes."
        confirmText="Eliminar"
        onConfirm={() => handleDeleteMessage(confirmMsg)}
        onCancel={() => setConfirmMsg(null)}
      />
    </div>
  )
}
