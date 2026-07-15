/* eslint-disable react-hooks/preserve-manual-memoization */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const monthNames = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม']
const dayNames = ['อา.','จ.','อ.','พ.','พฤ.','ศ.','ส.']

function Calendar() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [bookings, setBookings] = useState([])
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [viewMode, setViewMode] = useState('month')

  useEffect(() => {
    let mounted = true
    const loadBookings = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { navigate('/login'); return }

      const { data, error } = await supabase.from('bookings')
        .select('id, title, purpose, start_time, end_time, status, rooms(name), users!bookings_user_id_fkey(full_name)')
        .order('start_time', { ascending: true })
        
      if (!mounted) return
      if (error) setError(error.message)
      else setBookings(data || [])
      setLoading(false)
    }
    loadBookings()

    const channel = supabase.channel('calendar-realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => loadBookings()).subscribe()
    return () => { mounted = false; supabase.removeChannel(channel) }
  }, [navigate])

  const month = selectedDate.getMonth()
  const year = selectedDate.getFullYear()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const calendar = []
  for (let i = 0; i < firstDay; i++) calendar.push(null)
  for (let d = 1; d <= daysInMonth; d++) calendar.push(new Date(year, month, d))
  while (calendar.length % 7 !== 0) calendar.push(null)

  const bookingCountsMap = useMemo(() => {
    const counts = new Map()
    bookings.forEach(b => {
      const d = new Date(b.start_time)
      if (d.getMonth() === month && d.getFullYear() === year) {
        const day = d.getDate()
        counts.set(day, (counts.get(day) || 0) + 1)
      }
    })
    return counts
  }, [bookings, month, year])

  const dayBookings = useMemo(() => {
    return bookings.filter((b) => {
      const d = new Date(b.start_time)
      return d.getDate() === selectedDate.getDate() && d.getMonth() === selectedDate.getMonth() && d.getFullYear() === selectedDate.getFullYear()
    })
  }, [bookings, selectedDate])

  const formatTime = (timeStr) => new Date(timeStr).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false })
  const getStatusText = (status) => status === 'approved' ? 'อนุมัติแล้ว' : status === 'cancelled' ? 'ยกเลิก' : status === 'completed' ? 'เสร็จสิ้น' : 'รออนุมัติ'

  return (
    <main className="page-container">
      <section className="card">
        <div className="page-header">
          <h1>📅 ปฏิทินการจองห้องประชุม</h1>
          <p>ตรวจสอบตารางการใช้งานห้องประชุมแบบ Real-time</p>
        </div>

        {loading && <p className="text-center">กำลังโหลดข้อมูล...</p>}
        {!loading && error && <div className="message error">{error}</div>}

        {!loading && !error && (
          <>
            <div className="cal-toolbar">
              <div className="cal-nav">
                <button onClick={() => setSelectedDate(new Date(year, month - 1, 1))} className="cal-btn-icon">◀</button>
                <button onClick={() => setSelectedDate(new Date())} className="cal-btn-today">วันนี้</button>
                <button onClick={() => setSelectedDate(new Date(year, month + 1, 1))} className="cal-btn-icon">▶</button>
              </div>
              <h2 className="cal-title">{monthNames[month]} {year + 543}</h2>
              <div className="cal-tabs">
                <button className={viewMode === 'month' ? 'active' : ''} onClick={() => setViewMode('month')}>รายเดือน</button>
                <button className={viewMode === 'day' ? 'active' : ''} onClick={() => setViewMode('day')}>รายวัน</button>
              </div>
            </div>

            {viewMode === 'month' && (
              <>
                <div className="cal-weekdays">
                  {dayNames.map((day) => <div key={day} className="cal-weekday">{day}</div>)}
                </div>
                <div className="cal-grid">
                  {calendar.map((date, index) => {
                    if (!date) return <div key={index} className="cal-cell empty" />
                    const isToday = date.toDateString() === new Date().toDateString()
                    const isSelected = date.toDateString() === selectedDate.toDateString()
                    const count = bookingCountsMap.get(date.getDate()) || 0

                    return (
                      <button key={index} className={`cal-cell ${isSelected ? 'is-selected' : ''} ${isToday ? 'is-today' : ''}`} onClick={() => { setSelectedDate(date); setViewMode('day') }}>
                        <span className="cal-num">{date.getDate()}</span>
                        {count > 0 && <span className="cal-badge">{count}</span>}
                      </button>
                    )
                  })}
                </div>
              </>
            )}

            {viewMode === 'day' && (
              <div className="cal-day-panel">
                <h3 className="cal-day-header">{selectedDate.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h3>
                {dayBookings.length === 0 ? (
                  <div className="cal-empty-state">
                    <p>✨ ไม่มีการจองในวันนี้</p>
                    <button className="secondary-button" onClick={() => navigate('/booking')}>จองห้องประชุม</button>
                  </div>
                ) : (
                  <div className="cal-event-list">
                    {dayBookings.map((b) => (
                      <div key={b.id} className={`cal-event-card border-left-${b.status}`}>
                        <div className="event-time-block">
                          <strong>{formatTime(b.start_time)}</strong>
                          <span>-</span>
                          <strong>{formatTime(b.end_time)}</strong>
                        </div>
                        <div className="event-details">
                          <h4>{b.title || b.purpose || 'ไม่ระบุหัวข้อ'}</h4>
                          <p>🏢 {b.rooms?.name || 'ไม่ระบุห้อง'}</p>
                          <p>👤 {b.users?.full_name || 'ไม่ระบุชื่อ'}</p>
                        </div>
                        <span className={`status ${b.status}`}>{getStatusText(b.status)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="cal-actions">
                  <button className="secondary-button" onClick={() => setViewMode('month')}>← กลับรายเดือน</button>
                </div>
              </div>
            )}

            <div className="cal-actions">
              <button className="secondary-button" onClick={() => navigate('/dashboard')}>กลับ Dashboard</button>
            </div>
          </>
        )}
      </section>
    </main>
  )
}

export default Calendar