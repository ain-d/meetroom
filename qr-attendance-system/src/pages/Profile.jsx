import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function Profile() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState({ type: '', text: '' })
  
  // ✅ State สำหรับการแก้ไข
  const [isEditing, setIsEditing] = useState(false)
  const [newName, setNewName] = useState('')
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { navigate('/login'); return }

      const { data, error } = await supabase
        .from('users')
        .select('full_name, email, avatar_url, role, created_at')
        .eq('id', user.id)
        .maybeSingle()

      if (error) {
        setMessage({ type: 'error', text: error.message })
      } else {
        setProfile(data)
      }
      setLoading(false)
    }
    loadProfile()
  }, [navigate])

  // ✅ เริ่มโหมดแก้ไข
  const startEditing = () => {
    setNewName(profile.full_name)
    setAvatarPreview(profile.avatar_url || '')
    setAvatarFile(null)
    setMessage({ type: '', text: '' })
    setIsEditing(true)
  }

  // ✅ ยกเลิกการแก้ไข
  const cancelEditing = () => {
    setIsEditing(false)
    setAvatarFile(null)
    setMessage({ type: '', text: '' })
  }

  // ✅ จัดการเมื่อเลือกรูปใหม่
  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'ไฟล์ภาพต้องมีขนาดไม่เกิน 2MB' })
      return
    }

    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  // ✅ ฟังก์ชันบันทึกข้อมูลใหม่
  const handleSave = async () => {
    if (!newName.trim()) {
      setMessage({ type: 'error', text: 'กรุณากรอกชื่อ-นามสกุล' })
      return
    }

    setSaving(true)
    setMessage({ type: '', text: '' })

    try {
      const { data: { user } } = await supabase.auth.getUser()
      let newAvatarUrl = profile.avatar_url // ค่าเริ่มต้นคือรูปเดิม

      // 1. ถ้ามีการเลือกรูปใหม่ ให้อัปโหลดขึ้น Storage ก่อน
      if (avatarFile) {
        const fileName = `${user.id}/${Date.now()}-${avatarFile.name.replace(/\s+/g, '-')}`
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, avatarFile, { upsert: true, contentType: avatarFile.type })

        if (uploadError) throw new Error(`อัปโหลดรูปไม่สำเร็จ: ${uploadError.message}`)

        const { data: publicData } = supabase.storage.from('avatars').getPublicUrl(fileName)
        newAvatarUrl = publicData.publicUrl
      }

      // 2. อัปเดตข้อมูลในตาราง users
      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          full_name: newName.trim(), 
          avatar_url: newAvatarUrl 
        })
        .eq('id', user.id)

      if (updateError) throw new Error(`อัปเดตข้อมูลไม่สำเร็จ: ${updateError.message}`)

      // 3. อัปเดต State ภายในหน้าเว็บทันที (ไม่ต้องรีเฟรช)
      setProfile(prev => ({ ...prev, full_name: newName.trim(), avatar_url: newAvatarUrl }))
      setIsEditing(false)
      setMessage({ type: 'success', text: 'บันทึกข้อมูลเรียบร้อยแล้ว' })

    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p style={{ padding: 30, textAlign: 'center' }}>กำลังโหลด...</p>

  return (
    <main className="page-container">
      <section className="card">
        <div className="page-header">
          <h1>👤 โปรไฟล์ของฉัน</h1>
          <p>จัดการข้อมูลส่วนตัวของคุณ</p>
        </div>

        {message.text && <div className={`message ${message.type}`}>{message.text}</div>}

        {profile && (
          <div className="dashboard-profile">
            
            {/* ================= ส่วนแสดง/แก้ไขรูปโปรไฟล์ ================= */}
            {isEditing ? (
              <label className="avatar-picker">
                <input type="file" accept="image/*" onChange={handleAvatarChange} />
                <div className="avatar-preview">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="ตัวอย่างรูปใหม่" />
                  ) : (
                    <div className="avatar-placeholder">+</div>
                  )}
                </div>
                <span style={{fontSize: '14px'}}>คลิกเพื่อเปลี่ยนรูป</span>
              </label>
            ) : (
              profile.avatar_url ? (
                <img src={profile.avatar_url} alt="avatar" className="dashboard-avatar" />
              ) : (
                <div className="dashboard-avatar-placeholder">👤</div>
              )
            )}

            {/* ================= ส่วนแสดง/แก้ไขชื่อ ================= */}
            <div>
              {isEditing ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <label>
                    <span style={{fontSize:'14px', color:'#64748b'}}>ชื่อ-นามสกุล</span>
                    <input 
                      type="text" 
                      value={newName} 
                      onChange={(e) => setNewName(e.target.value)}
                      style={{ padding: '10px 14px', borderRadius: 10, border: '2px solid #e2e8f0', fontSize: 16, marginTop: 5 }}
                    />
                  </label>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button className="secondary-button" onClick={handleSave} disabled={saving} style={{padding: '8px 20px'}}>
                      {saving ? 'กำลังบันทึก...' : '💾 บันทึก'}
                    </button>
                    <button className="secondary-button" onClick={cancelEditing} style={{padding: '8px 20px'}}>
                      ยกเลิก
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <h2>{profile.full_name}</h2>
                  <p>📧 {profile.email}</p>
                  <p>🎯 บทบาท: <span className="role-badge">{profile.role}</span></p>
                  <p>📅 สมัครเมื่อ: {new Date(profile.created_at).toLocaleDateString('th-TH')}</p>
                  <button 
                    className="secondary-button" 
                    onClick={startEditing} 
                    style={{ marginTop: 15, padding: '8px 20px' }}
                  >
                    ✏️ แก้ไขโปรไฟล์
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {!profile && !message.text && (
          <p style={{textAlign:'center', color:'#64748b'}}>ไม่พบข้อมูลโปรไฟล์</p>
        )}

        <button className="secondary-button" style={{ marginTop: 20, width: '100%' }} onClick={() => navigate('/dashboard')}>
          ← กลับหน้าหลัก
        </button>
      </section>
    </main>
  )
}

export default Profile