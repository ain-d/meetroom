import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import rateLimit from 'express-rate-limit'
import { createClient } from '@supabase/supabase-js'

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

// ✅ จำกัดจำนวนคำขอต่อ IP เพื่อป้องกันการยิงถี่/สแปมใส่ endpoint ทั้งหมด
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 นาที
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'มีการเรียกใช้งานถี่เกินไป กรุณาลองใหม่ภายหลัง', error: 'RATE_LIMITED' },
})
app.use(generalLimiter)

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase URL or SUPABASE_SERVICE_ROLE_KEY in environment variables.')
  process.exit(1)
}

const supabaseAdmin = createClient(supabaseUrl, supabaseKey)

app.get('/esp32/room-status', async (req, res) => {
  const { data, error } = await supabaseAdmin.from('room_status').select('*').order('id')
  if (error) {
    return res.status(500).json({ success: false, message: 'Unable to retrieve room status.', error: error.message })
  }
  return res.json({ success: true, data })
})

app.get('/esp32/room-status/:roomId', async (req, res) => {
  const roomId = req.params.roomId?.trim()
  if (!roomId) {
    return res.status(400).json({ success: false, message: 'roomId is required', error: 'INVALID_ROOM_ID' })
  }

  const { data, error } = await supabaseAdmin
    .from('room_status')
    .select('*')
    .eq('room_id', roomId)
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') {
    return res.status(500).json({ success: false, message: 'Unable to retrieve room status.', error: error.message })
  }
  if (!data) {
    return res.status(404).json({ success: false, message: 'Room status not found for this room.', error: 'ROOM_STATUS_NOT_FOUND' })
  }

  return res.json({ success: true, data })
})

app.post('/esp32/checkin', async (req, res) => {
  const { booking_id, user_id, room_id, occupied = true } = req.body

  if (!room_id) {
    return res.status(400).json({ success: false, message: 'room_id is required', error: 'INVALID_ROOM_ID' })
  }

  if (!booking_id) {
    return res.status(400).json({ success: false, message: 'booking_id is required', error: 'INVALID_BOOKING_ID' })
  }

  const roomId = room_id.trim()
  const bookingId = booking_id.trim()
  const statusValue = occupied ? 'occupied' : 'available'

  const checkinPayload = {
    booking_id: bookingId,
    user_id: user_id || null,
    checked_in_at: new Date().toISOString(),
  }

  const { error: insertError } = await supabaseAdmin.from('checkins').insert(checkinPayload)
  if (insertError) {
    return res.status(500).json({ success: false, message: 'Unable to insert checkin.', error: insertError.message })
  }

  const statusResult = await supabaseAdmin
    .from('room_status')
    .update({ status: statusValue })
    .eq('room_id', roomId)
    .select('*')

  if (statusResult.error) {
    return res.status(500).json({ success: false, message: 'Unable to update room status.', error: statusResult.error.message })
  }

  if (!statusResult.data || statusResult.data.length === 0) {
    return res.status(404).json({ success: false, message: 'No room_status row found for this room_id', error: 'ROOM_STATUS_NOT_FOUND' })
  }

  return res.json({ success: true, room_id: roomId, booking_id: bookingId, occupied, status: statusValue, statusRecord: statusResult.data })
})

// ✅ /admin/setup ถูกลบออกแล้ว (ไม่เคยใช้งานได้จริงบน Vercel เพราะ server.js ไม่ได้ deploy อยู่ที่นั่น)
// ต่อไปนี้ตั้ง admin คนใหม่ผ่าน Supabase Dashboard -> Table Editor -> users -> แก้คอลัมน์ role เอง

const port = Number(process.env.PORT) || 4000
app.listen(port, () => {
  console.log(`ESP32 API server listening on port ${port}`)
})
