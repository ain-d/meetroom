import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const POLL_INTERVAL_MS = 30000
const NEAR_BOOKING_MINUTES = 15

function createNotification(message, type = 'info') {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    message,
    type,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  }
}

export default function useBookingNotifications() {
  const [notifications, setNotifications] = useState([])
  const lastStatusRef = useRef(new Map())
  const upcomingAlertRef = useRef(new Set())

  useEffect(() => {
    let mounted = true
    let intervalId

    const loadNotifications = async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      const user = sessionData.session?.user
      if (!user) return

      const { data, error } = await supabase
        .from('bookings')
        .select('id, room_id, start_time, end_time, purpose, status, rooms(name), users!bookings_user_id_fkey(full_name)')
        .eq('user_id', user.id)
        .order('start_time', { ascending: true })

      if (error || !mounted || !data) return

      const now = new Date()
      const notificationsToAdd = []

      data.forEach((booking) => {
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
          }
        }

        if (isNear && !upcomingAlertRef.current.has(booking.id) && booking.status !== 'cancelled') {
          notificationsToAdd.push(createNotification(`การจอง "${roomName}" ใกล้ถึงเวลาแล้ว (${startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`, 'info'))
          upcomingAlertRef.current.add(booking.id)
        }

        lastStatusRef.current.set(booking.id, booking.status)
      })

      if (notificationsToAdd.length > 0 && mounted) {
        setNotifications((prev) => [...notificationsToAdd, ...prev].slice(0, 5))
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

  return { notifications, dismissNotification }
}