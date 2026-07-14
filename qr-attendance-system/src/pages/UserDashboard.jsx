import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function UserDashboard({ profile }) {
  const navigate = useNavigate()
  const [stats, setStats] = useState({ myPending: 0, myApproved: 0 })

  useEffect(() => {
    const fetchMyStats = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // ✅ แก้ประสิทธิภาพ: ให้ฐานข้อมูลนับให้ เราไม่ต้องดึงข้อมูลมานับเอง
      const [pendingRes, approvedRes] = await Promise.all([
        supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'pending'),
        supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'approved'),
      ])

      setStats({
        myPending: pendingRes.count || 0,
        myApproved: approvedRes.count || 0,
      })
    }
    fetchMyStats()
  }, [])

  return (
    <main className="page-container">
      <section className="card">
        <div className="page-header">
          <h1>🏢 Meetroom</h1>
          <p>ระบบจองห้องประชุม</p>
        </div>

        <div className="dashboard-profile">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="avatar" className="dashboard-avatar" />
          ) : (
            <div className="dashboard-avatar-placeholder">👤</div>
          )}
          <div>
            <h2>{profile.full_name}</h2>
            <p>{profile.email}</p>
            <span className="role-badge">User</span>
          </div>
        </div>

        <div className="dashboard-stats">
          <div className="stat-card">
            <h3>⏳ รออนุมัติของฉัน</h3>
            {/* ✅ ใช้ Class แทน Inline Style */}
            <h1 className={stats.myPending > 0 ? 'text-warning' : 'text-primary'}>{stats.myPending}</h1>
          </div>
          <div className="stat-card">
            <h3>✅ ได้รับอนุมัติ</h3>
            <h1>{stats.myApproved}</h1>
          </div>
        </div>

        {/* ✅ ใช้ Class แทน Inline Style */}
        <h2 className="section-title">เมนูของฉัน</h2>
        <div className="dashboard-menu">
          <button onClick={() => navigate('/booking')}>📅 จองห้องประชุม</button>
          <button onClick={() => navigate('/booking-history')}>📄 ประวัติการจองของฉัน</button>
          <button onClick={() => navigate('/calendar')}>🗓 ดูปฏิทินห้องว่าง</button>
          <button onClick={() => navigate('/profile')}>👤 โปรไฟล์ของฉัน</button>
        </div>

        <button className="logout-button" onClick={async () => { await supabase.auth.signOut(); navigate('/login') }}>
          🚪 ออกจากระบบ
        </button>
      </section>
    </main>
  )
}

export default UserDashboard