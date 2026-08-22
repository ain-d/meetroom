import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import useSubmitCooldown from '../hooks/useSubmitCooldown'

// ✅ กันแจ้งปัญหาถี่ๆ (spam form)
const REPORT_COOLDOWN_MS = 8000

const ISSUE_TYPES = [
  'ไฟฟ้า / ปลั๊กไฟ',
  'เครื่องปรับอากาศ',
  'โปรเจกเตอร์ / จอภาพ',
  'อินเทอร์เน็ต / Wi-Fi',
  'เฟอร์นิเจอร์ / อุปกรณ์ชำรุด',
  'ความสะอาด',
  'อื่นๆ',
]

function ReportIssue() {
  const [rooms, setRooms] = useState([])
  const [phone, setPhone] = useState('')
  const [form, setForm] = useState({ room_id: '', issue_type: ISSUE_TYPES[0], description: '' })
  const [loading, setLoading] = useState(false)
  const [loadingRooms, setLoadingRooms] = useState(true)
  const [message, setMessage] = useState({ type: '', text: '' })
  const checkCooldown = useSubmitCooldown(REPORT_COOLDOWN_MS)

  // ✅ โหลดรายชื่อห้องทั้งหมด + เบอร์โทรด่วน (แบบเรียลไทม์ ถ้าแอดมินแก้เบอร์ หน้านี้จะอัปเดตทันที)
  useEffect(() => {
    let mounted = true

    const loadRooms = async () => {
      const { data } = await supabase.from('rooms').select('id, name').eq('is_active', true).order('name')
      if (mounted) {
        setRooms(data || [])
        setLoadingRooms(false)
      }
    }

    const loadContactInfo = async () => {
      const { data } = await supabase
        .from('contact_info')
        .select('emergency_phone')
        .eq('id', 'main')
        .maybeSingle()
      if (mounted) setPhone(data?.emergency_phone || '')
    }

    loadRooms()
    loadContactInfo()

    // ✅ subscribe realtime: ถ้าแอดมินแก้เบอร์โทรด่วนในหน้าตั้งค่า จะอัปเดตที่นี่ทันทีโดยไม่ต้อง refresh
    const channel = supabase
      .channel('report-issue-contact-info')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'contact_info', filter: 'id=eq.main' },
        (payload) => {
          if (mounted) setPhone(payload.new?.emergency_phone || '')
        }
      )
      .subscribe()

    return () => {
      mounted = false
      supabase.removeChannel(channel)
    }
  }, [])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setMessage({ type: '', text: '' })

    const cooldown = checkCooldown()
    if (!cooldown.ok) {
      setMessage({ type: 'error', text: cooldown.message })
      return
    }

    if (!form.room_id) {
      setMessage({ type: 'error', text: 'กรุณาเลือกห้องที่มีปัญหา' })
      return
    }
    if (!form.description.trim()) {
      setMessage({ type: 'error', text: 'กรุณาอธิบายรายละเอียดปัญหา' })
      return
    }

    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setMessage({ type: 'error', text: 'กรุณาเข้าสู่ระบบก่อนแจ้งปัญหา' })
      setLoading(false)
      return
    }

    // ✅ ดึงชื่อ-อีเมลผู้ใช้ เก็บแนบไปกับรายการแจ้งปัญหา เพื่อให้แอดมินดูง่ายโดยไม่ต้อง join ตาราง
    const { data: profile } = await supabase
      .from('users')
      .select('full_name, email')
      .eq('id', user.id)
      .maybeSingle()

    const { error } = await supabase.from('room_issues').insert({
      room_id: form.room_id,
      reported_by: user.id,
      reporter_name: profile?.full_name || null,
      reporter_email: profile?.email || user.email,
      issue_type: form.issue_type,
      description: form.description.trim(),
    })

    setLoading(false)

    if (error) {
      setMessage({ type: 'error', text: error.message })
      return
    }

    setMessage({ type: 'success', text: 'แจ้งปัญหาสำเร็จแล้ว ทีมงานจะดำเนินการโดยเร็วที่สุด' })
    setForm({ room_id: '', issue_type: ISSUE_TYPES[0], description: '' })
  }

  return (
    <main className="page-container">
      <section className="card ris-wrap">
        <div className="page-header">
          <h1>🛠️ แจ้งปัญหาห้อง</h1>
          <p>พบปัญหาระหว่างใช้งานห้องประชุม แจ้งเราได้ที่นี่</p>
        </div>

        {/* ===== แถบเบอร์โทรด่วน สำหรับเหตุฉุกเฉิน ===== */}
        <a href={phone ? `tel:${phone}` : undefined} className="ris-emergency">
          <span className="ris-emergency-icon">📞</span>
          <span className="ris-emergency-body">
            <strong>ปัญหาเร่งด่วน โทรทันที</strong>
            <span>ไฟดับ สายไฟชำรุด ประตูล็อกไม่ได้ หรืออันตรายอื่นๆ ระหว่างใช้งาน</span>
          </span>
          <span className="ris-emergency-number">{phone || 'ยังไม่ได้ตั้งค่าเบอร์โทร'}</span>
        </a>

        {/* ===== ฟอร์มแจ้งปัญหาที่ไม่เร่งด่วน ===== */}
        <h2 className="section-title">แจ้งปัญหาผ่านระบบ (สำหรับปัญหาที่ไม่เร่งด่วน)</h2>

        <form className="register-form ris-form" onSubmit={handleSubmit}>
          <label>
            <span>ห้องที่มีปัญหา</span>
            <select name="room_id" value={form.room_id} onChange={handleChange} disabled={loadingRooms} required>
              <option value="">{loadingRooms ? 'กำลังโหลดรายชื่อห้อง...' : '-- เลือกห้อง --'}</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>{room.name}</option>
              ))}
            </select>
          </label>

          <label>
            <span>ประเภทปัญหา</span>
            <select name="issue_type" value={form.issue_type} onChange={handleChange} required>
              {ISSUE_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </label>

          <label>
            <span>รายละเอียดปัญหา</span>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="อธิบายอาการหรือปัญหาที่พบ เช่น แอร์ไม่เย็น โปรเจกเตอร์ภาพเพี้ยน"
              rows={4}
              required
            />
          </label>

          <button type="submit" disabled={loading}>
            {loading ? 'กำลังส่งเรื่อง...' : 'ส่งแจ้งปัญหา'}
          </button>
        </form>

        {message.text && (
          <div className={`message ${message.type}`}>{message.text}</div>
        )}
      </section>

      <ReportIssueStyles />
    </main>
  )
}

