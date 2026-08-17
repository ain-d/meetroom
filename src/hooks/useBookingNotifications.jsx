import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const POLL_INTERVAL_MS = 30000
const NEAR_BOOKING_MINUTES = 15
const SOUND_PREF_KEY = 'meetroom_notif_sound'

function createNotification(message, type = 'info') {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    message,
    type,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  }
}

// ✅ ใช้ AudioContext ตัวเดียวซ้ำไปเรื่อยๆ แทนการสร้างใหม่ทุกครั้งที่มีแจ้งเตือน
//    เดิมสร้าง AudioContext ใหม่ทุกครั้งที่ playBeep() ถูกเรียก แต่ไม่เคย close() เลย
//    ถ้าเปิดหน้าแอดมินค้างไว้นานๆ แล้วมีแจ้งเตือนถี่ๆ จำนวน context ที่ค้างอยู่จะ
//    เพิ่มขึ้นเรื่อยๆ จนชนขีดจำกัดของเบราว์เซอร์ แล้วเสียงแจ้งเตือนจะเงียบไปเองโดยไม่มีอะไรบอก
let sharedAudioCtx = null
function getAudioContext() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext
  if (!AudioCtx) return null
  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    sharedAudioCtx = new AudioCtx()
  }
  return sharedAudioCtx
}

// ✅ เล่นเสียง beep สั้นๆ ด้วย Web Audio API ไม่ต้องมีไฟล์เสียงแยก
function playBeep() {
  try {
    const ctx = getAudioContext()
    if (!ctx) return
    if (ctx.state === 'suspended') ctx.resume()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.3)
  } catch (e) {
    // บาง browser บล็อกเสียงก่อนมี user gesture — ข้ามไปเงียบๆ ไม่ต้อง error
  }
}

export default function useBookingNotifications() {
  const [notifications, setNotifications] = useState([])
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const saved = localStorage.getItem(SOUND_PREF_KEY)
    return saved === null ? true : saved === 'true'
  })

  const lastStatusRef = useRef(new Map())
  const upcomingAlertRef = useRef(new Set())
  const seenPendingRef = useRef(new Set())
  const isFirstLoadRef = useRef(true)
  const soundEnabledRef = useRef(soundEnabled)

  useEffect(() => { soundEnabledRef.current = soundEnabled }, [soundEnabled])

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev
      localStorage.setItem(SOUND_PREF_KEY, String(next))
      return next
    })
  }, [])

  useEffect(() => {
    let mounted = true
    let intervalId

    const loadNotifications = async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      const user = sessionData.session?.user
      if (!user) return

      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()
      const isAdmin = profile?.role === 'admin'

      const notificationsToAdd = []
      const now = new Date()

      // ---------- ส่วนของทุกคน: การจองของตัวเอง (สถานะเปลี่ยน / ใกล้ถึงเวลา) ----------
      const { data: myBookings, error: myError } = await supabase
        .from('bookings')
        .select('id, room_id, start_time, end_time, purpose, status, rooms(name), users!bookings_user_id_fkey(full_name)')
        .eq('user_id', user.id)
        .order('start_time', { ascending: true })

      if (!myError && myBookings && mounted) {
        myBookings.forEach((booking) => {
          const previousStatus = lastStatusRef.current.get(booking.id)
          const startTime = new Date(booking.start_time)
          const timeUntilStart = startTime - now
          const isNear = timeUntilStart > 0 && timeUntilStart <= NEAR_BOOKING_MINUTES * 60 * 1000
          const roomName = booking.rooms?.name || 'ห้องประชุม'

          if (previousStatus && previousStatus !== booking.status) {
            if (booking.status === 'approved') {
              notificationsToAdd.push(createNotification(`การจอง "${roomName}" ของคุณได้รับการอนุมัติแล้ว`, 'success'))
            } else if (booking.status === 'cancelled') {
              notificationsToAdd.push(createNotification(`การจอง "${roomName}" ของคุณถูกยกเลิก`, 'error'))
            } else if (booking.status === 'rejected') {
              notificationsToAdd.push(createNotification(`การจอง "${roomName}" ของคุณถูกปฏิเสธ`, 'error'))
            }
          }

          if (isNear && !upcomingAlertRef.current.has(booking.id) && booking.status !== 'cancelled') {
            notificationsToAdd.push(createNotification(`การจอง "${roomName}" ใกล้ถึงเวลาแล้ว (${startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`, 'info'))
            upcomingAlertRef.current.add(booking.id)
          }

          lastStatusRef.current.set(booking.id, booking.status)
        })
      }

      // ---------- ส่วนของ admin: คำขอจองใหม่ที่รออนุมัติ ----------
      if (isAdmin) {
        const { data: pendingBookings, error: pendingError } = await supabase
          .from('bookings')
          .select('id, room_id, rooms(name), users!bookings_user_id_fkey(full_name)')
          .eq('status', 'pending')

        if (!pendingError && pendingBookings && mounted) {
          pendingBookings.forEach((booking) => {
            if (!seenPendingRef.current.has(booking.id)) {
              // ตอนโหลดหน้าครั้งแรก ไม่แจ้งเตือนย้อนหลังทุกรายการที่มีอยู่แล้ว แค่จดจำไว้เฉยๆ
              if (!isFirstLoadRef.current) {
                const roomName = booking.rooms?.name || 'ห้องประชุม'
                const userName = booking.users?.full_name || 'ผู้ใช้งาน'
                notificationsToAdd.push(createNotification(`คำขอจองใหม่: "${roomName}" โดย ${userName} รออนุมัติ`, 'info'))
              }
              seenPendingRef.current.add(booking.id)
            }
          })
        }
      }

      isFirstLoadRef.current = false

      if (notificationsToAdd.length > 0 && mounted) {
        setNotifications((prev) => [...notificationsToAdd, ...prev].slice(0, 5))
        if (soundEnabledRef.current) playBeep()
      }
    }

    loadNotifications()
    intervalId = setInterval(loadNotifications, POLL_INTERVAL_MS)

    return () => {
      mounted = false
      clearInterval(intervalId)
    }
  }, [])

  const dismissNotification = (id) => {
    setNotifications((prev) => prev.filter((notification) => notification.id !== id))
  }

  return { notifications, dismissNotification, soundEnabled, toggleSound }
}