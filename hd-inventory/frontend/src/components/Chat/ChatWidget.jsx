import { useState } from 'react'
import './ChatWidget.css'

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className={`chat-widget-container ${isOpen ? 'chat-widget--open' : ''}`}>
      {/* Botón Flotante */}
      <button 
        className="chat-fab" 
        onClick={() => setIsOpen(!isOpen)}
        title="Chat de equipo"
      >
        {isOpen ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
        )}
      </button>

      {/* Panel de Chat */}
      {isOpen && (
        <div className="chat-panel">
          <div className="chat-panel-header">
            <h3>Chats de Equipo</h3>
          </div>
          <div className="chat-panel-body">
            <div className="coming-soon-msg">
              <div className="coming-soon-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
              </div>
              <h4>Disponible pronto</h4>
              <p>Estamos trabajando para conectar a todo el equipo de Almacén.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
