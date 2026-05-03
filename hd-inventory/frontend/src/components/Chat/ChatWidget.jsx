import { useState, useEffect, useRef } from 'react'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import './ChatWidget.css'

export default function ChatWidget() {
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [view, setView] = useState('list') // 'list', 'users', 'chat'
  const [conversations, setConversations] = useState([])
  const [users, setUsers] = useState([])
  const [activeConv, setActiveConv] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  
  const ws = useRef(null)
  const scrollRef = useRef(null)

  // ─── Carga inicial ──────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      if (view === 'list') fetchConversations()
      if (view === 'users') fetchUsers()
    }
  }, [isOpen, view])

  const fetchConversations = async () => {
    try {
      const res = await api.get('/chat/conversations/')
      // Manejar la paginación de DRF (res.data.results) o array directo (res.data)
      setConversations(res.data.results || res.data || [])
    } catch (err) {
      console.error('Error al cargar conversaciones', err)
    }
  }

  const fetchUsers = async () => {
    try {
      const res = await api.get('/auth/users/')
      setUsers(res.data.results || res.data || [])
    } catch (err) {
      console.error('Error al cargar usuarios', err)
    }
  }

  // ─── WebSocket Logic ───────────────────────────────────────
  useEffect(() => {
    if (activeConv) {
      // Cargar historial previo
      fetchMessages(activeConv.id)

      // Conectar WS
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const host = window.location.host
      const wsUrl = `${protocol}//${host}/ws/chat/${activeConv.id}/`
      
      ws.current = new WebSocket(wsUrl)

      ws.current.onmessage = (e) => {
        const data = JSON.parse(e.data)
        if (data.type === 'chat_message') {
          setMessages(prev => [...prev, {
            id: Date.now(),
            sender_name: data.sender_name,
            sender: data.sender_id,
            content: data.message,
            timestamp: data.timestamp
          }])
        }
      }

      return () => {
        if (ws.current) ws.current.close()
      }
    }
  }, [activeConv])

  const fetchMessages = async (id) => {
    try {
      const res = await api.get(`/chat/conversations/${id}/messages/`)
      setMessages(res.data)
    } catch (err) {
      console.error('Error al cargar mensajes', err)
    }
  }

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // ─── Acciones ───────────────────────────────────────────────
  const startChat = async (targetUser) => {
    try {
      // Intentar buscar si ya existe una charla o crear una nueva
      const res = await api.post('/chat/conversations/', { participants: [targetUser.id] })
      setActiveConv(res.data)
      setView('chat')
    } catch (err) {
      console.error('Error al iniciar chat', err)
    }
  }

  const sendMessage = () => {
    if (!newMessage.trim() || !ws.current) return
    
    ws.current.send(JSON.stringify({
      message: newMessage
    }))
    setNewMessage('')
  }

  // ─── Render ────────────────────────────────────────────────
  return (
    <div className={`chat-widget-container ${isOpen ? 'chat-widget--open' : ''}`}>
      <button className="chat-fab" onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? '✕' : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>}
      </button>

      {isOpen && (
        <div className="chat-panel">
          <div className="chat-panel-header">
            {view === 'chat' && <button onClick={() => { setView('list'); setActiveConv(null); }}>←</button>}
            <h3>
              {view === 'list' && 'Chats de Equipo'}
              {view === 'users' && 'Nuevo Mensaje'}
              {view === 'chat' && (activeConv?.participants_details?.find(p => p.id !== user.id)?.username || 'Chat')}
            </h3>
            {view === 'list' && <button onClick={() => setView('users')}>+</button>}
          </div>

          <div className="chat-panel-body" ref={scrollRef}>
            {view === 'list' && (
              <div className="conv-list">
                {conversations.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state-icon">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                    </div>
                    <h4>Aún no hay chats</h4>
                    <p>Comienza una nueva conversación con alguien de tu equipo.</p>
                    <button className="btn-start-chat" onClick={() => setView('users')}>
                      Iniciar Nuevo Chat
                    </button>
                  </div>
                ) : (
                  conversations.map(c => (
                    <div key={c.id} className="conv-item" onClick={() => { setActiveConv(c); setView('chat'); }}>
                      <div className="conv-avatar">{(c.participants_details?.find(p => p.id !== user.id)?.username?.[0] || '?').toUpperCase()}</div>
                      <div className="conv-info">
                        <div className="conv-name">{c.participants_details?.find(p => p.id !== user.id)?.username}</div>
                        <div className="conv-last">{c.last_message?.content || 'Inicia una conversación'}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {view === 'users' && (
              <div className="user-list">
                {users.map(u => (
                  <div key={u.id} className="user-item" onClick={() => startChat(u)}>
                    <div className="user-avatar">{u.username[0].toUpperCase()}</div>
                    <span>{u.username}</span>
                  </div>
                ))}
              </div>
            )}

            {view === 'chat' && (
              <div className="message-list">
                {messages.map(m => (
                  <div key={m.id} className={`message-bubble ${m.sender === user.id ? 'msg-own' : 'msg-other'}`}>
                    <div className="msg-content">{m.content}</div>
                    <div className="msg-time">{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {view === 'chat' && (
            <div className="chat-panel-footer">
              <input 
                type="text" 
                placeholder="Escribe un mensaje..." 
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              />
              <button onClick={sendMessage}>Enviar</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
