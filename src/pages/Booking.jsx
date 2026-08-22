import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import ThaiDateTimePicker from '../components/ThaiDateTimePicker'
import RoomAvailabilityGrid from '../components/RoomAvailabilityGrid'

// แปลสถานะ
const getStatusLabel = (status) => {
  const map = { available: 'ว่าง', booked: 'จองแล้ว', occupied: 'ใช้งานอยู่', maintenance: 'ปิดปรับปรุง', out_of_service: 'ไม่ให้บริการ' }
  return map[status] || status
}

// ฟังก์ชันช่วยสำหรับห้ามจองย้อนหลัง (ใช้เป็นค่าเริ่มต้นให้ ThaiDateTimePicker เท่านั้น)
const getMinDateTime = () => {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 16)
}

function Booking() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const roomIdFromQR = searchParams.get('room')

  const [rooms, setRooms] = useState([])
  const [selectedRoom, setSelectedRoom] = useState(null)
  const [form, setForm] = useState({ title: '', start_time: '', end_time: '', attendees_count: '', purpose: '' })
  const [message, setMessage] = useState({ type: '', text: '' })
  const [loading, setLoading] = useState(false)

  // ✅ คำนวณครั้งเดียวตอน mount พอ
  const [minDateTime] = useState(getMinDateTime())

  useEffect(() => {
    let mounted = true
    const loadRooms = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { navigate('/login'); return }

      const { data, error } = await supabase
        .from('rooms')
        .select('id, name, capacity, min_capacity, image_url, is_active, facilities, room_status(status)')
        .eq('is_active', true)
        .order('name')

      if (!mounted) return
      if (error) {
        setMessage({ type: 'error', text: `โหลดข้อมูลห้องไม่สำเร็จ: ${error.message}` })
        setLoading(false)
        return
      }

      setRooms(data || [])

      if (roomIdFromQR) {
        const targetRoom = (data || []).find((r) => r.id === roomIdFromQR)
        if (targetRoom) {
          if (targetRoom.room_status?.status === 'available') {
            setSelectedRoom(targetRoom)
          } else {
            setMessage({ type: 'error', text: `ห้อง "${targetRoom.name}" ไม่พร้อมให้จองในขณะนี้ (${getStatusLabel(targetRoom.room_status?.status)})` })
          }
        } else {
          setMessage({ type: 'error', text: 'ไม่พบห้องประชุมนี้ในระบบ หรือห้องถูกปิดใช้งานแล้ว' })
        }
      }

      setLoading(false)
    }
    loadRooms()
    return () => { mounted = false }
  }, [navigate, roomIdFromQR])

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))

  // ✅ ใช้ RPC get_room_availability แทนการ query ตาราง bookings ตรงๆ
  //    เพราะ RLS ปัจจุบันให้ผู้ใช้ทั่วไปมองเห็นได้แค่การจองของ "ตัวเอง" เท่านั้น —
  //    query แบบเดิมจะมองไม่เห็นการจองของคนอื่นเลย ทำให้เช็ค conflict หลุดได้
  //    (ฟังก์ชันนี้ต้องรัน supabase_room_availability_function.sql ในโปรเจกต์ก่อนถึงจะใช้ได้)
  const checkConflict = async (roomId, startISO, endISO) => {
    const { data, error } = await supabase.rpc('get_room_availability', {
      p_room_id: roomId,
      p_range_start: startISO,
      p_range_end: endISO,
    })
    if (error) throw new Error(error.message)
    return (data || []).length > 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage({ type: '', text: '' })
    const { title, start_time, end_time, attendees_count, purpose } = form

    if (!title || !start_time || !end_time || !attendees_count) {
      setMessage({ type: 'error', text: 'กรุณากรอกข้อมูลให้ครบ' }); return
    }

    const attendeesNum = Number(attendees_count)
    const minCapacity = selectedRoom?.min_capacity ?? 1

    if (attendeesNum < minCapacity) {
      setMessage({ type: 'error', text: `ห้องนี้ต้องมีผู้เข้าร่วมอย่างน้อย ${minCapacity} คน` }); return
    }
    if (attendeesNum > selectedRoom?.capacity) {
      setMessage({ type: 'error', text: `ห้องนี้รองรับได้สูงสุด ${selectedRoom.capacity} คน` }); return
    }

    const startDate = new Date(start_time)
    const endDate = new Date(end_time)
    const startISO = startDate.toISOString()
    const endISO = endDate.toISOString()

    // ✅ เช็คเวลาย้อนหลังด้วยโค้ดเราเอง พร้อม buffer 1 นาที
    const now = new Date()
    if (startDate.getTime() < now.getTime() - 60000) {
      setMessage({ type: 'error', text: 'เวลาเริ่มต้นต้องไม่ย้อนหลังจากเวลาปัจจุบัน กรุณาเลือกเวลาใหม่' }); return
    }

    if (startISO >= endISO) {
      setMessage({ type: 'error', text: 'เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น' }); return
    }

    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { navigate('/login'); return }

      if (await checkConflict(selectedRoom.id, startISO, endISO)) {
        setMessage({ type: 'error', text: 'ช่วงเวลานี้มีการจองห้องซ้ำแล้ว' }); setLoading(false); return
      }

      const { data: newBooking, error } = await supabase.rpc('create_booking_with_number', {
        p_room_id: selectedRoom.id,
        p_user_id: user.id,
        p_title: title,
        p_purpose: purpose || null,
        p_attendees_count: attendeesNum,
        p_start_time: startISO,
        p_end_time: endISO
      })

      if (error) {
        // ✅ ห้องถูกจองซ้อนไปแล้วในเสี้ยววินาทีที่เผลอ (race condition) —
        // ฐานข้อมูลจะปฏิเสธด้วย exclusion constraint "bookings_no_overlap" (23P01)
        const isOverlap = error.code === '23P01' || error.message?.includes('bookings_no_overlap')
        setMessage({
          type: 'error',
          text: isOverlap ? 'ช่วงเวลานี้เพิ่งถูกผู้ใช้อื่นจองไปแล้ว กรุณาเลือกเวลาใหม่' : error.message,
        })
        setLoading(false)
        return
      }

      setMessage({
        type: 'success',
        text: `จองห้องประชุมสำเร็จ! เลขคิวของคุณคือ ${newBooking.booking_number}`
      })

      setForm({ title: '', start_time: '', end_time: '', attendees_count: '', purpose: '' })
      setSelectedRoom(null)
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    }
    setLoading(false)
  }

  const isOverCapacity = form.attendees_count && Number(form.attendees_count) > selectedRoom?.capacity
  const isUnderMinCapacity = form.attendees_count && Number(form.attendees_count) < (selectedRoom?.min_capacity ?? 1)

  // ================= หน้าจอ: เลือกห้อง (Gallery) =================
  if (!selectedRoom) {
    return (
      <main className="page-container">
        <section className="card">
          <div className="page-header">
            <h1>📅 จองห้องประชุม</h1>
            <p>เลือกห้องที่คุณต้องการจอง</p>
          </div>

          {message.text && <div className={`message ${message.type}`}>{message.text}</div>}

          {loading ? <p className="text-center">กำลังโหลดห้องประชุม...</p> : (
            <div className="room-gallery-grid">
              {rooms.map((room) => {
                const status = room.room_status?.status
                const isAvailable = status === 'available'

                return (
                  <div
                    key={room.id}
                    className={`room-gallery-card ${!isAvailable ? 'not-available' : ''}`}
                    onClick={() => isAvailable && setSelectedRoom(room)}
                  >
                    <img
                      src={room.image_url || 'https://via.placeholder.com/400x200?text=No+Image'}
                      alt={room.name}
                      className="room-card-img"
                    />
                    <div className="room-card-body">
                      <h3 className="room-card-name">{room.name}</h3>
                      <p className="room-card-capacity">👥 ความจุ {room.min_capacity ?? 1}-{room.capacity} คน</p>

                      {room.facilities && room.facilities.length > 0 && (
                        <div className="facilities-list">
                          {room.facilities.map((fac, index) => (
                            <span key={index} className="facility-badge">{fac}</span>
                          ))}
                        </div>
                      )}

                      <span className={`status ${status}`}>
                        {getStatusLabel(status)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </main>
    )
  }

  // ================= หน้าจอ: กรอกฟอร์มจอง =================
  return (
    <main className="page-container">
      <section className="card">
        <div className="page-header">
          <h1>📝 กรอกรายละเอียดการจอง</h1>
          <p>กรอกข้อมูลเพื่อยืนยันการจองห้อง</p>
        </div>

        <div className="selected-room-preview">
          <img src={selectedRoom.image_url || 'https://via.placeholder.com/150'} alt={selectedRoom.name} />
          <div className="selected-room-info">
            <h3>{selectedRoom.name}</h3>
            <p>ความจุ: {selectedRoom.min_capacity ?? 1}-{selectedRoom.capacity} คน</p>

            {selectedRoom.facilities && selectedRoom.facilities.length > 0 && (
              <div className="facilities-list">
                {selectedRoom.facilities.map((fac, index) => (
                  <span key={index} className="facility-badge">{fac}</span>
                ))}
              </div>
            )}

            <p>สถานะ: <span className={`status ${selectedRoom.room_status?.status}`}>{getStatusLabel(selectedRoom.room_status?.status)}</span></p>
          </div>
        </div>

        {message.text && <div className={`message ${message.type}`}>{message.text}</div>}

        <div className="form-section-label">🟢 ตารางความว่างของห้องนี้ — กดช่องเริ่มแล้วกดช่องสิ้นสุด เพื่อเติมเวลาให้อัตโนมัติ</div>
        <RoomAvailabilityGrid
          roomId={selectedRoom.id}
          selectedStartValue={form.start_time}
          selectedEndValue={form.end_time}
          minDateTime={new Date(minDateTime)}
          onRangeSelect={(startVal, endVal) => setForm((prev) => ({ ...prev, start_time: startVal, end_time: endVal }))}
        />

        <form className="register-form" onSubmit={handleSubmit} noValidate>
          <label>
            <span>หัวข้อการประชุม *</span>
            <input name="title" value={form.title} onChange={handleChange} placeholder="เช่น ประชุมทีม Dev" />
          </label>
          <label>
            <span>จำนวนผู้เข้าร่วม * (ระหว่าง {selectedRoom.min_capacity ?? 1}-{selectedRoom.capacity} คน)</span>
            <input
              type="number"
              name="attendees_count"
              value={form.attendees_count}
              onChange={handleChange}
              placeholder="จำนวนคน"
              className={(isOverCapacity || isUnderMinCapacity) ? 'input-error' : ''}
            />

            {isOverCapacity && (
              <p className="capacity-warning">
                ⚠️ จำนวนคนเกินความจุของห้อง (สูงสุด {selectedRoom.capacity} คน)
              </p>
            )}
            {isUnderMinCapacity && (
              <p className="capacity-warning">
                ⚠️ ห้องนี้ต้องมีผู้เข้าร่วมอย่างน้อย {selectedRoom.min_capacity ?? 1} คน
              </p>
            )}
          </label>
          <label>
            <span>เวลาเริ่มต้น *</span>
            <ThaiDateTimePicker
              value={form.start_time}
              onChange={(val) => setForm((prev) => ({ ...prev, start_time: val }))}
              minDate={new Date(minDateTime)}
            />
          </label>
          <label>
            <span>เวลาสิ้นสุด *</span>
            <ThaiDateTimePicker
              value={form.end_time}
              onChange={(val) => setForm((prev) => ({ ...prev, end_time: val }))}
              minDate={form.start_time ? new Date(form.start_time) : new Date(minDateTime)}
            />
          </label>
          <label>
            <span>วัตถุประสงค์ (ถ้ามี)</span>
            <input name="purpose" value={form.purpose} onChange={handleChange} placeholder="รายละเอียดเพิ่มเติม" />
          </label>

          <div className="form-actions">
            <button type="submit" disabled={loading}>{loading ? 'กำลังบันทึก...' : 'ยืนยันการจอง'}</button>
            <button type="button" className="secondary-button" onClick={() => {
              setSelectedRoom(null)
              setForm({ title: '', start_time: '', end_time: '', attendees_count: '', purpose: '' })
            }}>← กลับเลือกห้อง</button>
          </div>
        </form>
      </section>
    </main>
  )
}

export default Booking