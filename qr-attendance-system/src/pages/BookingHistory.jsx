import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { QRCodeSVG } from 'qrcode.react'

function BookingHistory() {
  const navigate = useNavigate()
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [actionLoading, setActionLoading] = useState(null)
  
  // ✅ State สำหรับเปิด-ปิด Popup QR Code
  const [showQrModal, setShowQrModal] = useState(false)
  const [qrData, setQrData] = useState(null)

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
      setMessage({ type: 'error', text: 'ยกเลิกไม่สำเร็จ: ' + error.message })
    } else {
      setMessage({ type: 'success', text: 'ยกเลิกการจองเรียบร้อยแล้ว' })
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: 'cancelled' } : b))
    }
    setActionLoading(null)
  }

  const formatDateTime = (date) => new Date(date).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })

  const getActionButtons = (booking) => {
    const now = new Date()
    const start = new Date(booking.start_time)
    const timeUntilStart = start - now
    const ONE_HOUR = 60 * 60 * 1000

    if (booking.status !== 'approved') return null

    if (now >= start) {
      return <span style={{ fontSize: 13, color: '#2563eb', fontWeight: 'bold' }}>📱 กรุณาสแกน QR ที่ห้องประชุม</span>
    }

    if (timeUntilStart > ONE_HOUR) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {/* ✅ ปุ่มสำหรับเปิดดู QR Code */}
          <button 
            className="secondary-button" 
            style={{ fontSize: 12, padding: '5px 10px' }}
            onClick={() => { setQrData(booking); setShowQrModal(true) }}
          >
            📱 ดู QR Code
          </button>
          <button 
            className="danger-button" 
            disabled={actionLoading === booking.id}
            onClick={() => handleCancel(booking.id)}
          >
            {actionLoading === booking.id ? 'กำลังยกเลิก...' : '❌ ยกเลิกการจอง'}
          </button>
        </div>
      )
    }

    return <span style={{ fontSize: 13, color: '#94a3b8' }}>ไม่สามารถยกเลิกได้ (เหลือน้อยกว่า 1 ชม.)</span>
  }

  const renderStatus = (status) => {
    const map = { 
      approved: 'อนุมัติแล้ว', 
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

        <button className="secondary-button" style={{ marginTop: 20, width: '100%' }} onClick={() => navigate('/dashboard')}>
          ← กลับหน้าหลัก
        </button>
      </section>

      {/* ✅ Popup สำหรับแสดง QR Code แบบสวยงาม */}
      {showQrModal && qrData && (
        <div 
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
            background: 'rgba(0,0,0,0.5)', display: 'flex', 
            alignItems: 'center', justifyContent: 'center', zIndex: 9999
          }} 
          onClick={() => setShowQrModal(false)} // คลิกพื้นหลังปิด
        >
          <div 
            style={{
              background: 'white', padding: '30px', borderRadius: '20px', 
              textAlign: 'center', maxWidth: '350px', width: '90%',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              position: 'relative'
            }} 
            onClick={(e) => e.stopPropagation()} // กดข้างใน Popup ไม่ให้ปิด
          >
            {/* ปุ่มปิด */}
            <button 
              onClick={() => setShowQrModal(false)} 
              style={{ position: 'absolute', top: '15px', right: '20px', background: 'none', fontSize: '24px', cursor: 'pointer', color: '#64748b', border: 'none' }}
            >
              ×
            </button>

            <h2 style={{ margin: '0 0 5px', color: '#334155' }}>🪪 {qrData.rooms?.name}</h2>
            <p style={{ margin: '0 0 20px', color: '#64748b', fontSize: '14px' }}>{qrData.title}</p>
            
            <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '16px', display: 'inline-block' }}>
              <QRCodeSVG 
                value={`${window.location.origin}/checkin/${qrData.id}`} 
                size={200}
              />
            </div>

            <p style={{ margin: '15px 0 5px', fontFamily: 'monospace', fontWeight: 'bold', color: '#2563eb', fontSize: '18px' }}>
              {qrData.booking_number}
            </p>
            <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#94a3b8' }}>
              แสดง QR Code นี้ต่อเจ้าหน้าที่ห้อง<br/>เพื่อยืนยันการเข้าใช้งาน
            </p>
          </div>
        </div>
      )}
    </main>
  )
}

export default BookingHistory