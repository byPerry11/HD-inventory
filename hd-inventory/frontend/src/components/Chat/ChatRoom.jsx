import { useState, useEffect, useRef } from 'react'
import { useWebSocket } from '../../hooks/useWebSocket'
import api from '../../api/client'
import ChatMessage from './ChatMessage'
import ChatInput from './ChatInput'
import ConfirmModal from '../ConfirmModal'
import { BackIcon, SearchIcon, CloseIcon } from './ChatIcons'

export default function ChatRoom({ conversation, onBack, currentUser }) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [typingUser, setTypingUser] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [confirmMsg, setConfirmMsg] = useState(null)
  const scrollRef = useRef(null)

  // WebSocket
  const { status, sendMessage, sendTyping } = useWebSocket(conversation.id, {
    onMessage: (data) => {
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
    }
  })

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

  const handleSendMessage = (text) => {
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
    
    setMessages(prev => [...prev, tempMsg])
    scrollToBottom()
    sendMessage(text)
  }

  const handleSendFile = async (file) => {
    const formData = new FormData()
    formData.append('file', file)
    try {
      // Para archivos, el mensaje aparecerá cuando el servidor confirme la subida y dispare el WS
      await api.post(`/chat/conversations/${conversation.id}/upload_attachment/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
    } catch (err) {
      console.error('Error uploading file', err)
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
    try {
      await api.delete(`/chat/messages/${msg.id}/`)
      setConfirmMsg(null)
    } catch (err) {
      console.error('Error deleting message', err)
      setConfirmMsg(null)
    }
  }

  const filteredMessages = messages.filter(m => 
    m.content?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.file_name?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="chat-room">
      <div className="chat-view-header">
        <button className="back-btn" onClick={onBack}><BackIcon /></button>
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
              {status === 'connected' ? 'En línea' : 'Conectando...'}
            </div>
          </div>
        </div>
        <button className="search-toggle-btn" onClick={() => setShowSearch(!showSearch)}>
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
          <button onClick={() => { setSearchTerm(''); setShowSearch(false); }}><CloseIcon size={16} /></button>
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
                onAction={(type, m) => type === 'delete' ? setConfirmMsg(m) : null}
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
      />

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
