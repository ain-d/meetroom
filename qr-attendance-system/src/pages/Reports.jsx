import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function Reports() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({
    totalBookings: 0,
    pending: 0,
    approved: 0,
    cancelled: 0,
    completed: 0,
    no_show: 0, // ✅ เพิ่มสถิติ No-show
    checkedIn: 0, // ✅ เพิ่มสถิติกำลังใช้งาน
    totalRooms: 0,
    totalUsers: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadStats = async () => {
      // ✅ ดึงสถิติที่ถูกต้องทั้งหมดแบบใช้ count จะเร็ว
      const [
        pendingRes, 
        approvedRes, 
        cancelledRes, 
        completedRes, 
        noShowRes,
        checkedInRes,
        roomsRes, 
        usersRes
      ] = await Promise.all([
        supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
        supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'cancelled'),
        supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
        supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'no_show'),
        supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'checked_in'),
        supabase.from('rooms').select('*', { count: 'exact', head: true }),
        supabase.from('users').select('*', { count: 'exact', head: true }),
      ])

      setStats({
        totalBookings: pendingRes.count + approvedRes.count + cancelledRes.count + completedRes.count + noShowRes.count + checkedInRes.count,
        pending: pendingRes.count || 0,
        approved: approvedRes.count || 0,
        cancelled: cancelledRes.count || 0,
        completed: completedRes.count || 0,
        no_show: noShowRes.count || 0,
        checkedIn: checkedInRes.count || 0,
        totalRooms: roomsRes.count || 0,
        totalUsers: usersRes.count || 0,
      })

      setLoading(false)
    }
    loadStats()
  }, [])

  if (loading) return <p style={{ padding: 30, textAlign: 'center' }}>กำลังโหลด...</p>

  return (
    <main className="page-container">
      <section className="card">
        <div className="page-header">
          <h1>📊 รายงงานสรุป</h1>
          <p>ข้อมูลสถิติทั้งหมดของระบบจองห้องประชุม</p>
        </div>

        <div className="dashboard-stats">
          <div className="stat-card">
            <h3>📋 การจองทั้งหมด</h3>
            <h1>{stats.totalBookings}</h1>
          </div>
          <div className="stat-card">
            <h3>⏳ รออนุมัติ</h3>
            <h1>{stats.pending}</h1>
          </div>
          <div className="stat-card">
            <h3>✅ อนุมัติแล้ว</h3>
            <h1>{stats.approved}</h1>
          </div>
          <div className="stat-card">
            <h3>🚪 ยกเลิกแล้ว</h3>
            <h1>{stats.cancelled}</h1>
          </div>
          <div className="stat-card">
            <h3>👀 กำลังใช้งาน</h3>
            <h1>{stats.checkedIn}</h1>
          </div>
          <div className="stat-card">
            <h3>✔️ ใช้งานสำเร็จ</h3>
            <h1>{stats.completed}</h1>
          </div>
          <div className="stat-card">
            <h3>❌ ไม่มาใช้งาน</h3>
            <h1>{stats.no_show}</h1>
          </div>
          <div className="stat-card">
            <h3>🏢 ห้องประชุม</h3>
            <h1>{stats.totalRooms}</h1>
          </div>
          <div className="stat-card">
            <h3>👥 ผู้ใช้งาน</h3>
            <h1>{stats.totalUsers}</h1>
          </div>
        </div>

        <button
          className="secondary-button"
          style={{ marginTop: 20, width: '100%' }}
          onClick={() => navigate('/dashboard')}
        >
          ← กลับหน้าหลัก
        </button>
      </section>
    </main>
  )
}

export default Reports