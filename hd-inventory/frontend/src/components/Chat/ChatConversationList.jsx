import { FileIcon, ImageIcon, UnreadIcon, PlusIcon, GroupIcon, DirectIcon, BellIcon, BellOffIcon } from './ChatIcons'
import { useChatSound } from './chatSound'

function formatCount(n) {
  if (!n || n <= 0) return null
  return n > 99 ? '99+' : String(n)
}

function previewFor(lastMsg) {
  if (!lastMsg) return 'Sin mensajes'
  if (lastMsg.message_type === 'text') return lastMsg.content || 'Sin mensajes'
  if (lastMsg.message_type === 'image') return { icon: true, label: 'Imagen' }
  return { icon: true, label: lastMsg.message_type === 'file' ? (lastMsg.file_name || 'Archivo') : lastMsg.message_type }
}

export default function ChatConversationList({ conversations, activeId, onSelect, onNewChat, isLoading, onlineMap = {}, currentUserId = null }) {
  const [soundMuted, toggleSound] = useChatSound()

  if (isLoading) {
    return (
      <div className="chat-list-skeleton" aria-label="Cargando conversaciones">
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
        <div className="chat-list-header-actions">
          <button
            type="button"
            className="icon-btn"
            onClick={toggleSound}
            title={soundMuted ? 'Activar sonido de mensajes' : 'Silenciar sonido de mensajes'}
            aria-label={soundMuted ? 'Activar sonido de mensajes' : 'Silenciar sonido de mensajes'}
            aria-pressed={!soundMuted}
          >
            {soundMuted ? <BellOffIcon size={18} /> : <BellIcon size={18} />}
          </button>
          <button type="button" className="icon-btn new-chat-btn" onClick={onNewChat} title="Nuevo chat" aria-label="Nuevo chat">
            <PlusIcon />
          </button>
        </div>
      </div>

      {conversations.length === 0 ? (
        <div className="empty-chat-state">
          <p>No tienes conversaciones aún.</p>
          <button type="button" onClick={onNewChat}>Iniciar un chat</button>
        </div>
      ) : (
        <ul className="conv-list" aria-label="Conversaciones">
          {conversations.map(conv => {
            const lastMsg = conv.last_message
            const onlineIds = onlineMap[conv.id] || onlineMap[String(conv.id)] || []
            const peerOnline = !conv.is_group && onlineIds.some(id => id !== currentUserId)
            const unread = conv.unread_count || 0
            const preview = previewFor(lastMsg)
            return (
              <li key={conv.id}>
                <button
                  type="button"
                  className={`conv-item ${activeId === conv.id ? 'active' : ''} ${unread > 0 ? 'unread' : ''}`}
                  onClick={() => onSelect(conv)}
                  aria-current={activeId === conv.id ? 'true' : undefined}
                  aria-label={`${conv.display_name}${unread > 0 ? `, ${unread} sin leer` : ''}`}
                >
                  <span className="conv-avatar" aria-hidden="true">
                    {conv.display_avatar ? (
                      <img src={conv.display_avatar} alt="" />
                    ) : (
                      <span className="conv-avatar-placeholder">{(conv.display_name?.[0] || '?').toUpperCase()}</span>
                    )}
                    {peerOnline && <span className="online-dot" title="En línea" />}
                  </span>

                  <span className="conv-info">
                    <span className="conv-header">
                      <span className="conv-name">
                        <span className="conv-kind" title={conv.is_group ? 'Grupo' : 'Directo'}>
                          {conv.is_group ? <GroupIcon size={13} /> : <DirectIcon size={13} />}
                        </span>
                        {conv.display_name}
                      </span>
                      {lastMsg && (
                        <time
                          className="conv-time"
                          dateTime={lastMsg.timestamp}
                        >
                          {new Date(lastMsg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </time>
                      )}
                    </span>
                    <span className="conv-footer">
                      <span className="conv-preview">
                        {typeof preview === 'string' ? preview : (
                          <>{preview.label === 'Imagen' ? <ImageIcon /> : <FileIcon size={14} />} {preview.label}</>
                        )}
                      </span>
                      {unread > 0 && (
                        <span className="unread-badge" role="status" aria-label={`${unread} mensajes sin leer`}>
                          <UnreadIcon size={11} />
                          <span className="unread-count">{formatCount(unread)}</span>
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
