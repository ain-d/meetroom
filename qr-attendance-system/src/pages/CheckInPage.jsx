import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function CheckInPage() {
  const { id } = useParams() // รับ ID ของการจองจาก URL
  const navigate = useNavigate()
  const [booking, setBooking] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkBooking = async () => {
      // ดึงข้อมูลการจองที่สแกนมา
      const { data, error } = await supabase
        .from('bookings')
        .select(`id, booking_number, title, start_time, end_time, rooms(name)`)
        .eq('id', id)
        .single()

      if (error || !data) {
        alert('ไม่พบข้อมูลการจองนี้ หรือลิงก์อาจหมดอายุ')
        navigate('/dashboard')
        return
      }

      setBooking(data)
      setLoading(false)
    }
    checkBooking()
  }, [id, navigate])

  const handleCheckIn = async () => {
    // อัปเดตสถานะเป็นกำลังใช้งาน
    const { error } = await supabase.from('bookings').update({ status: 'checked_in' }).eq('id', id)
    
    if (error) {
      alert('เกิดข้อผิดพลาด: ' + error.message)
    } else {
      // พาไปหน้าจับเวลา
      navigate(`/booking/${id}/usage`) 
    }
  }

  if (loading) return <div style={{padding: 50, textAlign: 'center'}}>กำลังตรวจสอบรายการจอง...</div>

  // ถ้าสถานะไม่ใช่ approved จะไม่ให้กดเช็คอิน
  if (booking?.status !== 'approved') {
    return (
      <main className="page-container">
        <section className="card" style={{ textAlign: 'center', padding: 40 }}>
          <h1>❌ ไม่สามารถเช็คอินได้</h1>
          <p>สถานะการจองนี้คือ: {booking?.status}</p>
          <button className="secondary-button" style={{marginTop: 20}} onClick={() => navigate('/dashboard')}>กลับหน้าหลัก</button>
        </section>
      </main>
    )
  }

  return (
    <main className="page-container">
      <section className="card" style={{ textAlign: 'center', padding: 40 }}>
        <h1 style={{color: '#16a34a'}}>🏢 {booking.rooms?.name}</h1>
        <h2>เลขคิว: {booking.booking_number}</h2>
        <p style={{fontSize: 18, margin: '20px 0'}}>{booking.title}</p>
        
        <div style={{marginBottom: 30}}>
          <p>เวลาเริ่ม: {new Date(booking.start_time).toLocaleString('th-TH')}</p>
          <p>เวลาสิ้นสุด: {new Date(booking.end_time).toLocaleString('th-TH')}</p>
        </div>

        <button 
          onClick={handleCheckIn}
          style={{ 
            padding: '20px 60px', 
            fontSize: 24, 
            background: '#16a34a', 
            color: 'white', 
            border: 'none', 
            borderRadius: 15, 
            cursor: 'pointer', 
            fontWeight: 'bold',
            boxShadow: '0 4px 15px rgba(22, 163, 74, 0.4)'
          }}
        >
          ✅ ยืนยันเข้าใช้ห้อง
        </button>
      </section>
    </main>
  )
}

export default CheckInPage