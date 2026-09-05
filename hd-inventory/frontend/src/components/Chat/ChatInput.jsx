import { useState, useRef } from 'react'
import { EmojiIcon, AttachIcon, SpinnerIcon, SendIcon } from './ChatIcons'
import EmojiPicker from './EmojiPicker'

export default function ChatInput({ onSendMessage, onSendFile, onTyping }) {
  const [text, setText] = useState('')
  const [showEmoji, setShowEmoji] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [uploading, setUploading] = useState(false)
  const typingTimeoutRef = useRef(null)
  const fileInputRef = useRef(null)

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
        await onSendFile(file)
      } finally {
        setUploading(false)
        e.target.value = '' // Limpiar input
      }
    }
  }

  return (
    <div className={`chat-input-container ${uploading ? 'uploading' : ''}`}>
      <div className="chat-input-actions-left">
        <button className="input-action-btn" onClick={() => setShowEmoji(!showEmoji)} title="Emojis">
          <EmojiIcon />
        </button>
        <button className="input-action-btn" onClick={handleFileClick} title="Adjuntar" disabled={uploading}>
          {uploading ? <SpinnerIcon size={18} /> : <AttachIcon />}
        </button>
        <input 
          type="file" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          onChange={handleFileChange}
        />
      </div>

      <textarea 
        className="chat-textarea"
        placeholder="Escribe un mensaje..."
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        rows="1"
      />

      <button 
        className={`send-btn ${text.trim() ? 'active' : ''}`} 
        onClick={handleSend}
        disabled={!text.trim()}
      >
        <SendIcon />
      </button>

      {showEmoji && (
        <div className="emoji-picker-wrapper">
          <EmojiPicker 
            onSelect={(emoji) => setText(prev => prev + emoji)} 
            onClose={() => setShowEmoji(false)} 
          />
        </div>
      )}
    </div>
  )
}
