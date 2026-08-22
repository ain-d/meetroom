-- ============================================================================
-- ป้องกันการจองห้องเดียวกันซ้อนเวลากันในระดับฐานข้อมูล (กันแม้กดจองพร้อมกันเป๊ะๆ)
--
-- ปัญหาที่พบ: การเช็คช่วงเวลาว่างปัจจุบันทำที่ฝั่งแอปเท่านั้น (Booking.jsx เช็คก่อน
-- ด้วย checkConflict แล้วค่อยเรียก RPC create_booking_with_number เพื่อ insert)
-- ถ้ามีผู้ใช้สองคนกดจองห้องเดียวกัน ช่วงเวลาเดียวกัน "พร้อมกันพอดี" ทั้งคู่อาจผ่าน
-- การเช็คก่อนแล้ว insert ซ้อนกันได้ (race condition) เพราะยังไม่มีตัวกันระดับฐานข้อมูล
--
-- ทางแก้: เพิ่ม EXCLUDE CONSTRAINT ที่ตาราง bookings — Postgres จะปฏิเสธการ INSERT/UPDATE
-- ที่ทำให้ห้องเดียวกันมีช่วงเวลาที่สถานะ pending/approved ทับซ้อนกันโดยอัตโนมัติ ระดับ
-- ฐานข้อมูล ไม่ว่าจะแทรกข้อมูลผ่านทางไหนก็ตาม (insert ตรงๆ หรือผ่านฟังก์ชัน RPC ใดๆ)
-- รับประกันแน่นอนกว่าการเช็คด้วยโค้ดฝั่งแอปเพียงอย่างเดียว
--
-- วิธีติดตั้ง: เปิด Supabase Dashboard -> SQL Editor -> วางไฟล์นี้ทั้งหมด -> Run
-- ทำครั้งเดียว (รันซ้ำได้ปลอดภัย)
--
-- ⚠️ ถ้ารันแล้วเจอ error ว่ามีข้อมูลที่ทับซ้อนกันอยู่แล้วในตาราง (จากบั๊กเดิมก่อนแก้)
-- ต้องเคลียร์/ปฏิเสธรายการที่ซ้อนกันให้เหลือรายการเดียวก่อน ถึงจะเพิ่ม constraint นี้ได้
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_no_overlap;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING gist (
    room_id WITH =,
    tstzrange(start_time, end_time) WITH &&
  )
  WHERE (status IN ('pending', 'approved'));
