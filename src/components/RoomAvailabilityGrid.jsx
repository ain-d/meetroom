import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import './RoomAvailabilityGrid.css'

// ตารางความว่างของ "ห้องเดียว" ในวันเดียว แบ่งเป็นช่องละ 30 นาที
// ตั้งแต่ 06:00 ถึง 21:30 (ตรงกับช่วงเวลาที่ ThaiDateTimePicker เปิดให้เลือกอยู่แล้ว)
//
// - เขียว  = ว่าง กดเลือกได้
// - ส้ม    = มีคนขอจองไว้ แต่ยังรออนุมัติ (pending)
// - แดง    = จองและอนุมัติแล้ว (approved)
// - เทา    = เวลาที่ผ่านไปแล้วของวันนี้ กดไม่ได้
//
// วิธีเลือก: กดช่องแรก = เวลาเริ่ม, กดช่องถัดไป (หลังช่องแรก) = เวลาสิ้นสุด
// ถ้าช่วงที่เลือกมีช่องที่ไม่ว่างอยู่ระหว่างกลาง จะไม่ยอมให้เลือก พร้อมแจ้งเตือน
//
// props:
//   roomId            — id ห้องที่กำลังเลือกอยู่
//   selectedStartValue — form.start_time ปัจจุบัน ("YYYY-MM-DDTHH:mm" หรือ '')
//   selectedEndValue    — form.end_time ปัจจุบัน ("YYYY-MM-DDTHH:mm" หรือ '')
//   minDateTime        — Date ที่เร็วที่สุดที่จองได้ (เดียวกับที่ Booking.jsx ใช้)
//   onRangeSelect(startStr, endStr) — เรียกตอนเลือกช่วงเวลาสำเร็จ (format เดียวกับ value ด้านบน)

const START_HOUR = 6
const END_HOUR = 21 // ช่องสุดท้ายเริ่มที่ 21:30 (จบ 22:00)
const SLOT_MINUTES = 30
const POLL_MS = 30000

const pad = (n) => String(n).padStart(2, '0')

