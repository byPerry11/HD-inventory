import { useState, useEffect } from 'react'
import api from '../../api/client'
import { BackIcon, CheckIcon } from './ChatIcons'

export default function ChatGroupCreate({ onBack, onCreateSuccess }) {
  const [users, setUsers] = useState([])
  const [selectedUsers, setSelectedUsers] = useState([])
  const [groupName, setGroupName] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await api.get('/auth/users/')
        const data = Array.isArray(res.data) ? res.data : (res.data.results || [])
        setUsers(data)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchUsers()
  }, [])

  const toggleUser = (userId) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId) 
        : [...prev, userId]
    )
  }

  const handleCreate = async () => {
    if (!groupName || selectedUsers.length === 0) return
    
    setSubmitting(true)
    try {
      const res = await api.post('/chat/conversations/', {
        name: groupName,
        is_group: true,
        participants: selectedUsers
      })
      onCreateSuccess(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="chat-group-create">
      <div className="chat-view-header">
        <button className="back-btn" onClick={onBack}><BackIcon /></button>
        <h3>Crear Grupo</h3>
      </div>

      <div className="group-form-body">
        <div className="form-group">
          <label>Nombre del Grupo</label>
          <input 
            type="text" 
            placeholder="Ej: Equipo de Ventas" 
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Seleccionar Miembros ({selectedUsers.length})</label>
          <div className="members-select-list">
            {loading ? <p>Cargando usuarios...</p> : (
              users.map(u => (
                <div 
                  key={u.id} 
                  className={`member-item ${selectedUsers.includes(u.id) ? 'selected' : ''}`}
                  onClick={() => toggleUser(u.id)}
                >
                  <div className="member-avatar">
                    {u.avatar ? <img src={u.avatar} alt="" /> : <span>{u.username[0].toUpperCase()}</span>}
                  </div>
                  <span>{u.username}</span>
                  <div className="checkbox">{selectedUsers.includes(u.id) ? <CheckIcon /> : ''}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="group-form-footer">
        <button 
          className="create-confirm-btn" 
          disabled={!groupName || selectedUsers.length === 0 || submitting}
          onClick={handleCreate}
        >
          {submitting ? 'Creando...' : 'Crear Grupo'}
        </button>
      </div>
    </div>
  )
}
