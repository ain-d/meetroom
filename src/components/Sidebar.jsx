import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const DASHBOARD_NAV = { to: '/dashboard', icon: '🎯', label: 'แดชบอร์ด' }

// ✅ เมนูที่ทั้งผู้ใช้และแอดมินเห็นเหมือนกัน
const COMMON_NAV = [
  { to: '/contact', icon: '☎️', label: 'ติดต่อเรา' },
]

const USER_NAV = [
  { to: '/booking', icon: '🏢', label: 'จองห้องประชุม' },
  { to: '/booking-history', icon: '📖', label: 'การจองของฉัน' },
  { to: '/calendar', icon: '📅', label: 'ปฏิทิน' },
  { to: '/report-issue', icon: '🛠️', label: 'แจ้งปัญหาห้อง' },
]

const ADMIN_NAV = [
  { to: '/admin/bookings', icon: '✅', label: 'จัดการการจอง' },
  { to: '/admin/rooms', icon: '🏬', label: 'จัดการห้อง' },
  { to: '/admin/users', icon: '👥', label: 'จัดการผู้ใช้งาน' },
  { to: '/admin/issues', icon: '🛠️', label: 'จัดการปัญหาห้อง' },
  // ✅ "สถิติและรายงาน" ถูกรวมเข้าไปในเมนู "แดชบอร์ด" ด้านบนแล้ว ไม่มีเมนูนี้แยกอีกต่อไป
  { to: '/admin/qrcode', icon: '🔳', label: 'QR ระบบ' },
  { to: '/admin/contact', icon: '☎️', label: 'ตั้งค่าข้อมูลติดต่อ' },
]

function Sidebar({ open, onClose }) {
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [pendingIssueCount, setPendingIssueCount] = useState(0) // ✅ จำนวนปัญหาห้องที่รอดำเนินการ

  useEffect(() => {
    let mounted = true
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('users')
        .select('full_name, email, avatar_url, role')
        .eq('id', user.id)
        .maybeSingle()
      if (mounted) setProfile(data)

      if (data?.role === 'admin') {
        const { count } = await supabase
          .from('bookings')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending')
        if (mounted) setPendingCount(count || 0)

        // ✅ นับจำนวนปัญหาห้องที่ยังรอดำเนินการ เพื่อขึ้น badge เตือนแอดมิน
        const { count: issueCount } = await supabase
          .from('room_issues')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending')
        if (mounted) setPendingIssueCount(issueCount || 0)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const isAdmin = profile?.role === 'admin'

  return (
    <>
      {open && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar ${open ? 'is-open' : ''}`}>
        <div className="sidebar-brand">
          <div className="sidebar-logo">🏢</div>
          <div>
            <div className="sidebar-title">MeetSpace</div>
            <div className="sidebar-subtitle">MEETING ROOM</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section-label">เมนูหลัก</div>
          <NavLink
            to={DASHBOARD_NAV.to}
            onClick={onClose}
            className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="sidebar-nav-icon">{DASHBOARD_NAV.icon}</span>
            <span>{DASHBOARD_NAV.label}</span>
          </NavLink>

          {COMMON_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
            >
              <span className="sidebar-nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}

          {!isAdmin && USER_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
            >
              <span className="sidebar-nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}

          {isAdmin && (
            <>
              <div className="sidebar-section-label sidebar-section-admin">ผู้ดูแลระบบ</div>
              {ADMIN_NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onClose}
                  className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
                >
                  <span className="sidebar-nav-icon">{item.icon}</span>
                  <span>{item.label}</span>
                  {item.to === '/admin/bookings' && pendingCount > 0 && (
                    <span className="sidebar-badge">{pendingCount}</span>
                  )}
                  {item.to === '/admin/issues' && pendingIssueCount > 0 && (
                    <span className="sidebar-badge">{pendingIssueCount}</span>
                  )}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        <div className="sidebar-user" onClick={() => navigate('/profile')}>
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="avatar" className="sidebar-avatar" />
          ) : (
            <div className="sidebar-avatar-placeholder">{profile?.full_name?.[0] || '?'}</div>
          )}
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{profile?.full_name || '...'}</div>
            <div className="sidebar-user-role">{isAdmin ? 'ผู้ดูแลระบบ' : 'ผู้ใช้งาน'}</div>
          </div>
          <button
            className="sidebar-logout"
            onClick={(e) => { e.stopPropagation(); handleLogout() }}
            title="ออกจากระบบ"
          >
            🚪
          </button>
        </div>
      </aside>
    </>
  )
}

export default Sidebar