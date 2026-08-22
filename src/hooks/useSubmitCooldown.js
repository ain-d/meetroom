import { useRef, useCallback } from 'react'

// ✅ กันการกดส่งฟอร์มถี่เกินไป (basic client-side rate limit)
// cooldownMs = ระยะเวลาขั้นต่ำที่ต้องรอระหว่างการส่งแต่ละครั้ง
// หมายเหตุ: นี่คือการป้องกันขั้นต้นฝั่ง client เท่านั้น (รีเฟรชหน้าแล้วรีเซ็ตได้)
// ไม่ได้แทนที่การจำกัดอัตราฝั่งเซิร์ฟเวอร์/ฐานข้อมูล แต่ช่วยลดการส่งสแปมถี่ๆ ระหว่างใช้งานปกติ
export default function useSubmitCooldown(cooldownMs) {
  const lastSubmitRef = useRef(0)

  const checkCooldown = useCallback(() => {
    const now = Date.now()
    const elapsed = now - lastSubmitRef.current
    if (elapsed < cooldownMs) {
      const waitSec = Math.ceil((cooldownMs - elapsed) / 1000)
      return { ok: false, message: `กรุณารอ ${waitSec} วินาทีก่อนลองใหม่อีกครั้ง` }
    }
    lastSubmitRef.current = now
    return { ok: true, message: '' }
  }, [cooldownMs])

  return checkCooldown
}
