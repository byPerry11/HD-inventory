import { useState, useEffect, useCallback } from 'react'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import ChatConversationList from './ChatConversationList'
import ChatRoom from './ChatRoom'
import ChatUserList from './ChatUserList'
import ChatGroupCreate from './ChatGroupCreate'
import { CloseIcon } from './ChatIcons'
import './ChatWidget.css'

export default function ChatWidget() {
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [view, setView] = useState('list') // 'list', 'users', 'chat', 'group_create'
  const [conversations, setConversations] = useState([])
  const [activeConv, setActiveConv] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  const fetchConversations = useCallback(async () => {
    if (!isOpen) return
    setLoading(true)
    try {
      const res = await api.get('/chat/conversations/')
      setConversations(res.data.results || res.data || [])
    } catch (err) {
      console.error('Error al cargar conversaciones', err)
    } finally {
      setLoading(false)
    }
  }, [isOpen])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  const handleSelectConversation = (conv) => {
    setActiveConv(conv)
    setView('chat')
  }

  const handleSelectUser = async (targetUser) => {
    try {
      const res = await api.post('/chat/conversations/find_or_create/', { 
        target_user_id: targetUser.id 
      })
      setActiveConv(res.data)
      setView('chat')
      fetchConversations() // Actualizar lista en background
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
    fetchConversations()
  }

  const handleBack = () => {
    if (view === 'chat' || view === 'users' || view === 'group_create') {
      setView('list')
      setActiveConv(null)
      fetchConversations()
    }
  }

  return (
    <div className={`chat-widget-container ${isOpen ? 'chat-widget--open' : ''}`}>
      <button className="chat-fab" onClick={() => setIsOpen(!isOpen)} title="Abrir Chat">
        {isOpen ? (
          <span className="fab-close"><CloseIcon /></span>
        ) : (
          <div className="fab-icon-wrapper">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            {conversations.some(c => c.unread_count > 0) && (
              <span className="fab-unread-dot"></span>
            )}
          </div>
        )}
      </button>

      {isOpen && (
        <div className="chat-panel">
          {view === 'list' && (
            <ChatConversationList 
              conversations={conversations} 
              activeId={activeConv?.id}
              onSelect={handleSelectConversation}
              onNewChat={() => setView('users')}
              isLoading={loading}
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
