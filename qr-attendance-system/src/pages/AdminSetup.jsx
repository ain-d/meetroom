import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function AdminSetup() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [message, setMessage] = useState({ type: '', text: '' })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let mounted = true
    const checkAdmin = async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session?.user) { navigate('/login'); return }

      // ✅ แก้ Bug: เปลี่ยนจาก .single() เป็น .maybeSingle() เพื่อไม่ให้ขึ้น Error ถ้าไม่มีโปรไฟล์
      const { data } = await supabase.from('users').select('role').eq('id', sessionData.session.user.id).maybeSingle()
      
      if (!mounted) return
      if (data?.role === 'admin') navigate('/admin/bookings')
    }
    checkAdmin()
    return () => { mounted = false }
  }, [navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage({ type: '', text: '' })
    if (!code.trim()) { setMessage({ type: 'error', text: 'กรุณากรอกโค้ด' }); return }

    setLoading(true)
    const { data: sessionData } = await supabase.auth.getSession()
    const user = sessionData.session?.user
    const accessToken = sessionData.session?.access_token
    if (!user || !accessToken) { navigate('/login'); return }

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000'
      const response = await fetch(`${apiUrl}/admin/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ admin_code: code.trim() }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error === 'Invalid admin code' ? 'รหัสไม่ถูกต้อง' : result.error || 'เกิดข้อผิดพลาด')
      
      setMessage({ type: 'success', text: 'ได้รับสิทธิ์ admin แล้ว' })
      setTimeout(() => navigate('/admin/bookings'), 1200)
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="register-page">
      <section className="register-card">
        <div className="register-header">
          <p className="eyebrow">Admin Setup</p>
          <h1>ขอสิทธิ์ผู้ดูแลระบบ</h1>
          <p>กรอกโค้ดที่ได้รับเพื่อเปลี่ยนบทบาทเป็น admin</p>
        </div>
        <form className="register-form" onSubmit={handleSubmit}>
          <label>
            <span>รหัสขอสิทธิ์ admin</span>
            <input type="password" value={code} onChange={(e) => setCode(e.target.value)} placeholder="ใส่รหัสที่ได้รับ" />
          </label>
          <button type="submit" disabled={loading}>{loading ? 'กำลังส่ง...' : 'ขอสิทธิ์ admin'}</button>
        </form>
        {message.text && <div className={`message ${message.type}`}>{message.text}</div>}
      </section>
    </main>
  )
}

export default AdminSetup