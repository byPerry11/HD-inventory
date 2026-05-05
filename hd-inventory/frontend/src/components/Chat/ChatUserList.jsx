import { useState, useEffect } from 'react'
import api from '../../api/client'
import { BackIcon, GroupIcon } from './ChatIcons'

export default function ChatUserList({ onSelectUser, onBack, onCreateGroup }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await api.get('/auth/users/')
        const data = Array.isArray(response.data) ? response.data : (response.data.results || [])
        setUsers(data)
      } catch (err) {
        console.error('Error fetching users', err)
      } finally {
        setLoading(false)
      }
    }
    fetchUsers()
  }, [])

  const filteredUsers = users.filter(u => 
    (u.username + u.first_name + u.last_name).toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="chat-user-list">
      <div className="chat-view-header">
        <button className="back-btn" onClick={onBack}><BackIcon /></button>
        <h3>Nuevo Mensaje</h3>
      </div>
      
      <div className="chat-actions-bar">
        <button className="action-link-btn" onClick={onCreateGroup}>
          <span className="icon"><GroupIcon /></span> Crear Nuevo Grupo
        </button>
      </div>

      <div className="chat-search-box">
        <input 
          type="text" 
          placeholder="Buscar usuario..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
      </div>

      <div className="users-scroll-area">
        {loading ? (
          <div className="loading-spinner">Cargando...</div>
        ) : (
          filteredUsers.map(user => (
            <div key={user.id} className="user-item" onClick={() => onSelectUser(user)}>
              <div className="user-avatar">
                {user.avatar ? (
                  <img src={user.avatar} alt={user.username} />
                ) : (
                  <div className="user-avatar-placeholder">{(user.username?.[0] || '?').toUpperCase()}</div>
                )}
              </div>
              <div className="user-details">
                <div className="user-name">{user.first_name} {user.last_name}</div>
                <div className="user-username">@{user.username}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
