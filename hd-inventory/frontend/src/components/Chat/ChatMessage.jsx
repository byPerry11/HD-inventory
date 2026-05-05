import { useMemo } from 'react'
import { FileIcon, PinIcon, DeleteIcon, SpinnerIcon } from './ChatIcons'

export default function ChatMessage({ message, isOwn, onPin, onAction }) {
  const { 
    sender_name, 
    sender_avatar, 
    content, 
    timestamp, 
    message_type, 
    attachment_url, 
    file_url, // Viene del WebSocket
    file_name, 
    file_size, 
    is_pinned,
    pending // Nuevo campo para Optimistic UI
  } = message

  const finalUrl = file_url || attachment_url

  const formattedTime = useMemo(() => {
    try {
      if (!timestamp) return ''
      return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch (e) { return '' }
  }, [timestamp])

  const renderContent = () => {
    if (message_type === 'image' || (message_type === 'file' && finalUrl?.match(/\.(jpg|jpeg|png|gif|webp)$/i))) {
      return (
        <div className="msg-media">
          <img src={finalUrl} alt="Adjunto" loading="lazy" onClick={() => window.open(finalUrl, '_blank')} />
          {content && <div className="msg-text">{content}</div>}
        </div>
      )
    }

    if (message_type === 'file') {
      return (
        <div className="msg-file-box" onClick={() => window.open(finalUrl, '_blank')}>
          <div className="msg-file-icon"><FileIcon /></div>
          <div className="msg-file-info">
            <div className="msg-file-name">{file_name || 'Archivo'}</div>
            <div className="msg-file-size">{file_size ? (file_size / 1024).toFixed(1) + ' KB' : 'Desconocido'}</div>
          </div>
        </div>
      )
    }

    // Link detection simple
    const urlRegex = /(https?:\/\/[^\s]+)/g
    const parts = (content || '').split(urlRegex)
    
    return (
      <div className="msg-text">
        {parts.map((part, i) => 
          urlRegex.test(part) 
            ? <a key={i} href={part} target="_blank" rel="noopener noreferrer">{part}</a> 
            : part
        )}
      </div>
    )
  }

  return (
    <div className={`message-bubble-wrapper ${isOwn ? 'own' : 'other'} ${is_pinned ? 'pinned' : ''} ${pending ? 'pending' : ''}`}>
      {!isOwn && (
        <div className="msg-avatar">
          {sender_avatar ? (
            <img src={sender_avatar} alt={sender_name} />
          ) : (
            <div className="msg-avatar-placeholder">{(sender_name?.[0] || '?').toUpperCase()}</div>
          )}
        </div>
      )}
      
      <div className="message-bubble">
        {!isOwn && <div className="msg-sender">{sender_name}</div>}
        
        {renderContent()}
        
        <div className="msg-footer">
          {is_pinned && <span className="msg-pinned-icon"><PinIcon size={12} filled /></span>}
          <span className="msg-time">
            {pending ? <SpinnerIcon size={12} /> : formattedTime}
          </span>
        </div>

        <div className="msg-actions">
           <button onClick={() => onPin(message)} title={is_pinned ? 'Desfijar' : 'Fijar'}>
             <PinIcon size={14} filled={is_pinned} />
           </button>
           <button onClick={() => onAction('delete', message)} title="Eliminar">
             <DeleteIcon size={14} />
           </button>
        </div>
      </div>
    </div>
  )
}
