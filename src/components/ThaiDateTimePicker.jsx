import { useEffect, useRef, useState } from 'react'

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
]
const THAI_WEEKDAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']
const pad = (n) => String(n).padStart(2, '0')

const TIME_SLOTS = []
for (let h = 6; h <= 21; h++) {
  TIME_SLOTS.push(`${pad(h)}:00`)
  TIME_SLOTS.push(`${pad(h)}:30`)
}

const parseValue = (value) => (value && !isNaN(new Date(value).getTime()) ? new Date(value) : null)
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
const isSameDay = (a, b) =>
  a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

// value: string "YYYY-MM-DDTHH:mm" หรือ ''
// onChange: (newValue: string) => void
// minDate: Date — วันเวลาต่ำสุดที่เลือกได้
function ThaiDateTimePicker({ value, onChange, minDate }) {
  const min = minDate || new Date()
  const minDay = startOfDay(min)

  const [open, setOpen] = useState(false)

  // ✅ เก็บ "วันที่กำลังเลือกอยู่" และ "เวลาที่กำลังเลือกอยู่" แยกจากกัน เป็น state ของ component เอง
  //    ไม่พึ่ง value จาก parent ล้วนๆ เพราะระหว่างเลือกวันแต่ยังไม่เลือกเวลา (หรือกลับกัน)
  //    value ที่ parent เห็นจะยังเป็น '' อยู่ แต่ปฏิทินต้องยังจำสิ่งที่เลือกไปแล้วได้
  const initial = parseValue(value)
  const [pendingDay, setPendingDay] = useState(initial ? startOfDay(initial) : null)
  const [pendingTime, setPendingTime] = useState(initial ? `${pad(initial.getHours())}:${pad(initial.getMinutes())}` : null)
  const [viewMonth, setViewMonth] = useState(initial || minDate || new Date())

  const wrapperRef = useRef(null)

  // ปิดป๊อปอัพเมื่อคลิกข้างนอก
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // ✅ sync กลับจาก parent เฉพาะตอนที่ parent เคลียร์ค่าเป็น '' (เช่นหลัง submit สำเร็จ)
  useEffect(() => {
    if (!value) {
      setPendingDay(null)
      setPendingTime(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const year = viewMonth.getFullYear()
  const month = viewMonth.getMonth()
  const firstDayOfMonth = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startWeekday = firstDayOfMonth.getDay()

  const cells = []
  for (let i = 0; i < startWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const goPrevMonth = () => setViewMonth(new Date(year, month - 1, 1))
  const goNextMonth = () => setViewMonth(new Date(year, month + 1, 1))

  // แจ้ง parent เฉพาะตอนที่มีทั้งวันและเวลาครบ และเวลานั้นไม่ย้อนหลังกว่า min
  const tryEmit = (day, timeStr) => {
    if (!day || !timeStr) {
      onChange('') // ยังกรอกไม่ครบ parent ยังไม่ได้ค่าจริง แต่ปฏิทินยังจำ pendingDay/pendingTime เองอยู่
      return
    }
    const [h, mi] = timeStr.split(':').map(Number)
    const newDate = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, mi)
    if (newDate < min) {
      onChange('') // เวลานี้ย้อนหลังไปแล้ว ไม่ยอมส่งค่าจริง
      return
    }
    const str = `${newDate.getFullYear()}-${pad(newDate.getMonth() + 1)}-${pad(newDate.getDate())}T${pad(h)}:${pad(mi)}`
    onChange(str)
  }

  const pickDay = (day) => {
    const cellDate = startOfDay(new Date(year, month, day))
    if (cellDate < minDay) return // กันเลือกวันย้อนหลัง

    setPendingDay(cellDate)

    // ถ้าเวลาที่เคยเลือกไว้ ตอนนี้กลายเป็นย้อนหลังของวันใหม่ ให้เคลียร์เวลาทิ้ง บังคับเลือกใหม่
    if (pendingTime) {
      const [h, mi] = pendingTime.split(':').map(Number)
      const combined = new Date(cellDate.getFullYear(), cellDate.getMonth(), cellDate.getDate(), h, mi)
      if (combined < min) {
        setPendingTime(null)
        tryEmit(cellDate, null)
        return
      }
    }
    tryEmit(cellDate, pendingTime)
  }

  const pickTime = (timeStr) => {
    if (!pendingDay) return
    setPendingTime(timeStr)
    tryEmit(pendingDay, timeStr)
  }

  const isTimeDisabled = (timeStr) => {
    if (!pendingDay) return true
    const [h, mi] = timeStr.split(':').map(Number)
    const candidate = new Date(pendingDay.getFullYear(), pendingDay.getMonth(), pendingDay.getDate(), h, mi)
    return candidate < min
  }

  const displayText = pendingDay
    ? `${pendingDay.getDate()} ${THAI_MONTHS[pendingDay.getMonth()]} ${pendingDay.getFullYear() + 543}` +
      (pendingTime ? ` เวลา ${pendingTime} น.` : ' (ยังไม่เลือกเวลา)')
    : 'แตะเพื่อเลือกวันที่และเวลา'

  return (
    <div className="thai-datetime-picker" ref={wrapperRef}>
      <button type="button" className="thai-datetime-trigger" onClick={() => setOpen((prev) => !prev)}>
        📅 {displayText}
      </button>

      {open && (
        <div className="thai-datetime-popover">
          <div className="thai-calendar-header">
            <button type="button" onClick={goPrevMonth}>‹</button>
            <span>{THAI_MONTHS[month]} {year + 543}</span>
            <button type="button" onClick={goNextMonth}>›</button>
          </div>

          <div className="thai-calendar-weekdays">
            {THAI_WEEKDAYS.map((w) => <span key={w}>{w}</span>)}
          </div>

          <div className="thai-calendar-grid">
            {cells.map((day, index) => {
              if (day === null) return <span key={`empty-${index}`} className="thai-calendar-empty" />
              const cellDate = new Date(year, month, day)
              const disabled = startOfDay(cellDate) < minDay
              const isSelected = isSameDay(cellDate, pendingDay)
              return (
                <button
                  type="button"
                  key={day}
                  className={`thai-calendar-day ${isSelected ? 'is-selected' : ''} ${disabled ? 'is-disabled' : ''}`}
                  disabled={disabled}
                  onClick={() => pickDay(day)}
                >
                  {day}
                </button>
              )
            })}
          </div>

          <div className="thai-time-label">เลือกเวลา</div>
          <div className="thai-time-grid">
            {TIME_SLOTS.map((t) => {
              const disabled = isTimeDisabled(t)
              return (
                <button
                  type="button"
                  key={t}
                  className={`thai-time-chip ${pendingTime === t ? 'is-selected' : ''}`}
                  onClick={() => pickTime(t)}
                  disabled={disabled}
                >
                  {t}
                </button>
              )
            })}
          </div>
          {!pendingDay && <p className="thai-time-hint">กรุณาเลือกวันที่ก่อน</p>}
          {pendingDay && TIME_SLOTS.every(isTimeDisabled) && (
            <p className="thai-time-hint">ไม่มีเวลาว่างเหลือสำหรับวันนี้แล้ว กรุณาเลือกวันถัดไป</p>
          )}

          <button
            type="button"
            className="thai-datetime-done"
            onClick={() => setOpen(false)}
            disabled={!pendingDay || !pendingTime}
          >
            เสร็จสิ้น
          </button>
        </div>
      )}
    </div>
  )
}

export default ThaiDateTimePicker