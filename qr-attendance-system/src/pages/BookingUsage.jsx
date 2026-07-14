import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function BookingUsage() {
  const { id } = useParams() // รับ ID จาก URL
  const navigate = useNavigate()
  const [booking, setBooking] = useState(null)
  const [loading, setLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const fetchBooking = async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('id, title, start_time, end_time, rooms(name, image_url, capacity)')
        .eq('id', id)
        .single()

      if (error) {
        alert('ไม่พบข้อมูลการจองนี้')
        navigate('/booking-history')
        return
      }
      setBooking(data)
      setLoading(false)
    }
    fetchBooking()
  }, [id, navigate])

  // ✅ นาฬิกาจับนวนเวลาแบบ Real-time
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const formatTime = (dateStr) => new Date(dateStr).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
  const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })

  // ✅ ฟังก์ชันจบการใช้งาน (แก้ไม่ให้เขียนทับเวลาจองเดิม)
  const handleEndSession = async () => {
    if (!window.confirm('ยืนยันว่าจะจบการใช้งานห้องนี้แล้วหรือยัง?')) return

    const { error } = await supabase
      .from('bookings')
      .update({ 
        status: 'completed',
        // ✅ เปลี่ยนจาก end_time เป็น actual_end_time (ต้องเพิ่มฟิลด์นี้ใน Supabase ก่อน)
        actual_end_time: new Date().toISOString() 
      })
      .eq('id', id)

    if (error) {
      alert('เกิดข้อผิดพลาด: ' + error.message)
    } else {
      navigate('/booking-history')
    }
  }

  // ✅ คำนวณเวลาที่ใช้งานจริง (เพิ่ม Math.max เผื่อเวลาติดลบ)
  const startTime = booking ? new Date(booking.start_time) : null
  const diffMs = startTime ? Math.max(0, currentTime - startTime) : 0
  const diffMins = Math.floor(diffMs / 60000)
  const hours = Math.floor(diffMins / 60)
  const minutes = diffMins % 60

  if (loading) return <p style={{ padding: 30, textAlign: 'center' }}>กำลังโหลด...</p>

  return (
    <main className="page-container">
      <section className="card">
        <div className="page-header">
          <h1>🟢 กำลังใช้งานห้องประชุม</h1>
          <p>ระบบกำลังบันทึกเวลาการใช้งานจริงของคุณอัตโนมัติ</p>
        </div>

        {booking && (
          <div className="usage-active-card" style={{ padding: 30, borderRadius: 18, marginBottom: 25 }}>
            <div className="dashboard-profile">
              {booking.rooms?.image_url ? (
                <img src={booking.rooms.image_url} alt="Room" className="dashboard-avatar" style={{ width: 100, height: 100 }} />
              ) : (
                <div className="dashboard-avatar-placeholder" style={{ width: 100, height: 100, fontSize: 40 }}>🏢</div>
              )}
              <div>
                <h2 style={{ margin: 0, color: '#15803d' }}>{booking.rooms?.name}</h2>
                <p style={{ margin: '4px 0 0', color: '#475569' }}>{booking.title}</p>
                <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>
                  จองเวลา: {formatDate(booking.start_time)} ({formatTime(booking.start_time)} - {formatTime(booking.end_time)})
                </p>
              </div>
            </div>

            <div style={{ textAlign: 'center', padding: '30px 0' }}>
              <h1 style={{ fontSize: '64px', margin: 0, color: '#15803d' }}>
                {hours.toString().padStart(2, '0')}:{minutes.toString().padStart(2, '0')}
              </h1>
              <p style={{ margin: '5px 0 0', color: '#475569' }}>เวลาที่ผ่านไป</p>
              <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>
                {/* ✅ แก้ไขข้อความผิด และดึงเวลาเริ่มต้นจาก booking แทน currentTime */}
                เริ่มเวลา: {formatTime(booking.start_time)}
              </p>
            </div>

            <button 
              className="logout-button" 
              style={{ background: '#15803d' }}
              onClick={handleEndSession}
            >
              🏁 จบการใช้งานและออกจากห้อง
            </button>
          </div>
        )}
      </section>
    </main>
  )
}

export default BookingUsage