import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const initialForm = {
  emergency_phone: '',
  email: '',
  line_id: '',
  address: '',
  developer_name: '',
  developer_photo_url: '',
}

function ContactAdmin() {
  const [form, setForm] = useState(initialForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  useEffect(() => {
    const loadInfo = async () => {
      const { data } = await supabase
        .from('contact_info')
        .select('*')
        .eq('id', 'main')
        .maybeSingle()
      if (data) {
        setForm({
          emergency_phone: data.emergency_phone || '',
          email: data.email || '',
          line_id: data.line_id || '',
          address: data.address || '',
          developer_name: data.developer_name || '',
          developer_photo_url: data.developer_photo_url || '',
        })
      }
      setLoading(false)
    }
    loadInfo()
  }, [])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  // ✅ อัปโหลดรูปผู้พัฒนา ใช้ storage bucket 'avatars' เดิมของระบบ
  const handlePhotoChange = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'กรุณาเลือกไฟล์รูปภาพเท่านั้น' })
      return
    }

    setUploadingPhoto(true)
    setMessage({ type: '', text: '' })

    const fileName = `developer/${Date.now()}-${file.name.replace(/\s+/g, '-')}`
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, { upsert: true, contentType: file.type })

    if (uploadError) {
      setMessage({ type: 'error', text: 'อัปโหลดรูปไม่สำเร็จ: ' + uploadError.message })
      setUploadingPhoto(false)
      return
    }

    const { data: publicData } = supabase.storage.from('avatars').getPublicUrl(fileName)
    setForm((prev) => ({ ...prev, developer_photo_url: publicData.publicUrl }))
    setUploadingPhoto(false)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setMessage({ type: '', text: '' })

    // ✅ upsert ลง contact_info แถวเดียว (id='main') พอบันทึกปุ๊บ ทุกคนที่เปิดหน้า
    // Contact.jsx หรือ ReportIssue.jsx อยู่ จะเห็นข้อมูลใหม่ทันทีผ่าน Supabase Realtime
    const { error } = await supabase
      .from('contact_info')
      .update({ ...form, updated_at: new Date().toISOString() })
      .eq('id', 'main')

    setSaving(false)

    if (error) {
      setMessage({ type: 'error', text: error.message })
      return
    }

    setMessage({ type: 'success', text: 'บันทึกข้อมูลเรียบร้อยแล้ว ทุกหน้าที่เปิดอยู่จะอัปเดตอัตโนมัติ' })
  }

  if (loading) return <p style={{ padding: 30, textAlign: 'center' }}>กำลังโหลด...</p>

  return (
    <main className="page-container">
      <section className="card cta-wrap">
        <div className="page-header">
          <h1>☎️ ตั้งค่าข้อมูลติดต่อ</h1>
          <p>แก้ไขแล้วบันทึก ระบบจะอัปเดตให้ผู้ใช้ทุกคนเห็นทันทีแบบเรียลไทม์</p>
        </div>

        <form className="register-form cta-form" onSubmit={handleSubmit}>
          <div className="cta-grid">
            <label>
              <span>เบอร์โทรด่วน (สำหรับเหตุฉุกเฉิน)</span>
              <input name="emergency_phone" value={form.emergency_phone} onChange={handleChange} placeholder="เช่น 0949876517" />
            </label>

            <label>
              <span>อีเมล</span>
              <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="name@example.com" />
            </label>

            <label>
              <span>LINE ID</span>
              <input name="line_id" value={form.line_id} onChange={handleChange} placeholder="LINE ID หรือลิงก์เพิ่มเพื่อน" />
            </label>

            <label className="full-width">
              <span>ที่อยู่</span>
              <input name="address" value={form.address} onChange={handleChange} placeholder="ที่อยู่หน่วยงาน" />
            </label>
          </div>

          <h2 className="section-title">ข้อมูลผู้พัฒนา</h2>
          <div className="cta-dev-row">
            <label className="avatar-picker">
              <input type="file" accept="image/*" onChange={handlePhotoChange} disabled={uploadingPhoto} />
              <div className="avatar-preview">
                {form.developer_photo_url ? (
                  <img src={form.developer_photo_url} alt="รูปผู้พัฒนา" />
                ) : (
                  <div className="avatar-placeholder">+</div>
                )}
              </div>
              <span>{uploadingPhoto ? 'กำลังอัปโหลด...' : 'เปลี่ยนรูป'}</span>
            </label>

            <label className="cta-dev-name">
              <span>ชื่อผู้พัฒนา</span>
              <input name="developer_name" value={form.developer_name} onChange={handleChange} placeholder="ชื่อ-นามสกุล" />
            </label>
          </div>

          <button type="submit" disabled={saving || uploadingPhoto}>
            {saving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
          </button>
        </form>

        {message.text && (
          <div className={`message ${message.type}`}>{message.text}</div>
        )}
      </section>

      <ContactAdminStyles />
    </main>
  )
}

// สไตล์ scope ด้วย prefix "cta-" — ใช้ CSS variables จริงของระบบ + reuse .register-form, .avatar-picker เดิม
function ContactAdminStyles() {
  return (
    <style>{`
      .cta-form { max-width: 620px; }

      .cta-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 18px;
      }

      .cta-dev-row {
        display: flex;
        align-items: center;
        gap: 20px;
        margin-bottom: 8px;
      }
      .cta-dev-row .avatar-picker { flex-shrink: 0; }
      .cta-dev-row .avatar-preview,
      .cta-dev-row .avatar-placeholder {
        width: 64px;
        height: 64px;
        font-size: 24px;
      }
      .cta-dev-name { flex: 1; }

      @media (max-width: 480px) {
        .cta-grid { grid-template-columns: 1fr; }
      }
    `}</style>
  )
}

export default ContactAdmin