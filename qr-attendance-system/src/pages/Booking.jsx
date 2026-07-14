import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// แปลสถานะ
const getStatusLabel = (status) => {
  const map = { available: 'ว่าง', booked: 'จองแล้ว', occupied: 'ใช้งานอยู่', maintenance: 'ปิดปรับปรุง', out_of_service: 'ไม่ให้บริการ' }
  return map[status] || status
}

// ฟังก์ชันช่วยสำหรับห้ามจองย้อนหลัง
const getMinDateTime = () => {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 16)
}

function Booking() {
  const navigate = useNavigate()
  const [rooms, setRooms] = useState([])
  const [selectedRoom, setSelectedRoom] = useState(null)
  const [form, setForm] = useState({ title: '', start_time: '', end_time: '', attendees_count: '', purpose: '' })
  const [message, setMessage] = useState({ type: '', text: '' })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let mounted = true
    const loadRooms = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { navigate('/login'); return }

      const { data, error } = await supabase
        .from('rooms')
        .select('id, name, capacity, image_url, is_active, facilities, room_status(status)')
        .eq('is_active', true)
        .order('name')

      if (!mounted) return
      if (error) setMessage({ type: 'error', text: `โหลดข้อมูลห้องไม่สำเร็จ: ${error.message}` })
      else setRooms(data || [])
      setLoading(false)
    }
    loadRooms()
    return () => { mounted = false }
  }, [navigate])

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))

  const checkConflict = async (roomId, startISO, endISO) => {
    const { data, error } = await supabase.from('bookings').select('id').eq('room_id', roomId).eq('status', 'approved').lt('start_time', endISO).gt('end_time', startISO).limit(1)
    if (error) throw new Error(error.message)
    return data?.length > 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage({ type: '', text: '' })
    const { title, start_time, end_time, attendees_count, purpose } = form
    
    if (!title || !start_time || !end_time || !attendees_count) {
      setMessage({ type: 'error', text: 'กรุณากรอกข้อมูลให้ครบ' }); return
    }

    const startISO = new Date(start_time).toISOString()
    const endISO = new Date(end_time).toISOString()
    if (startISO >= endISO) { setMessage({ type: 'error', text: 'เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น' }); return }

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
        p_attendees_count: Number(attendees_count), 
        p_start_time: startISO, 
        p_end_time: endISO
      })

      if (error) { setMessage({ type: 'error', text: error.message }); setLoading(false); return }
      
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

  // ตัวแปรเช็คจำนวนคนเกินความจุ (เอาไว้ใส่ Class)
  const isOverCapacity = form.attendees_count && Number(form.attendees_count) > selectedRoom?.capacity

  // ================= หน้าจอ: เลือกห้อง (Gallery) =================
  if (!selectedRoom) {
    return (
      <main className="page-container">
        <section className="card">
          <div className="page-header">
            <h1>📅 จองห้องประชุม</h1>
            <p>เลือกห้องที่คุณต้องการจอง</p>
          </div>

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
                      <p className="room-card-capacity">👥 ความจุสูงสุด {room.capacity} คน</p>
                      
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

        {/* พรีวิวห้องที่เลือก */}
        <div className="selected-room-preview">
          <img src={selectedRoom.image_url || 'https://via.placeholder.com/150'} alt={selectedRoom.name} />
          <div className="selected-room-info">
            <h3>{selectedRoom.name}</h3>
            <p>ความจุ: {selectedRoom.capacity} คน</p>
            
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

        <form className="register-form" onSubmit={handleSubmit}>
          <label>
            <span>หัวข้อการประชุม *</span>
            <input name="title" value={form.title} onChange={handleChange} placeholder="เช่น ประชุมทีม Dev" required />
          </label>
          <label>
            <span>จำนวนผู้เข้าร่วม *</span>
            <input 
              type="number" 
              name="attendees_count" 
              value={form.attendees_count} 
              onChange={handleChange} 
              placeholder="จำนวนคน" 
              min="1" 
              required 
              className={isOverCapacity ? 'input-error' : ''}
            />
            
            {isOverCapacity && (
              <p className="capacity-warning">
                ⚠️ จำนวนคนเกินความจุของห้อง (สูงสุด {selectedRoom.capacity} คน)
              </p>
            )}
          </label>
          <label>
            <span>เวลาเริ่มต้น *</span>
            <input 
              type="datetime-local" 
              name="start_time" 
              value={form.start_time} 
              onChange={handleChange} 
              required 
              min={getMinDateTime()}
            />
          </label>
          <label>
            <span>เวลาสิ้นสุด *</span>
            <input 
              type="datetime-local" 
              name="end_time" 
              value={form.end_time} 
              onChange={handleChange} 
              required 
              min={form.start_time || getMinDateTime()}
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