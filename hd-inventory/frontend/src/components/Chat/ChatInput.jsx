import { useState, useRef, useEffect } from 'react'
import { QuickIcon, AttachIcon, SpinnerIcon, SendIcon, CheckIcon, BoxIcon, TruckIcon, AlertIcon } from './ChatIcons'

// Inserciones rápidas operativas del almacén: solo iconos SVG, sin emojis.
const QUICK_INSERTS = [
  { id: 'recibido', label: 'Recibido', text: 'Recibido, lo reviso ahora.', Icon: CheckIcon },
  { id: 'stock', label: 'Revisar stock', text: 'Hay que revisar el stock de este material.', Icon: BoxIcon },
  { id: 'camino', label: 'En camino', text: 'Va en camino al almacén.', Icon: TruckIcon },
  { id: 'faltante', label: 'Faltante urgente', text: 'Urgente: faltante de material, priorizar.', Icon: AlertIcon },
]

export default function ChatInput({ onSendMessage, onSendFile, onTyping, uploadProgress = null }) {
  const [text, setText] = useState('')
  const [showQuick, setShowQuick] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [uploading, setUploading] = useState(false)
  const typingTimeoutRef = useRef(null)
  const fileInputRef = useRef(null)
  const quickRef = useRef(null)

  useEffect(() => {
    if (!showQuick) return
    const onKey = (e) => { if (e.key === 'Escape') setShowQuick(false) }
    const onClick = (e) => {
      if (quickRef.current && !quickRef.current.contains(e.target)) setShowQuick(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [showQuick])

  const handleSend = () => {
    if (text.trim()) {
      onSendMessage(text)
      setText('')
      stopTyping()
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleChange = (e) => {
    setText(e.target.value)

    if (!isTyping) {
      setIsTyping(true)
      onTyping(true)
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)

    typingTimeoutRef.current = setTimeout(() => {
      stopTyping()
    }, 2000)
  }

  const stopTyping = () => {
    setIsTyping(false)
    onTyping(false)
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
  }

  const handleFileClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e) => {
    const file = e.target.files[0]
    if (file) {
      setUploading(true)
      try {
        await onSendFile(file, () => {})
      } finally {
        setUploading(false)
        e.target.value = '' // Limpiar input
      }
    }
  }

  const insertQuick = (snippet) => {
    setText(prev => (prev ? `${prev} ${snippet}` : snippet))
    setShowQuick(false)
  }

  const canSend = text.trim().length > 0 && !uploading

  return (
    <div className={`chat-input-container ${uploading ? 'uploading' : ''}`}>
      <div className="chat-input-actions-left">
        <button
          type="button"
          className="icon-btn"
          onClick={() => setShowQuick(v => !v)}
          title="Inserciones rápidas"
          aria-label="Inserciones rápidas"
          aria-expanded={showQuick}
          aria-haspopup="menu"
        >
          <QuickIcon />
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={handleFileClick}
          title="Adjuntar archivo"
          aria-label="Adjuntar archivo"
          disabled={uploading}
        >
          {uploading ? (uploadProgress != null ? <span className="upload-pct">{uploadProgress}%</span> : <SpinnerIcon size={18} />) : <AttachIcon />}
        </button>
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleFileChange}
          aria-hidden="true"
          tabIndex={-1}
        />
      </div>

      <textarea
        className="chat-textarea"
        placeholder="Escribe un mensaje..."
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        rows="1"
        maxLength={2000}
        aria-label="Escribe un mensaje"
      />

      <button
        type="button"
        className={`send-btn ${canSend ? 'active' : ''}`}
        onClick={handleSend}
        disabled={!canSend}
        title="Enviar mensaje"
        aria-label="Enviar mensaje"
      >
        <SendIcon />
      </button>

      {showQuick && (
        <div className="quick-insert-wrapper" ref={quickRef}>
          <div className="quick-insert-panel" role="menu" aria-label="Inserciones rápidas">
            <p className="quick-insert-title">Respuestas de almacén</p>
            {QUICK_INSERTS.map(({ id, label, text: snippet, Icon }) => (
              <button key={id} type="button" className="quick-insert-item" role="menuitem" onClick={() => insertQuick(snippet)}>
                <span className="quick-insert-icon"><Icon size={18} /></span>
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
