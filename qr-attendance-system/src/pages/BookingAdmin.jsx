import { useCallback, useEffect, useState } from 'react'
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

  const fetchBookings = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('bookings').select(`
      id, booking_number, title, room_id, user_id, start_time, end_time, purpose, status, approved_by, approved_at,
      rooms(name, image_url),
      users!bookings_user_id_fkey(full_name)
    `).order('start_time', { ascending: true })

    if (error) { setMessage({ type: 'error', text: error.message }); setLoading(false); return }

    // Map Approver Names
    const approverIds = [...new Set(data.map(i => i.approved_by).filter(Boolean))]
    const approverUsers = approverIds.length > 0 ? await supabase.from('users').select('id, full_name').in('id', approverIds) : { data: [] }
    const approverMap = new Map((approverUsers.data || []).map(u => [u.id, u.full_name]))
    
    setBookings((data || []).map(item => ({ ...item, approved_by_name: approverMap.get(item.approved_by) || null })))
    setLoading(false)
  }, [])

  useEffect(() => {
    let mounted = true
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { navigate('/login'); return }
      const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
      if (!mounted) return
      if (profile?.role !== 'admin') { navigate('/dashboard'); return }
      await fetchBookings()
    }
    load()
    const channel = supabase.channel('booking-admin').on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, fetchBookings).subscribe()
    return () => { mounted = false; supabase.removeChannel(channel) }
  }, [navigate, fetchBookings])

  const updateBookingStatus = async (bookingId, status) => {
    setUpdatingId(bookingId)
    if (status === 'cancelled' && !window.confirm('ยืนยันการยกเลิกการจอง?')) { setUpdatingId(null); return }
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/login'); return }

    const payload = { status }
    if (status === 'approved') {
      payload.approved_by = user.id
      payload.approved_at = new Date().toISOString()
    } else if (status === 'cancelled') {
      payload.approved_by = null 
      payload.approved_at = null
    }

    const { error } = await supabase.from('bookings').update(payload).eq('id', bookingId)
    
    if (error) { setMessage({ type: 'error', text: error.message }); setUpdatingId(null); return }
    
    setMessage({ type: 'success', text: status === 'approved' ? 'อนุมัติเรียบร้อย' : 'ยกเลิกเรียบร้อย' })
    await fetchBookings()
    setUpdatingId(null)
  }

  const formatDateTime = (date) => new Date(date).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })

  const filteredBookings = bookings.filter((b) => {
    const keyword = search.toLowerCase()
    const matchSearch = (b.users?.full_name?.toLowerCase() || '').includes(keyword) || 
                        (b.rooms?.name?.toLowerCase() || '').includes(keyword) || 
                        (b.title?.toLowerCase() || '').includes(keyword) ||
                        (b.booking_number?.toLowerCase() || '').includes(keyword) // ✅ เพิ่ม: ให้ค้นหาด้วยเลขคิวได้ด้วย
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
            <option value="cancelled">ยกเลิกแล้ว</option>
          </select>
        </div>

        <div style={{ marginBottom: 18, fontWeight: 'bold', color: '#2563eb' }}>พบทั้งหมด {filteredBookings.length} รายการ</div>

        <div className="report-actions">
          <button className="secondary-button" onClick={() => { downloadBookingCsv(filteredBookings); setMessage({type:'success', text:'ดาวน์โหลด CSV สำเร็จ'}) }}>📄 Export CSV</button>
          <button className="secondary-button" onClick={() => { printBookingReport(filteredBookings); setMessage({type:'success', text:'กำลังสร้าง PDF...'}) }}>🖨 Export PDF</button>
        </div>

        <div className="room-table-wrapper">
          <table className="room-table">
            {/* ✅ แก้หัวตารางให้ตรงกับข้อมูลจริง */}
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
              {loading ? <tr><td colSpan="7" style={{textAlign:'center'}}>กำลังโหลด...</td></tr> : 
               filteredBookings.length === 0 ? <tr><td colSpan="7" style={{textAlign:'center'}}>ไม่พบข้อมูล</td></tr> :
               filteredBookings.map((b) => (
                <tr key={b.id}>
                  <td>{b.rooms?.image_url ? <img src={b.rooms.image_url} alt={b.rooms.name} /> : <div className="img-placeholder">ไม่มีรูป</div>}</td>
                  <td>
                    {/* ✅ จัดระเบียบให้สวยงาม */}
                    <strong style={{fontFamily:'monospace', color:'#2563eb', fontSize: '15px'}}>{b.booking_number || '-'}</strong><br/>
                    <strong style={{fontSize: '14px'}}>{b.title || b.purpose}</strong><br/>
                    <small style={{color:'#64748b'}}>🏢 {b.rooms?.name}</small>
                  </td>
                  <td>{b.users?.full_name}</td>
                  <td>
                    <div>{formatDateTime(b.start_time)}</div>
                    <small>ถึง {formatDateTime(b.end_time)}</small>
                  </td>
                  <td><span className={`status ${b.status}`}>{b.status === 'approved' ? 'อนุมัติแล้ว' : b.status === 'cancelled' ? 'ยกเลิก' : 'รออนุมัติ'}</span></td>
                  <td>{b.approved_by_name || '-'}</td>
                  <td>
                    <button disabled={updatingId === b.id || b.status === 'approved'} onClick={() => updateBookingStatus(b.id, 'approved')}>
                      {updatingId === b.id ? '...' : 'อนุมัติ'}
                    </button>
                    <button className="danger-button" disabled={updatingId === b.id || b.status === 'cancelled'} onClick={() => updateBookingStatus(b.id, 'cancelled')}>ยกเลิก</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}

export default BookingAdmin