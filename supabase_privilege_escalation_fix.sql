-- ============================================================================
-- ป้องกัน privilege escalation ผ่าน API โดยตรง (bypass RLS ระดับคอลัมน์)
--
-- ปัญหาที่พบ: RLS ปัจจุบัน (supabase_rls_policies.sql) อนุญาตให้ผู้ใช้แก้ไข
-- "แถวของตัวเอง" ได้ทุกคอลัมน์ ไม่ได้จำกัดว่าห้ามแก้คอลัมน์ไหน:
--   - ตาราง users: policy "Users can manage own profile" ทำให้ผู้ใช้ทั่วไปยิง API
--     เปลี่ยน role ของตัวเองเป็น admin ได้เองตรงๆ โดยไม่ต้องผ่านหน้า Admin Setup
--     เช่น supabase.from('users').update({role:'admin'}).eq('id', ตัวเอง)
--   - ตาราง bookings: policy "Owners or admins can update bookings" ทำให้เจ้าของ
--     การจองยิง API เปลี่ยน status การจองของตัวเองเป็น approved/rejected เองได้เลย
--     โดยไม่ต้องรอแอดมินกดอนุมัติ
--
-- ทางแก้: RLS อย่างเดียวเช็คได้แค่ "แถวไหนแก้ได้" ไม่สามารถเช็ค "คอลัมน์ไหนห้ามเปลี่ยน"
-- ได้ (WITH CHECK ไม่มีค่าเก่าให้เทียบ) จึงต้องใช้ BEFORE UPDATE trigger เพื่อเทียบ
-- ค่าเก่ากับค่าใหม่ แล้วปฏิเสธถ้าคนที่แก้ไม่ใช่ admin แต่พยายามเปลี่ยนคอลัมน์สงวน
--
-- สิ่งที่ยังทำได้ตามปกติหลังติดตั้ง (ไม่กระทบการใช้งานเดิม):
--   - ผู้ใช้ยกเลิกการจองของตัวเอง (status -> cancelled) ยังทำได้ (BookingHistory.jsx)
--   - ผู้ใช้เช็คอินการจองของตัวเอง (status -> checked_in) ยังทำได้ (BookingHistory.jsx)
--   - แอดมินอนุมัติ/ปฏิเสธการจอง และเปลี่ยน role ผู้ใช้ ยังทำได้ตามปกติ (BookingAdmin.jsx / UsersAdmin.jsx)
--
-- วิธีติดตั้ง: เปิด Supabase Dashboard -> SQL Editor -> วางไฟล์นี้ทั้งหมด -> Run
-- ทำครั้งเดียว (รันซ้ำได้ปลอดภัย เพราะใช้ CREATE OR REPLACE / DROP TRIGGER IF EXISTS)
-- ============================================================================

-- ---------- users.role: ห้ามผู้ใช้ทั่วไปเปลี่ยน role ของตัวเอง ----------
CREATE OR REPLACE FUNCTION public.prevent_self_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'
    ) THEN
      RAISE EXCEPTION 'Only admins can change user role';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_self_role_change ON public.users;
CREATE TRIGGER trg_prevent_self_role_change
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_self_role_change();

-- ---------- bookings.status / approved_by / approved_at: ห้ามเจ้าของการจองอนุมัติเอง ----------
CREATE OR REPLACE FUNCTION public.prevent_self_booking_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  acting_is_admin boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin'
  ) INTO acting_is_admin;

  IF NOT acting_is_admin THEN
    IF NEW.status IN ('approved', 'rejected') AND NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Only admins can approve or reject bookings';
    END IF;
    IF NEW.approved_by IS DISTINCT FROM OLD.approved_by
       OR NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN
      RAISE EXCEPTION 'Only admins can set booking approval fields';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_self_booking_approval ON public.bookings;
CREATE TRIGGER trg_prevent_self_booking_approval
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_self_booking_approval();