const toLocalInputString = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`

const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const isSameDay = (a, b) =>
  a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

const parseLocal = (str) => (str && !isNaN(new Date(str).getTime()) ? new Date(str) : null)

function buildSlots(day) {
  const slots = []
  for (let h = START_HOUR; h <= END_HOUR; h++) {
    for (const m of [0, 30]) {
      const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m)
      const end = new Date(start.getTime() + SLOT_MINUTES * 60000)
      slots.push({ start, end })
    }
  }
  return slots
}

function RoomAvailabilityGrid({ roomId, selectedStartValue, selectedEndValue, minDateTime, onRangeSelect }) {
  const min = minDateTime || new Date()
  const minDay = startOfDay(min)

  const [selectedDate, setSelectedDate] = useState(startOfDay(new Date()))
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pendingStart, setPendingStart] = useState(null)
  const [warning, setWarning] = useState('')

  const slots = useMemo(() => buildSlots(selectedDate), [selectedDate])

  useEffect(() => {
    if (!roomId) return
    let mounted = true

    const load = async () => {
      setError('')
      const rangeStart = startOfDay(selectedDate)
      const rangeEnd = addDays(rangeStart, 1)
      const { data, error: rpcError } = await supabase.rpc('get_room_availability', {
        p_room_id: roomId,
        p_range_start: rangeStart.toISOString(),
        p_range_end: rangeEnd.toISOString(),
      })
      if (!mounted) return
      if (rpcError) {
        setError('โหลดตารางความว่างของห้องไม่สำเร็จ: ' + rpcError.message)
        setBookings([])
      } else {
        setBookings((data || []).map((b) => ({ start: new Date(b.start_time), end: new Date(b.end_time), status: b.status })))
      }
      setLoading(false)
    }

    setLoading(true)
    load()
    const interval = setInterval(load, POLL_MS)
    return () => { mounted = false; clearInterval(interval) }
  }, [roomId, selectedDate])

  // ล้างการเลือกค้างไว้ถ้าเปลี่ยนห้องหรือเปลี่ยนวัน
  useEffect(() => { setPendingStart(null); setWarning('') }, [roomId, selectedDate])

  const getSlotColor = (slot) => {
    if (slot.start < min) return 'past'
    const approved = bookings.some((b) => b.status === 'approved' && b.start < slot.end && b.end > slot.start)
    if (approved) return 'red'
    const pending = bookings.some((b) => b.status === 'pending' && b.start < slot.end && b.end > slot.start)
    if (pending) return 'orange'
    return 'green'
  }

  const selectedStart = parseLocal(selectedStartValue)
  const selectedEnd = parseLocal(selectedEndValue)
  const isInConfirmedRange = (slot) =>
    selectedStart && selectedEnd && slot.start >= selectedStart && slot.start < selectedEnd

  const handleSlotClick = (slot) => {
    const color = getSlotColor(slot)
    setWarning('')

    if (!pendingStart) {
      if (color !== 'green') return
      setPendingStart(slot.start)
      return
    }

    // กดช่องเดิมซ้ำ = ยกเลิกการเลือก
    if (slot.start.getTime() === pendingStart.getTime()) {
      setPendingStart(null)
      return
    }

    // กดช่องที่เวลาก่อนหน้าช่องเริ่มเดิม = เริ่มเลือกใหม่จากช่องนี้แทน
    if (slot.start < pendingStart) {
      if (color !== 'green') return
      setPendingStart(slot.start)
      return
    }

    // กดช่องหลังช่องเริ่ม = พยายามปิดช่วงเป็นเวลาสิ้นสุด
    const rangeSlots = slots.filter((s) => s.start >= pendingStart && s.start <= slot.start)
    const allFree = rangeSlots.every((s) => getSlotColor(s) === 'green')
    if (!allFree) {
      setWarning('ช่วงเวลาที่เลือกมีบางส่วนไม่ว่าง กรุณาเลือกใหม่')
      setPendingStart(null)
      return
    }

    onRangeSelect(toLocalInputString(pendingStart), toLocalInputString(slot.end))
    setPendingStart(null)
  }

  const goPrevDay = () => {
    const prev = addDays(selectedDate, -1)
    if (startOfDay(prev) < minDay) return
    setSelectedDate(startOfDay(prev))
  }
  const goNextDay = () => setSelectedDate(startOfDay(addDays(selectedDate, 1)))
  const goToday = () => setSelectedDate(startOfDay(new Date()))

  const dayLabel = selectedDate.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  if (!roomId) return null

  return (
    <div className="room-availability">
      <div className="room-availability-toolbar">
        <button
          type="button"
          className="avail-nav-btn"
          onClick={goPrevDay}
          disabled={startOfDay(addDays(selectedDate, -1)) < minDay}
        >
          ◀
        </button>
        <div className="avail-day-label">
          {dayLabel}
          {!isSameDay(selectedDate, new Date()) && (
            <button type="button" className="avail-today-btn" onClick={goToday}>กลับวันนี้</button>
          )}
        </div>
        <button type="button" className="avail-nav-btn" onClick={goNextDay}>▶</button>
      </div>

      {loading && <p className="avail-hint">กำลังโหลดตารางความว่าง...</p>}
      {!loading && error && <p className="avail-hint avail-error">{error}</p>}

      {!loading && !error && (
        <>
          <div className="avail-grid">
            {slots.map((slot) => {
              const color = getSlotColor(slot)
              const isPendingStart = pendingStart && slot.start.getTime() === pendingStart.getTime()
              const inConfirmedRange = isInConfirmedRange(slot)
              return (
                <button
                  type="button"
                  key={slot.start.toISOString()}
                  className={`avail-slot avail-${color} ${isPendingStart ? 'is-pending-start' : ''} ${inConfirmedRange ? 'is-in-range' : ''}`}
                  onClick={() => handleSlotClick(slot)}
                  disabled={color === 'past'}
                  title={`${pad(slot.start.getHours())}:${pad(slot.start.getMinutes())}`}
                >
                  {pad(slot.start.getHours())}:{pad(slot.start.getMinutes())}
                </button>
              )
            })}
          </div>

          <div className="avail-legend">
            <span><i className="avail-dot avail-green" /> ว่าง</span>
            <span><i className="avail-dot avail-orange" /> รออนุมัติ</span>
            <span><i className="avail-dot avail-red" /> จองแล้ว</span>
            <span><i className="avail-dot avail-past" /> เวลาผ่านไปแล้ว</span>
          </div>

          {pendingStart && (
            <p className="avail-hint">
              เลือกเวลาเริ่ม {pad(pendingStart.getHours())}:{pad(pendingStart.getMinutes())} แล้ว — กดช่องที่ต้องการให้เป็นเวลาสิ้นสุด
            </p>
          )}
          {warning && <p className="avail-hint avail-error">{warning}</p>}
        </>
      )}
    </div>
  )
}

export default RoomAvailabilityGrid
