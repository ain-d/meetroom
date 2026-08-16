import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
// ❌ ลบการ import QR Code ออกแล้ว

function BookingHistory() {
  const navigate = useNavigate()
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [actionLoading, setActionLoading] = useState(null)
  
  // ❌ ลบ State ของ QR Modal ออกแล้ว (showQrModal, qrData)

  useEffect(() => {
    let mounted = true
    const loadBookings = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { navigate('/login'); return }

      const { data, error } = await supabase
        .from('bookings')
        .select('id, booking_number, title, room_id, start_time, end_time, purpose, status, approved_at, rooms(name)')
        .eq('user_id', user.id)
        .order('start_time', { ascending: false })

      if (!mounted) return
      if (error) setMessage({ type: 'error', text: `โหลดประวัติการจองไม่สำเร็จ: ${error.message}` })
      else setBookings(data || [])
      setLoading(false)
    }
    loadBookings()
    return () => { mounted = false }
  }, [navigate])

    const handleCancel = async (bookingId) => {
    const booking = bookings.find(b => b.id === bookingId)
    const timeUntilStart = new Date(booking.start_time) - new Date()
    const ONE_HOUR = 60 * 60 * 1000

    if (timeUntilStart <= ONE_HOUR) {
      setMessage({ type: 'error', text: 'ไม่สามารถยกเลิกได้ เนื่องจากเหลือ 1 ชั่วโมงก่อนเวลาใช้งาน' })
      return
    }

    if (!window.confirm('ยืนยันต้องการยกเลิกการจองนี้?')) return

    setActionLoading(bookingId)
    const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', bookingId)
    
    if (error) {
      // 🔴 ใช้ alert ก่อน เพื่อดูว่าฐานข้อมูลตอบอะไรกลับมา (ถ้ายังมีปัญหา)
      alert('ยกเลิกไม่สำเร็จ ฐานข้อมูลตอบว่า: ' + error.message)
      setActionLoading(null)
    } else {
      // ✅ ถ้าฐานข้อมูลบอกว่า "สำเร็จ" จริงๆ ค่อยอัปเดตหน้าจอ
      setMessage({ type: 'success', text: 'ยกเลิกการจองเรียบร้อยแล้ว' })
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: 'cancelled' } : b))
      setActionLoading(null)
    }
  }

  // ✅ เพิ่มฟังก์ชัน Check-in ใหม่
  const handleCheckIn = async (bookingId) => {
    if (!window.confirm('ยืนยันเข้าใช้ห้องประชุม?')) return

    setActionLoading(bookingId)
    const { error } = await supabase.from('bookings').update({ status: 'checked_in' }).eq('id', bookingId)
    
    if (error) {
      setMessage({ type: 'error', text: 'เช็คอินไม่สำเร็จ: ' + error.message })
      setActionLoading(null)
    } else {
      // ถ้าสำเร็จ พาไปหน้าจับเวลาทันที
      navigate(`/booking/${bookingId}/usage`)
    }
  }

  const formatDateTime = (date) => new Date(date).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })

  const renderCancelButton = (booking) => {
    const now = new Date()
    const start = new Date(booking.start_time)
    const timeUntilStart = start - now
    const ONE_HOUR = 60 * 60 * 1000

    if (timeUntilStart > ONE_HOUR) {
      return (
        <button 
          className="danger-button" 
          disabled={actionLoading === booking.id}
          onClick={() => handleCancel(booking.id)}
        >
          {actionLoading === booking.id ? 'กำลังยกเลิก...' : '❌ ยกเลิกการจอง'}
        </button>
      )
    }

    return <span style={{ fontSize: 13, color: '#94a3b8' }}>ไม่สามารถยกเลิกได้ (เหลือน้อยกว่า 1 ชม.)</span>
  }

    const getActionButtons = (booking) => {
    const now = new Date()
    const start = new Date(booking.start_time)
    const end = new Date(booking.end_time) // ✅ 1. เพิ่มการดึงเวลาสิ้นสุดมาด้วย

    // ✅ ยังรออนุมัติอยู่: ให้ยกเลิกคำขอได้เช่นกัน (ใช้กฎ 1 ชม. เดียวกับตอนอนุมัติแล้ว)
    if (booking.status === 'pending') {
      return renderCancelButton(booking)
    }

    if (booking.status !== 'approved') return null

    // ✅ 2. ถ้าเลยเวลาสิ้นสุดแล้ว ให้แสดงสถานะแทน (ห้ามกดเช็คอิน)
    if (now >= end) {
      return <span style={{ fontSize: 13, color: '#ef4444', fontWeight: 'bold' }}>⏰ เลยกำหนดเวลาแล้ว</span>
    }

    // ✅ 3. ถ้าถึงเวลาเริ่มแล้ว แต่ "ยังไม่ถึงเวลาสิ้นสุด" ถึงจะแสดงปุ่มกดเข้าใช้ห้อง
    if (now >= start && now < end) {
      return (
        <button 
          style={{ 
            fontSize: 14, padding: '8px 16px', background: '#16a34a', color: 'white', 
            border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold',
            boxShadow: '0 2px 8px rgba(22, 163, 74, 0.3)'
          }}
          disabled={actionLoading === booking.id}
          onClick={() => handleCheckIn(booking.id)}
        >
          {actionLoading === booking.id ? '⏳ กำลังเข้าสู่ห้อง...' : '✅ เข้าใช้ห้อง'}
        </button>
      )
    }

    // 4. กรณียังไม่ถึงเวลาเริ่ม แสดงปุ่ม/ข้อความยกเลิกตามกฎ 1 ชม.
    return renderCancelButton(booking)
  }

  const renderStatus = (status) => {
    const map = { 
      pending: 'รออนุมัติ',
      approved: 'อนุมัติแล้ว', 
      rejected: 'ปฏิเสธแล้ว',
      cancelled: 'ยกเลิกแล้ว', 
      checked_in: 'กำลังใช้งาน',
      completed: 'ใช้งานสำเร็จแล้ว',
      no_show: 'ไม่มาใช้งาน (No-show)'
    }
    return map[status] || status
  }

  return (
    <main className="page-container">
      <section className="card">
        <div className="page-header">
          <h1>📄 ประวัติการจอง</h1>
          <p>รายการจองทั้งหมดของคุณ และสถานะล่าสุด</p>
        </div>

        {message.text && <div className={`message ${message.type}`}>{message.text}</div>}

        <div className="room-table-wrapper">
          {loading ? (
            <p style={{textAlign:'center'}}>กำลังโหลดประวัติการจอง...</p>
          ) : (
            <table className="room-table">
              <thead>
                <tr>
                  <th>ห้อง / หัวข้อ</th>
                  <th>เวลา</th>
                  <th>สถานะ</th>
                  <th>การจัดการ</th>
                </tr>
              </thead>
              <tbody>
                {bookings.length === 0 ? (
                  <tr><td colSpan="4" style={{textAlign:'center'}}>ยังไม่มีประวัติการจอง</td></tr>
                ) : (
                  bookings.map((b) => (
                    <tr key={b.id}>
                      <td>
                        <strong>{b.title || b.purpose || '-'}</strong><br/>
                        <small style={{color:'#64748b'}}>🏢 {b.rooms?.name || '-'}</small><br/>
                        <small style={{color:'#2563eb', fontFamily:'monospace', fontWeight:'bold'}}>🆔 {b.booking_number || '-'}</small>
                      </td>
                      <td>
                        {formatDateTime(b.start_time)}<br/>
                        <small>ถึง {formatDateTime(b.end_time)}</small>
                      </td>
                      <td><span className={`status ${b.status}`}>{renderStatus(b.status)}</span></td>
                      <td>{getActionButtons(b)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        
      </section>

      {/* ❌ ลบส่วน Popup QR Code ทั้งหมดออกแล้ว */}
    </main>
  )
}

export default BookingHistory