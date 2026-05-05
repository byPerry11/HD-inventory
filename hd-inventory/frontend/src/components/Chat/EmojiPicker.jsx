import { useState } from 'react'

const EMOJI_LIST = [
  { cat: 'Caras', icons: ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳'] },
  { cat: 'Gestos', icons: ['👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '🖐️', '✋', '🖖', '👋', '🤚', '✍️', '👏', '🙏'] },
  { cat: 'Símbolos', icons: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖'] },
  { cat: 'Trabajo', icons: ['🏗️', '🛠️', '⚒️', '⛏️', '👷', '📦', '🚚', '🚜', '🚛', '🏭', '🏢', '📋', '📝', '📂', '📁', '📊'] },
]

export default function EmojiPicker({ onSelect, onClose }) {
  const [activeCat, setActiveCat] = useState('Caras')

  return (
    <div className="emoji-picker-panel">
      <div className="emoji-picker-header">
        {EMOJI_LIST.map(group => (
          <button 
            key={group.cat} 
            className={`emoji-cat-btn ${activeCat === group.cat ? 'active' : ''}`}
            onClick={() => setActiveCat(group.cat)}
            title={group.cat}
          >
            {group.icons[0]}
          </button>
        ))}
      </div>
      <div className="emoji-picker-grid">
        {EMOJI_LIST.find(g => g.cat === activeCat).icons.map(icon => (
          <span 
            key={icon} 
            className="emoji-item" 
            onClick={() => { onSelect(icon); onClose(); }}
          >
            {icon}
          </span>
        ))}
      </div>
    </div>
  )
}
