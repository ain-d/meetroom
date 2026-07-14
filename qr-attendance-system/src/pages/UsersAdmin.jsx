import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function UsersAdmin() {
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState({ type: '', text: '' })
  
  // ✅ 1. เพิ่ม State มาเก็บ ID ของคนล็อกอินอยู่
  const [currentUserId, setCurrentUserId] = useState(null)

  useEffect(() => {
    const loadUsers = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { navigate('/login'); return }

      // ✅ 2. เก็บ ID ไว้ใน State ตอนที่โหลดหน้า (ตอนนี้มัน await ได้แล้ว)
      setCurrentUserId(user.id)

      const { data, error } = await supabase.from('users').select('id, full_name, email, role, created_at').order('created_at', { ascending: false })
      if (error) setMessage({ type: 'error', text: `โหลดข้อมูลไม่สำเร็จ: ${error.message}` })
      else setUsers(data || [])
      setLoading(false)
    }
    loadUsers()
  }, [navigate])

  const handleRoleChange = async (userId, newRole) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/login'); return }

    if (user.id === userId) {
      setMessage({ type: 'error', text: '⚠️ คุณไม่สามารถเปลี่ยนบทบาทของตัวเองได้' })
      return
    }

    const targetUser = users.find(u => u.id === userId)
    const roleLabel = newRole === 'admin' ? 'Admin' : 'Staff'
    if (!window.confirm(`ยืนยันการเปลี่ยนบทบาทของ "${targetUser?.full_name || 'ผู้ใช้นี้'}" เป็น "${roleLabel}"?`)) {
      return
    }

    const { error } = await supabase.from('users').update({ role: newRole }).eq('id', userId)
    if (error) {
      setMessage({ type: 'error', text: `อัปเดตบทบาทไม่สำเร็จ: ${error.message}` })
    } else { 
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))); 
      setMessage({ type: 'success', text: `เปลี่ยนบทบาทของ ${targetUser?.full_name || 'ผู้ใช้'} เป็น ${roleLabel} สำเร็จ` })
    }
  }

  // ✅ ฟังก์ชันช่วยเช็คว่าเป็นตัวเองไหม (ใช้ State ที่เก็บไว้)
  const isMyself = (userId) => userId === currentUserId

  return (
    <main className="page-container">
      <section className="card">
        <div className="page-header">
          <h1>👥 จัดการผู้ใช้งาน</h1>
          <p>เปลี่ยนบทบาทหรือจัดการสิทธิ์ผู้ใช้งาน</p>
        </div>

        {message.text && <div className={`message ${message.type}`}>{message.text}</div>}

        {loading ? <p className="text-center">กำลังโหลด...</p> : (
          <div className="room-table-wrapper">
            <table className="room-table">
              <thead><tr><th>ชื่อ</th><th>อีเมล</th><th>บทบาท</th><th>สมัครเมื่อ</th></tr></thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td><strong>{user.full_name || '-'}</strong></td>
                    <td>{user.email}</td>
                    <td>
                      {/* ✅ 3. เปลี่ยนจากการเรียก getSession() ตรงๆ มาใช้ State แทน และใช้ Class แทน Inline style */}
                      <select 
                        value={user.role} 
                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        disabled={isMyself(user.id)}
                        className={isMyself(user.id) ? 'select-disabled' : ''}
                      >
                        <option value="staff">Staff</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td>{new Date(user.created_at).toLocaleDateString('th-TH')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ✅ ใช้ Class แทน Inline style */}
        <button className="secondary-button full-width" style={{ marginTop: 20 }} onClick={() => navigate('/dashboard')}>← กลับหน้าหลัก</button>
      </section>
    </main>
  )
}

export default UsersAdmin