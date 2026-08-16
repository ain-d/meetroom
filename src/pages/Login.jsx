import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from "../lib/supabase"

function Login() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const roomId = searchParams.get('room') // ✅ room id ที่มากับ QR (ถ้ามี)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [message, setMessage] = useState({ type: '', text: '' })

  // ✅ ปลายทางหลัง login สำเร็จ: ถ้ามี roomId ให้พาไปหน้าจองห้องนั้นเลย ไม่งั้นไปหน้า dashboard ปกติ
  const getRedirectPath = () => (roomId ? `/booking?room=${roomId}` : '/dashboard')

  // ✅ ถ้า login ค้างอยู่แล้ว (session ยังไม่หมดอายุ) สแกน QR แล้วข้ามหน้า login ไปเลย
  useEffect(() => {
    let mounted = true
    const checkExistingSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (mounted) {
        if (session) {
          navigate(getRedirectPath(), { replace: true })
        } else {
          setCheckingSession(false)
        }
      }
    }
    checkExistingSession()
    return () => { mounted = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

    navigate(getRedirectPath())
  }

  if (checkingSession) {
    return <p style={{ textAlign: 'center', padding: 30 }}>กำลังตรวจสอบสถานะ...</p>
  }

  return (
    <main className="register-page">
      <section className="register-card">
        <div className="register-header">
          <p className="eyebrow">Meetroom</p>
          <h1>เข้าสู่ระบบ</h1>
          <p>
            {roomId
              ? 'เข้าสู่ระบบเพื่อจองห้องประชุมนี้'
              : 'ล็อกอินเพื่อเข้าใช้งานระบบจองห้องประชุม'}
          </p>
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
          ยังไม่มีบัญชี? <Link to={roomId ? `/register?room=${roomId}` : '/register'}>สมัครสมาชิก</Link>
        </p>
      </section>
    </main>
  )
}

export default Login