// สไตล์ scope ด้วย prefix "ris-" — ใช้ CSS variables จริงของระบบ (:root) ทั้งหมด ไม่ประดิษฐ์สีเอง
function ReportIssueStyles() {
  return (
    <style>{`
      .ris-emergency {
        display: flex;
        align-items: center;
        gap: 14px;
        text-decoration: none;
        background: var(--danger-light);
        border: 1px solid rgba(229, 115, 115, 0.35);
        border-radius: var(--radius-sm);
        padding: 16px 18px;
        margin: 6px 0 28px;
        transition: transform 0.15s ease, border-color 0.15s ease;
      }
      .ris-emergency:hover {
        transform: translateY(-1px);
        border-color: var(--danger-color);
      }
      .ris-emergency-icon { font-size: 1.6rem; flex-shrink: 0; }
      .ris-emergency-body {
        display: flex;
        flex-direction: column;
        gap: 2px;
        flex: 1;
        min-width: 0;
      }
      .ris-emergency-body strong { color: var(--danger-color); font-size: 1rem; font-family: var(--font-display); }
      .ris-emergency-body span { color: var(--text-muted); font-size: 0.82rem; }
      .ris-emergency-number {
        font-family: var(--font-mono);
        font-size: 1.25rem;
        font-weight: 700;
        color: var(--text-main);
        white-space: nowrap;
        flex-shrink: 0;
      }

      .ris-form { max-width: 520px; }
      .ris-form textarea {
        width: 100%;
        padding: 13px 16px;
        border: 1.5px solid var(--border-color);
        border-radius: var(--radius-sm);
        font-size: 16px;
        color: var(--text-main);
        background: rgba(15, 34, 28, 0.6);
        outline: none;
        font-family: var(--font-body);
        resize: vertical;
        transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
      }
      .ris-form textarea:focus {
        border-color: var(--primary-color);
        background: rgba(15, 34, 28, 0.9);
        box-shadow: 0 0 0 4px var(--primary-light);
      }
      .ris-form button { align-self: flex-start; }
    `}</style>
  )
}

export default ReportIssue