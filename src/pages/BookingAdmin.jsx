import { useCallback, useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { downloadBookingCsv, printBookingReport } from '../lib/bookingReport'

function BookingAdmin() {
  const navigate = useNavigate()
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [updatingId, setUpdatingId] = useState(null)
  const mountedRef = useRef(true)

  const fetchBookings = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('bookings').select(`
      id, booking_number, title, room_id, user_id, start_time, end_time, purpose, status, approved_by, approved_at,
      rooms(name, image_url),
      users!bookings_user_id_fkey(full_name)
    `).order('start_time', { ascending: true })

    if (!mountedRef.current) return

    if (error) {
      setMessage({ type: 'error', text: error.message })
      setLoading(false)
      return
    }

    // Map Approver Names
    const approverIds = [...new Set(data.map(i => i.approved_by).filter(Boolean))]
    let approverMap = new Map()
    if (approverIds.length > 0) {
      const { data: approverUsers, error: approverError } = await supabase
        .from('users')
        .select('id, full_name')
        .in('id', approverIds)

      if (approverError) {
        console.error('โหลดชื่อผู้อนุมัติไม่สำเร็จ:', approverError.message)
      } else {
        approverMap = new Map((approverUsers || []).map(u => [u.id, u.full_name]))
      }
    }

    if (!mountedRef.current) return
    setBookings((data || []).map(item => ({ ...item, approved_by_name: approverMap.get(item.approved_by) || null })))
    setLoading(false)
  }, [])

  useEffect(() => {
    mountedRef.current = true
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { navigate('/login'); return }
      const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
      if (!mountedRef.current) return
      if (profile?.role !== 'admin') { navigate('/dashboard'); return }
      await fetchBookings()
    }
    load()
    const channel = supabase
      .channel('booking-admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, fetchBookings)
      .subscribe()

    return () => {
      mountedRef.current = false
      supabase.removeChannel(channel)
    }
  }, [navigate, fetchBookings])

  const updateBookingStatus = async (bookingId, status) => {
    setUpdatingId(bookingId)
    if (status === 'rejected' && !window.confirm('ยืนยันการปฏิเสธการจอง?')) {
      setUpdatingId(null)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/login'); return }

    const payload = { status }
    if (status === 'approved') {
      payload.approved_by = user.id
      payload.approved_at = new Date().toISOString()
    } else if (status === 'rejected') {
      // ปฏิเสธโดย Admin: ล้าง approved_by/approved_at
      payload.approved_by = null
      payload.approved_at = null
    }

    console.log('🔍 กำลังส่ง Payload:', payload)
    console.log('🔍 Booking ID:', bookingId)

    const { data, error } = await supabase
      .from('bookings')
      .update(payload)
      .eq('id', bookingId)
      .select()

    console.log('🔍 ผลลัพธ์ที่ได้กลับมา (data):', data)
    console.log('🔍 Error ที่ได้กลับมา:', error)

    if (error) {
      setMessage({ type: 'error', text: `เกิดข้อผิดพลาด: ${error.message}` })
      setUpdatingId(null)
      return
    }

    if (!data || data.length === 0) {
      console.warn('⚠️ ไม่มีแถวไหนถูกอัปเดต — RLS อาจบล็อก หรือหา id ไม่เจอ')
      setMessage({
        type: 'error',
        text: 'อัปเดตไม่สำเร็จ: ไม่พบรายการ หรือคุณไม่มีสิทธิ์แก้ไขรายการนี้',
      })
      setUpdatingId(null)
      return
    }

    setMessage({ type: 'success', text: status === 'approved' ? 'อนุมัติเรียบร้อย' : 'ปฏิเสธเรียบร้อย' })
    await fetchBookings()
    setUpdatingId(null)
  }

  const formatDateTime = (date) => new Date(date).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })

  const statusLabel = (status) => {
    if (status === 'approved') return 'อนุมัติแล้ว'
    if (status === 'cancelled') return 'ยกเลิก'
    if (status === 'rejected') return 'ปฏิเสธ'
    return 'รออนุมัติ'
  }

  const filteredBookings = bookings.filter((b) => {
    const keyword = search.toLowerCase()
    const matchSearch = (b.users?.full_name?.toLowerCase() || '').includes(keyword) ||
                        (b.rooms?.name?.toLowerCase() || '').includes(keyword) ||
                        (b.title?.toLowerCase() || '').includes(keyword) ||
                        (b.booking_number?.toLowerCase() || '').includes(keyword)
    const matchStatus = statusFilter === 'all' ? true : b.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <main className="page-container">
      <section className="card">
        <div className="page-header">
          <h1>📋 อนุมัติการจองห้องประชุม</h1>
          <p>จัดการและอนุมัติการจองทั้งหมด</p>
        </div>

        {message.text && <div className={`message ${message.type}`}>{message.text}</div>}

        <div className="admin-toolbar">
          <input type="text" placeholder="ค้นหาเลขคิว, ชื่อผู้จอง หรือหัวข้อ" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">ทุกสถานะ</option>
            <option value="pending">รออนุมัติ</option>
            <option value="approved">อนุมัติแล้ว</option>
            <option value="rejected">ปฏิเสธแล้ว</option>
            <option value="cancelled">ยกเลิกแล้ว</option>
          </select>
        </div>

        <div className="table-count">พบทั้งหมด {filteredBookings.length} รายการ</div>

        <div className="report-actions">
          <button className="secondary-button" onClick={() => { downloadBookingCsv(filteredBookings); setMessage({ type: 'success', text: 'ดาวน์โหลด CSV สำเร็จ' }) }}>📄 Export CSV</button>
          <button className="secondary-button" onClick={() => { printBookingReport(filteredBookings); setMessage({ type: 'success', text: 'กำลังสร้าง PDF...' }) }}>🖨️ Export PDF</button>
        </div>

        <div className="room-table-wrapper">
          <table className="room-table">
            <thead>
              <tr>
                <th>รูป</th>
                <th>เลขคิว / หัวข้อ</th>
                <th>ผู้จอง</th>
                <th>เวลา</th>
                <th>สถานะ</th>
                <th>ผู้อนุมัติ</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan="7" className="text-center">กำลังโหลด...</td></tr> :
               filteredBookings.length === 0 ? <tr><td colSpan="7" className="text-center">ไม่พบข้อมูล</td></tr> :
               filteredBookings.map((b) => {
                const isDecided = b.status !== 'pending'
                return (
                <tr key={b.id}>
                  <td>{b.rooms?.image_url ? <img src={b.rooms.image_url} alt={b.rooms.name} /> : <div className="img-placeholder">ไม่มีรูป</div>}</td>
                  <td>
                    <div className="booking-number">{b.booking_number || '-'}</div>
                    <div className="booking-title">{b.title || b.purpose}</div>
                    <div className="booking-sub">🏢 {b.rooms?.name}</div>
                  </td>
                  <td>{b.users?.full_name}</td>
                  <td>
                    <div className="booking-time-block">
                      <div>{formatDateTime(b.start_time)}</div>
                      <small>ถึง {formatDateTime(b.end_time)}</small>
                    </div>
                  </td>
                  <td><span className={`status ${b.status}`}>{statusLabel(b.status)}</span></td>
                  <td>{b.approved_by_name || '-'}</td>
                  <td>
                    <div className="table-actions">
                      <button disabled={updatingId === b.id || isDecided} onClick={() => updateBookingStatus(b.id, 'approved')}>
                        {updatingId === b.id ? '...' : 'อนุมัติ'}
                      </button>
                      <button className="danger-button" disabled={updatingId === b.id || isDecided} onClick={() => updateBookingStatus(b.id, 'rejected')}>ปฏิเสธ</button>
                    </div>
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}

export default BookingAdmin