import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import ChatConversationList from './ChatConversationList'
import ChatRoom from './ChatRoom'
import ChatUserList from './ChatUserList'
import ChatGroupCreate from './ChatGroupCreate'
import { CloseIcon, ChatBubbleIcon } from './ChatIcons'
import { playChatSound } from './chatSound'
import './ChatWidget.css'

export default function ChatWidget() {
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [view, setView] = useState('list') // 'list', 'users', 'chat', 'group_create'
  const [conversations, setConversations] = useState([])
  const [onlineMap, setOnlineMap] = useState({})
  const [activeConv, setActiveConv] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  const fetchConversations = useCallback(async (withSpinner = true) => {
    if (withSpinner) setLoading(true)
    try {
      const [convRes, onlineRes] = await Promise.all([
        api.get('/chat/conversations/'),
        api.get('/chat/conversations/online-summary/').catch(() => ({ data: {} })),
      ])
      setConversations(convRes.data.results || convRes.data || [])
      setOnlineMap(onlineRes.data || {})
    } catch (err) {
      console.error('Error al cargar conversaciones', err)
    } finally {
      if (withSpinner) setLoading(false)
    }
  }, [])

  // Carga inicial + sondeo en segundo plano para que el distintivo de
  // no leídos del botón flotante esté al día aunque el panel esté cerrado.
  useEffect(() => {
    fetchConversations(true)
    const t = setInterval(() => fetchConversations(false), 15000)
    const onFocus = () => fetchConversations(false)
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(t)
      window.removeEventListener('focus', onFocus)
    }
  }, [fetchConversations])

  // Al abrir el panel, refrescar con indicador.
  useEffect(() => {
    if (isOpen) fetchConversations(true)
  }, [isOpen, fetchConversations])

  const totalUnread = useMemo(
    () => conversations.reduce((acc, c) => acc + (c.unread_count || 0), 0),
    [conversations]
  )
  const unreadLabel = totalUnread > 99 ? '99+' : String(totalUnread)

  // Sonido cuando crecen los no leídos y no hay una sala abierta
  // (con sala abierta avisa la propia ChatRoom; así no suena dos veces).
  const prevUnreadRef = useRef(null)
  useEffect(() => {
    if (prevUnreadRef.current === null) {
      prevUnreadRef.current = totalUnread
      return
    }
    if (totalUnread > prevUnreadRef.current && (!isOpen || view === 'list')) {
      playChatSound()
    }
    prevUnreadRef.current = totalUnread
  }, [totalUnread, isOpen, view])

  const handleSelectConversation = (conv) => {
    setActiveConv(conv)
    setView('chat')
    // Limpieza optimista del distintivo: el mark_read de la sala lo confirma.
    setConversations(prev => prev.map(c => (c.id === conv.id ? { ...c, unread_count: 0 } : c)))
  }

  const handleSelectUser = async (targetUser) => {
    try {
      const res = await api.post('/chat/conversations/find_or_create/', {
        target_user_id: targetUser.id
      })
      setActiveConv(res.data)
      setView('chat')
      fetchConversations(false) // Actualizar lista en background
    } catch (err) {
      console.error('Error al iniciar chat', err)
    }
  }

  const handleCreateGroup = () => {
    setView('group_create')
  }

  const handleGroupCreated = (newConv) => {
    setActiveConv(newConv)
    setView('chat')
    fetchConversations(false)
  }

  const handleBack = () => {
    if (view === 'chat' || view === 'users' || view === 'group_create') {
      setView('list')
      setActiveConv(null)
      fetchConversations(false)
    }
  }

  return (
    <div className={`chat-widget-container ${isOpen ? 'chat-widget--open' : ''}`}>
      <button
        type="button"
        className="chat-fab"
        onClick={() => setIsOpen(!isOpen)}
        title={isOpen ? 'Cerrar chat' : 'Abrir chat'}
        aria-label={isOpen ? 'Cerrar chat' : totalUnread > 0 ? `Abrir chat, ${totalUnread} mensajes sin leer` : 'Abrir chat'}
        aria-expanded={isOpen}
      >
        {isOpen ? (
          <span className="fab-close"><CloseIcon size={22} /></span>
        ) : (
          <span className="fab-icon-wrapper">
            <ChatBubbleIcon />
            {totalUnread > 0 && (
              <span className="fab-unread-badge" role="status" aria-label={`${totalUnread} sin leer`}>
                {unreadLabel}
              </span>
            )}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="chat-panel" role="dialog" aria-label="Chat">
          {view === 'list' && (
            <ChatConversationList
              conversations={conversations}
              activeId={activeConv?.id}
              onSelect={handleSelectConversation}
              onNewChat={() => setView('users')}
              isLoading={loading}
              onlineMap={onlineMap}
              currentUserId={user?.id}
            />
          )}

          {view === 'users' && (
            <ChatUserList
              onSelectUser={handleSelectUser}
              onBack={handleBack}
              onCreateGroup={handleCreateGroup}
            />
          )}

          {view === 'group_create' && (
            <ChatGroupCreate
              onBack={() => setView('users')}
              onCreateSuccess={handleGroupCreated}
            />
          )}

          {view === 'chat' && activeConv && (
            <ChatRoom
              conversation={activeConv}
              currentUser={user}
              onBack={handleBack}
            />
          )}
        </div>
      )}
    </div>
  )
}
