import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

function Contact() {
  const [info, setInfo] = useState(null)
  const [loading, setLoading] = useState(true)

  // ✅ โหลดข้อมูลติดต่อ + subscribe realtime เพื่อให้อัปเดตทันทีเมื่อแอดมินแก้ไข
  useEffect(() => {
    let mounted = true

    const loadInfo = async () => {
      const { data } = await supabase
        .from('contact_info')
        .select('*')
        .eq('id', 'main')
        .maybeSingle()
      if (mounted) {
        setInfo(data)
        setLoading(false)
      }
    }
    loadInfo()

    const channel = supabase
      .channel('contact-page-info')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'contact_info', filter: 'id=eq.main' },
        (payload) => {
          if (mounted) setInfo(payload.new)
        }
      )
      .subscribe()

    return () => {
      mounted = false
      supabase.removeChannel(channel)
    }
  }, [])

  if (loading) {
    return (
      <main className="page-container">
        <p style={{ padding: 30, textAlign: 'center' }}>กำลังโหลด...</p>
      </main>
    )
  }

  return (
    <main className="page-container">
      <section className="card cti-wrap">
        <div className="page-header">
          <h1>☎️ ติดต่อเรา</h1>
          <p>ช่องทางการติดต่อระบบจองห้องประชุม</p>
        </div>

        <div className="cti-grid">
          <a className="cti-item" href={info?.email ? `mailto:${info.email}` : undefined}>
            <span className="cti-icon">✉️</span>
            <div>
              <h3>อีเมล</h3>
              <p>{info?.email || '-'}</p>
            </div>
          </a>

          <div className="cti-item">
            <span className="cti-icon">💬</span>
            <div>
              <h3>LINE</h3>
              <p>{info?.line_id || '-'}</p>
            </div>
          </div>

          <div className="cti-item">
            <span className="cti-icon">📍</span>
            <div>
              <h3>ที่อยู่</h3>
              <p>{info?.address || '-'}</p>
            </div>
          </div>

          {info?.emergency_phone && (
            <a className="cti-item" href={`tel:${info.emergency_phone}`}>
              <span className="cti-icon">📞</span>
              <div>
                <h3>เบอร์โทรด่วน</h3>
                <p>{info.emergency_phone}</p>
              </div>
            </a>
          )}
        </div>

        {(info?.developer_name || info?.developer_photo_url) && (
          <>
            <h2 className="section-title">ผู้พัฒนาระบบ</h2>
            <div className="cti-developer">
              {info?.developer_photo_url ? (
                <img src={info.developer_photo_url} alt={info?.developer_name || 'ผู้พัฒนา'} className="cti-developer-photo" />
              ) : (
                <div className="cti-developer-placeholder">{info?.developer_name?.[0] || '?'}</div>
              )}
              <div>
                <div className="cti-developer-name">{info?.developer_name || '-'}</div>
                <div className="cti-developer-role">ผู้พัฒนาระบบจองห้องประชุม</div>
              </div>
            </div>
          </>
        )}
      </section>

      <ContactStyles />
    </main>
  )
}

// สไตล์ scope ด้วย prefix "cti-" — ใช้ CSS variables จริงของระบบ (:root) ทั้งหมด
function ContactStyles() {
  return (
    <style>{`
      .cti-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 14px;
      }
      .cti-item {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        background: var(--card-solid);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-sm);
        padding: 16px;
        text-decoration: none;
        color: inherit;
        box-shadow: var(--shadow-sm);
        transition: transform 0.2s ease, border-color 0.2s ease;
      }
      .cti-item:hover { transform: translateY(-2px); border-color: var(--border-strong); }
      .cti-icon { font-size: 1.3rem; line-height: 1.2; }
      .cti-item h3 {
        margin: 0 0 4px;
        font-size: 0.78rem;
        font-weight: 600;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }
      .cti-item p {
        margin: 0;
        color: var(--text-main);
        font-size: 0.95rem;
        word-break: break-word;
      }

      .cti-developer {
        display: flex;
        align-items: center;
        gap: 14px;
        background: var(--card-solid);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-sm);
        padding: 16px;
        max-width: 420px;
        box-shadow: var(--shadow-sm);
      }
      .cti-developer-photo {
        width: 56px; height: 56px;
        border-radius: 50%;
        object-fit: cover;
        border: 2px solid var(--border-strong);
      }
      .cti-developer-placeholder {
        width: 56px; height: 56px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--primary-light);
        color: var(--primary-color);
        font-weight: 700;
        font-size: 1.3rem;
      }
      .cti-developer-name { color: var(--primary-color); font-weight: 700; font-size: 1rem; font-family: var(--font-display); }
      .cti-developer-role { color: var(--text-muted); font-size: 0.8rem; margin-top: 2px; }
    `}</style>
  )
}

export default Contact