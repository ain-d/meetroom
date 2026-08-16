import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function AdminDashboard({ profile }) {
  const navigate = useNavigate()
  const [stats, setStats] = useState({ rooms: 0, users: 0, todayBookings: 0, pending: 0 })

  useEffect(() => {
    const fetchStats = async () => {
      // ✅ แก้บั๊ก Timezone: ใช้เวลา Local แทน ISO String
      const today = new Date()
      const todayStr = today.getFullYear() + '-' + 
                       String(today.getMonth() + 1).padStart(2, '0') + '-' + 
                       String(today.getDate()).padStart(2, '0')

      const [roomsRes, usersRes, todayRes, pendingRes] = await Promise.all([
        supabase.from('rooms').select('*', { count: 'exact', head: true }),
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('bookings').select('*', { count: 'exact', head: true }).gte('start_time', `${todayStr}T00:00:00`).lte('start_time', `${todayStr}T23:59:59`),
        supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      ])
      setStats({ rooms: roomsRes.count || 0, users: usersRes.count || 0, todayBookings: todayRes.count || 0, pending: pendingRes.count || 0 })
    }
    fetchStats()
  }, [])

  return (
    <main className="page-container dashboard-shell">
      <section className="card dashboard-card">
        <div className="page-header dashboard-header">
          <div>
            <h1>🛠️ Admin Dashboard</h1>
            <p>ภาพรวมระบบจองห้องประชุม</p>
          </div>
          <span className="dashboard-pill">Control Center</span>
        </div>

        <div className="dashboard-profile dashboard-profile-card">
          {profile?.avatar_url ? <img src={profile.avatar_url} alt="avatar" className="dashboard-avatar" /> : <div className="dashboard-avatar-placeholder">🛡️</div>}
          <div>
            <h2>{profile.full_name}</h2>
            <p>{profile.email}</p>
            <span className="role-badge">Administrator</span>
          </div>
        </div>

        <div className="dashboard-stats">
          <div className="stat-card"><h3>🏢 ห้องประชุมทั้งหมด</h3><h1>{stats.rooms}</h1></div>
          <div className="stat-card"><h3>👥 ผู้ใช้งาน</h3><h1>{stats.users}</h1></div>
          <div className="stat-card"><h3>📅 จองวันนี้</h3><h1>{stats.todayBookings}</h1></div>
          {/* ✅ เปลี่ยนจาก Inline Style เป็น Class เงื่อนไข */}
          <div className="stat-card"><h3>⏳ รออนุมัติ</h3><h1 className={stats.pending > 0 ? 'text-danger' : 'text-primary'}>{stats.pending}</h1></div>
        </div>

        {/* ✅ เปลี่ยนจาก Inline Style เป็น Class */}
        
      </section>
    </main>
  )
}

export default AdminDashboard