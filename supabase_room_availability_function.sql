-- ============================================================================
-- get_room_availability
--
-- ปัญหาที่แก้: นโยบาย RLS ปัจจุบันของตาราง bookings (ดู supabase_rls_policies.sql)
-- อนุญาตให้ผู้ใช้ทั่วไปมองเห็น "การจองของตัวเองเท่านั้น" (ผู้ดูแลระบบเห็นได้ทั้งหมด)
-- ซึ่งถูกต้องสำหรับการปกป้องความเป็นส่วนตัว แต่ทำให้หน้าจองห้องไม่สามารถแสดง
-- ตารางว่าง/ไม่ว่างของห้อง (ที่ต้องรู้ว่าห้องมีคน "อื่น" จองไว้หรือไม่) ได้ตรงๆ
--
-- ทางแก้: สร้างฟังก์ชันนี้ให้ทำงานแบบ SECURITY DEFINER (มีสิทธิ์อ่านข้ามผู้ใช้ได้
-- เฉพาะภายในฟังก์ชันนี้เท่านั้น) แต่ "คืนค่าแค่ช่วงเวลา + สถานะ" ของการจองเท่านั้น
-- ไม่คืนหัวข้อประชุม วัตถุประสงค์ จำนวนผู้เข้าร่วม หรือว่าใครเป็นคนจอง
-- ผู้ใช้ทั่วไปจึงเห็นได้แค่ "ช่วงนี้ว่าง/ไม่ว่าง" โดยไม่เห็นรายละเอียดของคนอื่น
--
-- วิธีติดตั้ง: เปิด Supabase Dashboard -> SQL Editor -> วางไฟล์นี้ทั้งหมด -> Run
-- ทำครั้งเดียว (รันซ้ำได้ปลอดภัย เพราะใช้ CREATE OR REPLACE)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_room_availability(
  p_room_id uuid,
  p_range_start timestamptz,
  p_range_end timestamptz
)
RETURNS TABLE (
  start_time timestamptz,
  end_time timestamptz,
  status text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT b.start_time, b.end_time, b.status
  FROM public.bookings b
  WHERE b.room_id = p_room_id
    AND b.status IN ('pending', 'approved')
    AND b.start_time < p_range_end
    AND b.end_time > p_range_start
  ORDER BY b.start_time;
$$;

-- ล้างสิทธิ์เริ่มต้น แล้วเปิดให้เฉพาะผู้ใช้ที่ล็อกอินแล้ว (authenticated) เรียกใช้ได้
-- (ไม่ได้เปิดสิทธิ์อ่านตาราง bookings ตรงๆ แค่เปิดให้เรียกฟังก์ชันนี้เท่านั้น)
REVOKE ALL ON FUNCTION public.get_room_availability(uuid, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_room_availability(uuid, timestamptz, timestamptz) TO authenticated;
