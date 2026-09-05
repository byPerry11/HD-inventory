import { FileIcon } from './ChatIcons'

export default function ChatConversationList({ conversations, activeId, onSelect, onNewChat, isLoading }) {
  if (isLoading) {
    return (
      <div className="chat-list-skeleton">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="skeleton-item">
            <div className="skeleton-avatar" />
            <div className="skeleton-text" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="chat-conv-list">
      <div className="chat-list-header">
        <h3>Chats</h3>
        <button className="new-chat-btn" onClick={onNewChat} title="Nuevo Chat">
          <span>+</span>
        </button>
      </div>
      
      {conversations.length === 0 ? (
        <div className="empty-chat-state">
          <p>No tienes conversaciones aún.</p>
          <button onClick={onNewChat}>Iniciar un chat</button>
        </div>
      ) : (
        conversations.map(conv => {
          const lastMsg = conv.last_message
          return (
            <div 
              key={conv.id} 
              className={`conv-item ${activeId === conv.id ? 'active' : ''} ${conv.unread_count > 0 ? 'unread' : ''}`}
              onClick={() => onSelect(conv)}
            >
              <div className="conv-avatar">
                {conv.display_avatar ? (
                  <img src={conv.display_avatar} alt={conv.display_name} />
                ) : (
                  <div className="conv-avatar-placeholder">{(conv.display_name?.[0] || '?').toUpperCase()}</div>
                )}
              </div>
              
              <div className="conv-info">
                <div className="conv-header">
                  <span className="conv-name">{conv.display_name}</span>
                  {lastMsg && (
                    <span className="conv-time">
                      {new Date(lastMsg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
                <div className="conv-footer">
                  <span className="conv-preview">
                    {lastMsg ? (
                      lastMsg.message_type === 'text' 
                        ? lastMsg.content 
                        : <><FileIcon size={14} /> {lastMsg.message_type}</>
                    ) : 'Sin mensajes'}
                  </span>
                  {conv.unread_count > 0 && (
                    <span className="unread-badge">{conv.unread_count}</span>
                  )}
                </div>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
