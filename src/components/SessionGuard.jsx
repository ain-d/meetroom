import { useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// ✅ ระยะเวลาที่ไม่มีการใช้งานก่อนจะออกจากระบบอัตโนมัติ
const IDLE_TIMEOUT_MINUTES = 30
const IDLE_TIMEOUT_MS = IDLE_TIMEOUT_MINUTES * 60 * 1000
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll']

// หน้าที่ยังไม่ล็อกอิน ไม่ต้องเด้งซ้ำเวลา session ว่าง
const PUBLIC_PATHS = ['/login', '/register']

// ✅ ตัวเฝ้าระวังสถานะ session ทั้งระบบ — ใส่ไว้ครั้งเดียวใน App.jsx (นอก <Routes>)
// ทำ 2 อย่าง:
//  1) ฟัง onAuthStateChange — ถ้า session หายไประหว่างใช้งาน (token หมดอายุ/ถูกเพิกถอน)
//     จะเด้งกลับไปหน้า login ทันที แทนที่จะปล่อยให้ผู้ใช้ค้างอยู่ในหน้าที่ใช้งานไม่ได้แล้ว
//  2) จับความเคลื่อนไหวของผู้ใช้ (mouse/keyboard/touch/scroll) ถ้าไม่มีการใช้งานเลย
//     เกิน IDLE_TIMEOUT_MINUTES จะออกจากระบบอัตโนมัติ (auto logout)
function SessionGuard() {
  const navigate = useNavigate()
  const location = useLocation()
  const idleTimerRef = useRef(null)
  const locationRef = useRef(location)

  useEffect(() => {
    locationRef.current = location
  }, [location])

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session && !PUBLIC_PATHS.includes(locationRef.current.pathname)) {
        navigate('/login', { replace: true })
      }
    })
    return () => listener.subscription.unsubscribe()
  }, [navigate])

  useEffect(() => {
    const resetTimer = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      idleTimerRef.current = setTimeout(async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          await supabase.auth.signOut()
          navigate('/login', { replace: true })
        }
      }, IDLE_TIMEOUT_MS)
    }

    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, resetTimer, { passive: true }))
    resetTimer()

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, resetTimer))
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    }
  }, [navigate])

  return null
}

export default SessionGuard
