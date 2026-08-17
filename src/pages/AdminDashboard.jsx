import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// ✅ รวมหน้า "รายงานสรุป" (เดิมอยู่ที่ /reports) เข้ามาไว้ในหน้า Dashboard นี้หน้าเดียว
//    ตามที่ตกลงกันไว้ — หน้า Reports.jsx ถูกย้ายออกจากระบบแล้ว (ดูรายละเอียดใน App.jsx/Sidebar.jsx)

function AdminDashboard({ profile }) {
  const navigate = useNavigate()
  const [stats, setStats] = useState({
    rooms: 0,
    users: 0,
    todayBookings: 0,
    totalBookings: 0,
    pending: 0,
    approved: 0,
    cancelled: 0,
    rejected: 0,
    completed: 0,
    no_show: 0,
    checkedIn: 0,
  })
  const [statsLoading, setStatsLoading] = useState(true)
  const [statsError, setStatsError] = useState('')

  useEffect(() => {
    const fetchStats = async () => {
      // ✅ แก้บั๊ก Timezone: ใช้เวลา Local แทน ISO String
      const today = new Date()
      const todayStr = today.getFullYear() + '-' +
                       String(today.getMonth() + 1).padStart(2, '0') + '-' +
                       String(today.getDate()).padStart(2, '0')

      const [
        roomsRes, usersRes, todayRes,
        pendingRes, approvedRes, cancelledRes, rejectedRes, completedRes, noShowRes, checkedInRes,
      ] = await Promise.all([
        supabase.from('rooms').select('*', { count: 'exact', head: true }),
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('bookings').select('*', { count: 'exact', head: true }).gte('start_time', `${todayStr}T00:00:00`).lte('start_time', `${todayStr}T23:59:59`),
        supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
        supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'cancelled'),
        supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'rejected'),
        supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
        supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'no_show'),
        supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'checked_in'),
      ])

      // ✅ ถ้าตัวไหนโหลดไม่สำเร็จ อย่าปล่อยให้ตัวเลขกลายเป็น 0 แบบเงียบๆ
      const responses = [roomsRes, usersRes, todayRes, pendingRes, approvedRes, cancelledRes, rejectedRes, completedRes, noShowRes, checkedInRes]
      const failed = responses.filter((res) => res.error)
      if (failed.length > 0) {
        console.error('โหลดสถิติ Dashboard ไม่สำเร็จบางส่วน:', failed.map((f) => f.error?.message))
        setStatsError('โหลดสถิติบางส่วนไม่สำเร็จ ตัวเลขที่เห็นด้านล่างอาจไม่ครบถ้วน ลองรีเฟรชหน้าอีกครั้ง')
      } else {
        setStatsError('')
      }

      const pending = pendingRes.count || 0
      const approved = approvedRes.count || 0
      const cancelled = cancelledRes.count || 0
      const rejected = rejectedRes.count || 0
      const completed = completedRes.count || 0
      const no_show = noShowRes.count || 0
      const checkedIn = checkedInRes.count || 0

      setStats({
        rooms: roomsRes.count || 0,
        users: usersRes.count || 0,
        todayBookings: todayRes.count || 0,
        totalBookings: pending + approved + cancelled + rejected + completed + no_show + checkedIn,
        pending,
        approved,
        cancelled,
        rejected,
        completed,
        no_show,
        checkedIn,
      })
      setStatsLoading(false)
    }
    fetchStats()
  }, [])

  // สถานะทั้งหมดของการจอง เรียงตามลำดับที่ต้องการให้เห็นในแถบสัดส่วน
  const statusBreakdown = [
    { key: 'pending', label: 'รออนุมัติ', count: stats.pending, colorVar: '--rpt-s-pending' },
    { key: 'approved', label: 'อนุมัติแล้ว', count: stats.approved, colorVar: '--rpt-s-approved' },
    { key: 'checkedIn', label: 'กำลังใช้งาน', count: stats.checkedIn, colorVar: '--rpt-s-checkedin' },
    { key: 'completed', label: 'ใช้งานสำเร็จ', count: stats.completed, colorVar: '--rpt-s-completed' },
    { key: 'cancelled', label: 'ยกเลิกแล้ว', count: stats.cancelled, colorVar: '--rpt-s-cancelled' },
    { key: 'rejected', label: 'ไม่อนุมัติ', count: stats.rejected, colorVar: '--rpt-s-rejected' },
    { key: 'no_show', label: 'ไม่มาใช้งาน', count: stats.no_show, colorVar: '--rpt-s-noshow' },
  ]

  const pct = (n) => (stats.totalBookings > 0 ? (n / stats.totalBookings) * 100 : 0)

  return (
    <main className="page-container dashboard-shell">
      <section className="card dashboard-card rpt-wrap">
        <div className="page-header dashboard-header">
          <div>
            <h1>🛠️ Admin Dashboard</h1>
            <p>ภาพรวมและสถิติทั้งหมดของระบบจองห้องประชุม</p>
          </div>
          <span className="dashboard-pill">Control Center</span>
        </div>

        {statsError && <div className="message error">{statsError}</div>}

        <div className="dashboard-profile dashboard-profile-card">
          {profile?.avatar_url ? <img src={profile.avatar_url} alt="avatar" className="dashboard-avatar" /> : <div className="dashboard-avatar-placeholder">🛡️</div>}
          <div>
            <h2>{profile.full_name}</h2>
            <p>{profile.email}</p>
            <span className="role-badge">Administrator</span>
          </div>
        </div>

        {statsLoading ? (
          <div className="rpt-loading">
            <div className="rpt-loading-ring" />
            <p>กำลังโหลดสถิติ...</p>
          </div>
        ) : (
          <>
            {/* ===== Hero: ยอดรวมการจองทั้งหมด ===== */}
            <div className="rpt-hero">
              <svg className="rpt-laurel rpt-laurel-left" viewBox="0 0 60 140" aria-hidden="true">
                <path d="M50 5 C20 20, 15 60, 25 130" fill="none" />
                {[15, 35, 55, 75, 95, 112].map((y, i) => (
                  <ellipse key={i} cx={38 - i * 1.5} cy={y} rx="9" ry="4"
                    transform={`rotate(${-35 - i * 4} ${38 - i * 1.5} ${y})`} />
                ))}
              </svg>

              <div className="rpt-hero-center">
                <span className="rpt-hero-eyebrow">การจองทั้งหมดในระบบ</span>
                <span className="rpt-hero-number">{stats.totalBookings.toLocaleString('th-TH')}</span>
                <span className="rpt-hero-unit">รายการ</span>
              </div>

              <svg className="rpt-laurel rpt-laurel-right" viewBox="0 0 60 140" aria-hidden="true">
                <path d="M10 5 C40 20, 45 60, 35 130" fill="none" />
                {[15, 35, 55, 75, 95, 112].map((y, i) => (
                  <ellipse key={i} cx={22 + i * 1.5} cy={y} rx="9" ry="4"
                    transform={`rotate(${35 + i * 4} ${22 + i * 1.5} ${y})`} />
                ))}
              </svg>
            </div>

            {/* ===== แถบสัดส่วนสถานะ ===== */}
            <div className="rpt-breakdown">
              <h2 className="rpt-section-title">สัดส่วนสถานะการจอง</h2>
              <div className="rpt-bar" role="img" aria-label="สัดส่วนสถานะการจองทั้งหมด">
                {statusBreakdown.map((s) =>
                  s.count > 0 ? (
                    <div
                      key={s.key}
                      className="rpt-bar-segment"
                      style={{ flexGrow: s.count, background: `var(${s.colorVar})` }}
                      title={`${s.label}: ${s.count} รายการ (${pct(s.count).toFixed(1)}%)`}
                    />
                  ) : null
                )}
                {stats.totalBookings === 0 && <div className="rpt-bar-empty" />}
              </div>
              <div className="rpt-legend">
                {statusBreakdown.map((s) => (
                  <div className="rpt-legend-item" key={s.key}>
                    <span className="rpt-dot" style={{ background: `var(${s.colorVar})` }} />
                    <span className="rpt-legend-label">{s.label}</span>
                    <span className="rpt-legend-value">
                      {s.count} <em>({pct(s.count).toFixed(1)}%)</em>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* ===== กลุ่มที่ต้องดำเนินการวันนี้ ===== */}
            <h2 className="rpt-section-title">ต้องดำเนินการวันนี้</h2>
            <div className="rpt-group rpt-group-featured">
              <div className="rpt-stat-card rpt-featured" style={{ '--accent': 'var(--rpt-s-pending)' }}>
                <span className="rpt-stat-icon">⏳</span>
                <div className="rpt-stat-body">
                  <h3>รออนุมัติ</h3>
                  <p className="rpt-stat-number">{stats.pending}</p>
                  <span className="rpt-stat-caption">รายการที่รอการตัดสินใจของคุณ</span>
                </div>
              </div>
              <div className="rpt-stat-card rpt-featured" style={{ '--accent': 'var(--rpt-gold)' }}>
                <span className="rpt-stat-icon">📅</span>
                <div className="rpt-stat-body">
                  <h3>จองวันนี้</h3>
                  <p className="rpt-stat-number">{stats.todayBookings}</p>
                  <span className="rpt-stat-caption">การจองที่มีกำหนดในวันนี้</span>
                </div>
              </div>
            </div>

            {/* ===== กลุ่มสถานะการจอง ===== */}
            <h2 className="rpt-section-title">สถานะการจองทั้งหมด</h2>
            <div className="rpt-group">
              <div className="rpt-stat-card" style={{ '--accent': 'var(--rpt-s-approved)' }}>
                <span className="rpt-stat-icon">✅</span>
                <div className="rpt-stat-body">
                  <h3>อนุมัติแล้ว</h3>
                  <p className="rpt-stat-number">{stats.approved}</p>
                </div>
              </div>
              <div className="rpt-stat-card" style={{ '--accent': 'var(--rpt-s-checkedin)' }}>
                <span className="rpt-stat-icon">👀</span>
                <div className="rpt-stat-body">
                  <h3>กำลังใช้งาน</h3>
                  <p className="rpt-stat-number">{stats.checkedIn}</p>
                </div>
              </div>
              <div className="rpt-stat-card" style={{ '--accent': 'var(--rpt-s-completed)' }}>
                <span className="rpt-stat-icon">✔️</span>
                <div className="rpt-stat-body">
                  <h3>ใช้งานสำเร็จ</h3>
                  <p className="rpt-stat-number">{stats.completed}</p>
                </div>
              </div>
              <div className="rpt-stat-card" style={{ '--accent': 'var(--rpt-s-cancelled)' }}>
                <span className="rpt-stat-icon">🚫</span>
                <div className="rpt-stat-body">
                  <h3>ยกเลิกแล้ว</h3>
                  <p className="rpt-stat-number">{stats.cancelled}</p>
                </div>
              </div>
              <div className="rpt-stat-card" style={{ '--accent': 'var(--rpt-s-rejected)' }}>
                <span className="rpt-stat-icon">❌</span>
                <div className="rpt-stat-body">
                  <h3>ไม่อนุมัติ</h3>
                  <p className="rpt-stat-number">{stats.rejected}</p>
                </div>
              </div>
              <div className="rpt-stat-card" style={{ '--accent': 'var(--rpt-s-noshow)' }}>
                <span className="rpt-stat-icon">🌫️</span>
                <div className="rpt-stat-body">
                  <h3>ไม่มาใช้งาน</h3>
                  <p className="rpt-stat-number">{stats.no_show}</p>
                </div>
              </div>
            </div>

            {/* ===== กลุ่มทรัพยากรระบบ ===== */}
            <h2 className="rpt-section-title">ทรัพยากรระบบ</h2>
            <div className="rpt-group rpt-group-resource">
              <div className="rpt-stat-card" style={{ '--accent': 'var(--rpt-gold)' }}>
                <span className="rpt-stat-icon">🏢</span>
                <div className="rpt-stat-body">
                  <h3>ห้องประชุม</h3>
                  <p className="rpt-stat-number">{stats.rooms}</p>
                </div>
              </div>
              <div className="rpt-stat-card" style={{ '--accent': 'var(--rpt-gold)' }}>
                <span className="rpt-stat-icon">👥</span>
                <div className="rpt-stat-body">
                  <h3>ผู้ใช้งาน</h3>
                  <p className="rpt-stat-number">{stats.users}</p>
                </div>
              </div>
            </div>
          </>
        )}
      </section>

      <AdminDashboardStyles />
    </main>
  )
}

// สไตล์ของส่วนรายงาน (เดิมมาจากหน้า Reports.jsx) ถูก scope ด้วย prefix "rpt-"
// เพื่อไม่ปะทะกับธีม Dark Forest & Gold ของหน้าอื่น
function AdminDashboardStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500..700&display=swap');

      .rpt-wrap {
        --rpt-bg-panel: #142219;
        --rpt-bg-panel-2: #1b2d21;
        --rpt-border: rgba(212, 175, 55, 0.18);
        --rpt-gold: #d4af37;
        --rpt-gold-light: #f0d888;
        --rpt-ivory: #f3ecd9;
        --rpt-muted: #9fb3a4;

        --rpt-s-pending: #e0b23c;
        --rpt-s-approved: #5fae7a;
        --rpt-s-checkedin: #58a9a3;
        --rpt-s-completed: #8fbf6f;
        --rpt-s-cancelled: #b5776a;
        --rpt-s-rejected: #b0463f;
        --rpt-s-noshow: #7c8b82;
      }

      .rpt-loading {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 14px;
        padding: 50px 30px;
        color: #9fb3a4;
      }
      .rpt-loading-ring {
        width: 34px; height: 34px;
        border-radius: 50%;
        border: 3px solid rgba(212,175,55,0.2);
        border-top-color: #d4af37;
        animation: rpt-spin 0.9s linear infinite;
      }
      @keyframes rpt-spin { to { transform: rotate(360deg); } }

      /* ===== Hero ===== */
      .rpt-hero {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 18px;
        padding: 28px 10px 34px;
      }
      .rpt-hero-center {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
      }
      .rpt-hero-eyebrow {
        font-size: 0.78rem;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--rpt-muted);
        margin-bottom: 6px;
      }
      .rpt-hero-number {
        font-family: 'Fraunces', Georgia, serif;
        font-weight: 600;
        font-size: clamp(3.2rem, 9vw, 5.4rem);
        line-height: 1;
        color: var(--rpt-gold-light);
        text-shadow: 0 0 28px rgba(212,175,55,0.25);
      }
      .rpt-hero-unit {
        margin-top: 6px;
        font-size: 0.9rem;
        color: var(--rpt-muted);
      }
      .rpt-laurel {
        width: 42px;
        height: 100px;
        flex-shrink: 0;
        stroke: var(--rpt-gold);
        fill: var(--rpt-gold);
        opacity: 0.55;
      }
      .rpt-laurel path {
        stroke: var(--rpt-gold);
        stroke-width: 1.4;
      }
      .rpt-laurel ellipse { opacity: 0.85; }

      /* ===== Breakdown bar ===== */
      .rpt-section-title {
        font-size: 0.95rem;
        letter-spacing: 0.04em;
        color: var(--rpt-ivory);
        margin: 26px 0 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--rpt-border);
      }
      .rpt-breakdown { margin-top: 4px; }
      .rpt-bar {
        display: flex;
        width: 100%;
        height: 16px;
        border-radius: 999px;
        overflow: hidden;
        background: var(--rpt-bg-panel);
        border: 1px solid var(--rpt-border);
      }
      .rpt-bar-segment {
        min-width: 2px;
        transition: flex-grow 0.4s ease;
      }
      .rpt-bar-segment + .rpt-bar-segment { border-left: 2px solid rgba(11,20,16,0.5); }
      .rpt-bar-empty {
        flex: 1;
        background: repeating-linear-gradient(
          45deg, rgba(159,179,164,0.12), rgba(159,179,164,0.12) 6px,
          transparent 6px, transparent 12px
        );
      }
      .rpt-legend {
        display: flex;
        flex-wrap: wrap;
        gap: 10px 20px;
        margin-top: 14px;
      }
      .rpt-legend-item {
        display: flex;
        align-items: center;
        gap: 7px;
        font-size: 0.85rem;
        color: var(--rpt-ivory);
      }
      .rpt-dot {
        width: 9px; height: 9px;
        border-radius: 50%;
        flex-shrink: 0;
      }
      .rpt-legend-label { color: var(--rpt-muted); }
      .rpt-legend-value em {
        font-style: normal;
        color: var(--rpt-muted);
        font-size: 0.8rem;
      }

      /* ===== Stat groups ===== */
      .rpt-group {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 14px;
      }
      /* ✅ ปรับจาก 1fr เดี่ยว เป็น auto-fit เพื่อรองรับการ์ด "ต้องดำเนินการวันนี้" 2 ใบ (รออนุมัติ + จองวันนี้) เรียงข้างกัน */
      .rpt-group-featured { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
      .rpt-group-resource { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }

      .rpt-stat-card {
        position: relative;
        display: flex;
        align-items: center;
        gap: 12px;
        background: linear-gradient(160deg, var(--rpt-bg-panel-2), var(--rpt-bg-panel));
        border: 1px solid var(--rpt-border);
        border-radius: 12px;
        padding: 16px 16px;
        overflow: hidden;
      }
      .rpt-stat-card::before {
        content: '';
        position: absolute;
        left: 0; top: 0; bottom: 0;
        width: 3px;
        background: var(--accent, var(--rpt-gold));
      }
      .rpt-stat-icon { font-size: 1.4rem; line-height: 1; }
      .rpt-stat-body h3 {
        margin: 0 0 2px;
        font-size: 0.78rem;
        font-weight: 500;
        color: var(--rpt-muted);
      }
      .rpt-stat-number {
        margin: 0;
        font-family: 'Fraunces', Georgia, serif;
        font-size: 1.7rem;
        color: var(--rpt-ivory);
      }
      .rpt-stat-caption {
        display: block;
        margin-top: 2px;
        font-size: 0.75rem;
        color: var(--rpt-muted);
      }

      .rpt-featured {
        padding: 22px 22px;
        align-items: center;
      }
      .rpt-featured .rpt-stat-icon { font-size: 2rem; }
      .rpt-featured .rpt-stat-number { font-size: 2.4rem; color: var(--rpt-gold-light); }

      @media (max-width: 480px) {
        .rpt-hero { gap: 8px; }
        .rpt-laurel { width: 26px; height: 70px; }
        .rpt-group { grid-template-columns: repeat(2, 1fr); }
      }
    `}</style>
  )
}

export default AdminDashboard
