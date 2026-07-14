import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function RoomKiosk() {
  const { roomId } = useParams() // รับ ID จาก URL
  const navigate = useNavigate()
  const [room, setRoom] = useState(null)
  const [activeBooking, setActiveBooking] = useState(null)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)

  useEffect(() => {
    const init = async () => {
      // 1. เช็ค Login
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) { navigate('/login'); return }
      setUser(currentUser)

      // 2. ดึงข้อมูลห้อง
      const { data: roomData } = await supabase.from('rooms').select('name, image_url, capacity').eq('id', roomId).single()
      setRoom(roomData)

      // 3. ค้นหาว่า User คนนี้มีการจองห้องนี้ที่กำลังใช้ได้ไหม (สถานะ approved และเวลาตอนนี้อยู่ในช่วงจอง)
      const now = new Date().toISOString()
      const { data: bookings } = await supabase.from('bookings')
        .select('id, booking_number, start_time, end_time')
        .eq('room_id', roomId)
        .eq('user_id', currentUser.id)
        .eq('status', 'approved')
        .lte('start_time', now)
        .gte('end_time', now)
        .limit(1)

      setActiveBooking(bookings?.[0] || null)
      setLoading(false)
    }
    init()
  }, [roomId, navigate])

  const handleCheckIn = async () => {
    if (!activeBooking) return
    await supabase.from('bookings').update({ status: 'checked_in' }).eq('id', activeBooking.id)
    navigate(`/booking/${activeBooking.id}/usage`) // ไปหน้าจับเวลา
  }

  const handleWalkIn = () => {
    // พาไปหน้าจอง พร้อมส่ง roomId และเวลาปัจจุบันไปด้วย (ผมจะสอนวิธีรับค่านี้ในหน้า Booking ต่อไป)
    const now = new Date()
    const startTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
    navigate(`/booking?room=${roomId}&time=${startTime}`)
  }

  if (loading) return <div style={{padding: 50, textAlign: 'center'}}>กำลังตรวจสอบข้อมูลห้อง...</div>

  return (
    <main style={{ padding: 20, maxWidth: 400, margin: '0 auto', fontFamily: 'sans-serif' }}>
      <div style={{ background: 'white', borderRadius: 16, padding: 30, boxShadow: '0 4px 20px rgba(0,0,0,0.1)', textAlign: 'center' }}>
        
        <h2 style={{ margin: '0 0 5px' }}>🏢 {room?.name || 'ห้องประชุม'}</h2>
        <p style={{ color: '#64748b', margin: '0 0 20px' }}>ความจุ: {room?.capacity} คน</p>

        {/* ถ้ามีการจองอยู่ -> แสดงปุ่มเช็คอิน */}
        {activeBooking ? (
          <>
            <div style={{ background: '#f0fdf4', padding: 15, borderRadius: 10, marginBottom: 20 }}>
              <p style={{margin: '0 0 5px', color: '#16a34a', fontWeight: 'bold' }}>มีการจองของคุณอยู่</p>
              <p style={{margin: 0, fontSize: 14}}>เลขคิว: {activeBooking.booking_number}</p>
            </div>
            <button 
              onClick={handleCheckIn}
              style={{ width: '100%', padding: 15, fontSize: 18, background: '#16a34a', color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 'bold' }}
            >
              ✅ ยืนยันเข้าใช้ห้อง (Check-in)
            </button>
          </>
        ) : (
          /* ถ้าไม่มีการจอง -> แสดงปุ่มจองแบบ Walk-in */
          <>
            <div style={{ background: '#eff6ff', padding: 15, borderRadius: 10, marginBottom: 20 }}>
              <p style={{margin: 0, color: '#2563eb', fontSize: 14}}>คุณยังไม่มีการจองห้องนี้ในเวลานี้</p>
            </div>
            <button 
              onClick={handleWalkIn}
              style={{ width: '100%', padding: 15, fontSize: 18, background: '#2563eb', color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 'bold' }}
            >
              📅 จองห้องตอนนี้ (Walk-in)
            </button>
          </>
        )}

        <button 
          onClick={() => navigate('/dashboard')} 
          style={{ marginTop: 15, background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', width: '100%' }}
        >
          กลับไปหน้าหลัก
        </button>
      </div>
    </main>
  )
}

export default RoomKiosk