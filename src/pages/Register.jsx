import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const initialForm = {
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
}

const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB
const MAX_DIMENSION = 800 // ครอปรูปให้ด้านที่ยาวสุดไม่เกิน 800px

function Register() {
  const [form, setForm] = useState(initialForm)
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState('')
  const [loading, setLoading] = useState(false)
  const [processingImage, setProcessingImage] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  // ✅ ตรวจสอบอีเมลอย่างง่าย: ต้องมี @ และลงท้ายด้วย .com
  const isValidEmail = (email) => {
    const regex = /^[^\s@]+@[^\s@]+\.com$/i
    return regex.test(email.trim())
  }

  // ✅ ครอปรูปเป็นสี่เหลี่ยมจัตุรัสตรงกลาง แล้วบีบอัดคุณภาพจนไม่เกิน 2MB
  const cropAndCompressImage = (file) => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const objectUrl = URL.createObjectURL(file)

      img.onload = () => {
        URL.revokeObjectURL(objectUrl)

        // ครอปเป็นสี่เหลี่ยมจัตุรัสตรงกลางภาพก่อน
        const side = Math.min(img.width, img.height)
        const sx = (img.width - side) / 2
        const sy = (img.height - side) / 2

        // ย่อขนาดถ้าใหญ่เกิน MAX_DIMENSION
        const outputSize = Math.min(side, MAX_DIMENSION)

        const canvas = document.createElement('canvas')
        canvas.width = outputSize
        canvas.height = outputSize
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, sx, sy, side, side, 0, 0, outputSize, outputSize)

        // ลดคุณภาพลงเรื่อยๆ จนกว่าไฟล์จะไม่เกิน MAX_FILE_SIZE
        const tryCompress = (quality) => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('ไม่สามารถประมวลผลรูปภาพได้'))
                return
              }
              if (blob.size <= MAX_FILE_SIZE || quality <= 0.3) {
                const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
                  type: 'image/jpeg',
                })
                resolve(compressedFile)
              } else {
                tryCompress(quality - 0.1)
              }
            },
            'image/jpeg',
            quality
          )
        }
        tryCompress(0.9)
      }

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl)
        reject(new Error('ไฟล์รูปภาพไม่ถูกต้อง'))
      }

      img.src = objectUrl
    })
  }

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'กรุณาเลือกไฟล์รูปภาพเท่านั้น' })
      return
    }

    setMessage({ type: '', text: '' })
    setProcessingImage(true)

    try {
      const processedFile = await cropAndCompressImage(file)
      setAvatarFile(processedFile)
      setAvatarPreview(URL.createObjectURL(processedFile))
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'ประมวลผลรูปภาพไม่สำเร็จ' })
    } finally {
      setProcessingImage(false)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!form.fullName.trim()) {
      setMessage({ type: 'error', text: 'กรุณากรอกชื่อ-นามสกุล' })
      return
    }

    // ✅ เช็ครูปแบบอีเมล ต้องมี @ และ .com
    if (!isValidEmail(form.email)) {
      setMessage({ type: 'error', text: 'กรุณากรอกอีเมลให้ถูกต้อง (ต้องมี @ และลงท้ายด้วย .com)' })
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
    let avatarWarning = ''

    if (avatarFile && data.user) {
      // ✅ ถ้ายังไม่มี session (ต้องยืนยันอีเมลก่อน) จะยังอัปโหลดรูปไม่ได้ เพราะ
      //    สิทธิ์ของ storage ต้องการให้ล็อกอินอยู่จริงๆ ก่อน — ไม่งั้นจะเงียบๆ ล้มเหลว
      //    โดยผู้ใช้ไม่รู้ตัวว่ารูปที่เลือกไว้หายไปไหน
      if (!data.session) {
        avatarWarning = ' (⚠️ รูปโปรไฟล์ที่เลือกไว้ยังไม่ถูกอัปโหลด กรุณายืนยันอีเมล เข้าสู่ระบบ แล้วอัปโหลดรูปอีกครั้งที่หน้าโปรไฟล์)'
      } else {
        const fileName = `${data.user.id}/${Date.now()}-${avatarFile.name.replace(/\s+/g, '-')}`
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, avatarFile, { upsert: true, contentType: avatarFile.type })

        if (uploadError) {
          avatarWarning = ` (⚠️ อัปโหลดรูปโปรไฟล์ไม่สำเร็จ: ${uploadError.message} — เข้าไปอัปโหลดใหม่ได้ที่หน้าโปรไฟล์)`
        } else {
          const { data: publicData } = supabase.storage.from('avatars').getPublicUrl(fileName)
          avatarUrl = publicData.publicUrl

          await supabase.auth.updateUser({
            data: { full_name: form.fullName, avatar_url: avatarUrl },
          })
        }
      }
    }

    setForm(initialForm)
    setAvatarFile(null)
    setAvatarPreview('')
    setLoading(false)

    if (data.user && !data.session) {
      setMessage({ type: 'success', text: `สร้างบัญชีสำเร็จแล้ว กรุณายืนยันอีเมลก่อนเข้าใช้งาน${avatarWarning}` })
    } else if (data.session) {
      setMessage({ type: 'success', text: (avatarUrl ? 'สร้างบัญชีและอัปโหลดรูปโปรไฟล์สำเร็จแล้ว' : 'สร้างบัญชีสำเร็จแล้ว') + avatarWarning })
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
            <input type="file" accept="image/*" onChange={handleAvatarChange} disabled={processingImage} />
            <div className="avatar-preview">
              {avatarPreview ? (
                <img src={avatarPreview} alt="ตัวอย่างรูปโปรไฟล์" />
              ) : (
                <div className="avatar-placeholder">+</div>
              )}
            </div>
            <span>{processingImage ? 'กำลังประมวลผลรูป...' : 'เลือกรูปโปรไฟล์ (ไม่บังคับ)'}</span>
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

          <button type="submit" disabled={loading || processingImage}>
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