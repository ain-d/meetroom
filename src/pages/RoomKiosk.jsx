import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function RoomKiosk() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const [room, setRoom] = useState(null)
  const [activeBooking, setActiveBooking] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) { navigate('/login'); return }

      const { data: roomData } = await supabase.from('rooms').select('name, image_url, capacity').eq('id', roomId).single()
      setRoom(roomData)

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
    navigate(`/booking/${activeBooking.id}/usage`)
  }

  const handleWalkIn = () => {
    const now = new Date()
    const startTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
    navigate(`/booking?room=${roomId}&time=${startTime}`)
  }

  if (loading) return <div className="text-center" style={{padding: 50}}>กำลังตรวจสอบข้อมูลห้อง...</div>

  return (
    <main className="page-container">
      <section className="card" style={{maxWidth: 400, margin: '0 auto', textAlign: 'center'}}>
        <h2 style={{ margin: '0 0 5px' }}>🏢 {room?.name || 'ห้องประชุม'}</h2>
        <p className="text-empty" style={{ marginBottom: 20 }}>ความจุ: {room?.capacity} คน</p>
        {activeBooking ? (
          <>
            <div style={{ background: '#f0fdf4', padding: 15, borderRadius: 10, marginBottom: 20 }}>
              <p style={{margin: '0 0 5px', color: '#16a34a', fontWeight: 'bold'}}>มีการจองของคุณอยู่</p>
              <p style={{margin: 0, fontSize: 14}}>เลขคิว: {activeBooking.booking_number}</p>
            </div>
            <button onClick={handleCheckIn} className="logout-button" style={{background: '#16a34a', color: 'white', border: 'none'}}>✅ ยืนยันเข้าใช้ห้อง (Check-in)</button>
          </>
        ) : (
          <>
            <div style={{ background: '#eff6ff', padding: 15, borderRadius: 10, marginBottom: 20 }}>
              <p style={{margin: 0, color: '#2563eb', fontSize: 14}}>คุณยังไม่มีการจองห้องนี้ในเวลานี้</p>
            </div>
            <button onClick={handleWalkIn}>📅 จองห้องตอนนี้ (Walk-in)</button>
          </>
        )}
        <button className="secondary-button full-width" style={{ marginTop: 15 }} onClick={() => navigate('/dashboard')}>กลับไปหน้าหลัก</button>
      </section>
    </main>
  )
}
export default RoomKiosk