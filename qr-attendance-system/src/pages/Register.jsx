import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const initialForm = {
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
}

function Register() {
  const [form, setForm] = useState(initialForm)
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'ไฟล์ภาพต้องมีขนาดไม่เกิน 2MB' })
      return
    }

    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
    setMessage({ type: '', text: '' })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!form.fullName.trim()) {
      setMessage({ type: 'error', text: 'กรุณากรอกชื่อ-นามสกุล' })
      return
    }

    if (form.password !== form.confirmPassword) {
      setMessage({ type: 'error', text: 'รหัสผ่านยืนยันไม่ตรงกัน' })
      return
    }

    setLoading(true)
    setMessage({ type: '', text: '' })

    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { full_name: form.fullName },
      },
    })

    if (error) {
      setLoading(false)
      setMessage({ type: 'error', text: error.message })
      return
    }

    let avatarUrl = null

    if (avatarFile && data.user) {
      const fileName = `${data.user.id}/${Date.now()}-${avatarFile.name.replace(/\s+/g, '-')}`
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, avatarFile, { upsert: true, contentType: avatarFile.type })

      if (!uploadError) {
        const { data: publicData } = supabase.storage.from('avatars').getPublicUrl(fileName)
        avatarUrl = publicData.publicUrl

        await supabase.auth.updateUser({
          data: { full_name: form.fullName, avatar_url: avatarUrl },
        })
      }
    }

    setForm(initialForm)
    setAvatarFile(null)
    setAvatarPreview('')
    setLoading(false)

    if (data.user && !data.session) {
      setMessage({ type: 'success', text: 'สร้างบัญชีสำเร็จแล้ว กรุณายืนยันอีเมลก่อนเข้าใช้งาน' })
    } else if (data.session) {
      setMessage({ type: 'success', text: avatarUrl ? 'สร้างบัญชีและอัปโหลดรูปโปรไฟล์สำเร็จแล้ว' : 'สร้างบัญชีสำเร็จแล้ว' })
    }
  }

  return (
    <main className="register-page">
      <section className="register-card">
        <div className="register-header">
          <p className="eyebrow">Meetroom</p>
          <h1>สร้างบัญชีผู้ใช้</h1>
          <p>สมัครสมาชิกเพื่อใช้ระบบจองห้องประชุม</p>
        </div>

        <form className="register-form" onSubmit={handleSubmit}>
          <label className="avatar-picker">
            <input type="file" accept="image/*" onChange={handleAvatarChange} />
            <div className="avatar-preview">
              {avatarPreview ? (
                <img src={avatarPreview} alt="ตัวอย่างรูปโปรไฟล์" />
              ) : (
                <div className="avatar-placeholder">+</div>
              )}
            </div>
            <span>เลือกรูปโปรไฟล์ (ไม่บังคับ)</span>
          </label>

          <label>
            <span>ชื่อ-นามสกุล</span>
            <input name="fullName" value={form.fullName} onChange={handleChange} placeholder="กรอกชื่อของคุณ" required />
          </label>

          <label>
            <span>อีเมล</span>
            <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="name@example.com" required />
          </label>

          <label>
            <span>รหัสผ่าน</span>
            <input type="password" name="password" value={form.password} onChange={handleChange} placeholder="อย่างน้อย 6 ตัวอักษร" minLength="6" required />
          </label>

          <label>
            <span>ยืนยันรหัสผ่าน</span>
            <input type="password" name="confirmPassword" value={form.confirmPassword} onChange={handleChange} placeholder="พิมพ์รหัสผ่านอีกครั้ง" minLength="6" required />
          </label>

          <button type="submit" disabled={loading}>
            {loading ? 'กำลังสร้างบัญชี...' : 'สมัครสมาชิก'}
          </button>
        </form>

        {message.text && (
          <div className={`message ${message.type}`}>{message.text}</div>
        )}

        <p className="helper-text">
          มีบัญชีอยู่แล้ว? <Link to="/login">เข้าสู่ระบบ</Link>
        </p>
      </section>
    </main>
  )
}

export default Register 