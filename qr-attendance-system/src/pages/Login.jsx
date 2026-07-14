import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from "../lib/supabase"
import AppQRCode from '../components/AppQRCode'

function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  const handleSubmit = async (event) => {
    event.preventDefault()
    setMessage({ type: '', text: '' })

    if (!email || !password) {
      setMessage({ type: 'error', text: 'กรุณากรอกอีเมลและรหัสผ่าน' })
      return
    }

    setLoading(true)

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setMessage({ type: 'error', text: error.message })
      setLoading(false)
      return
    }

    if (!data.session) {
      setMessage({ type: 'error', text: 'เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบข้อมูลอีกครั้ง' })
      setLoading(false)
      return
    }

    navigate('/dashboard')
  }

  return (
    <main className="register-page">
      <section className="register-card">
        <div className="register-header">
          <p className="eyebrow">Meetroom</p>
          <h1>เข้าสู่ระบบ</h1>
          <p>ล็อกอินเพื่อเข้าใช้งานระบบจองห้องประชุม</p>
        </div>

        <form className="register-form" onSubmit={handleSubmit}>
          <label>
            <span>อีเมล</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              required
            />
          </label>

          <label>
            <span>รหัสผ่าน</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="รหัสผ่านของคุณ"
              required
            />
          </label>

          <button type="submit" disabled={loading}>
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>

        {message.text && (
          <div className={`message ${message.type}`}>{message.text}</div>
        )}

        <p className="helper-text">
          ยังไม่มีบัญชี? <Link to="/register">สมัครสมาชิก</Link>
        </p>

        {/* ✅ เปลี่ยนจาก Inline Style เป็น Class */}
        <div className="login-qr-wrapper">
          <AppQRCode />
        </div>
        
      </section>
    </main>
  )
}

export default Login