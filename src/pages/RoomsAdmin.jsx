import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import RoomQRModal from '../components/RoomQRModal'

const STATUS_OPTIONS = [
  { value: 'available', label: 'ว่าง' }, { value: 'booked', label: 'จองแล้ว' },
  { value: 'occupied', label: 'ใช้งานอยู่' }, { value: 'maintenance', label: 'ปิดปรับปรุง' },
  { value: 'out_of_service', label: 'ไม่ให้บริการ' },
]

// ✅ จำกัดชนิดและขนาดไฟล์รูปห้อง (เดิมมีแค่ accept="image/*" ที่ฝั่ง UI ซึ่งข้ามได้ง่าย)
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_IMAGE_SIZE = 5 * 1024 * 1024 // 5MB

function RoomsAdmin() {
  const navigate = useNavigate()
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [form, setForm] = useState({ name: '', minCapacity: '', capacity: '', status: '', prefix: '' })
  const [editingRoom, setEditingRoom] = useState(null)
  const [imageFile, setImageFile] = useState(null)
  const [facilities, setFacilities] = useState([])
  const [facilityInput, setFacilityInput] = useState('')
  const [qrRoom, setQrRoom] = useState(null) // ✅ ห้องที่กำลังแสดง QR

  const refreshRooms = async () => {
    try {
      const { data, error } = await supabase.from('rooms').select('id, name, prefix, min_capacity, capacity, is_active, image_url, facilities, room_status(status)').eq('is_active', true).order('name')
      if (error) { setMessage({ type: 'error', text: `โหลดข้อมูลห้องไม่สำเร็จ: ${error.message}` }); return; }
      setRooms(data || [])
    } catch (err) {
      setMessage({ type: 'error', text: 'การเชื่อมต่อฐานข้อมูลขาดช่วงครู่ กรุณาลองใหม่อีกครั้ง' })
    }
  }

  useEffect(() => {
    let mounted = true
    const loadData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { navigate('/login'); return }
        const { data: profileData } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
        if (!mounted) return
        if (profileData?.role !== 'admin') { navigate('/dashboard'); return }
        await refreshRooms()
        setLoading(false)
      } catch (err) {
        if (mounted) { setMessage({ type: 'error', text: 'เกิดข้อผิดพลาดในการเชื่อมต่อระบบ' }); setLoading(false) }
      }
    }
    loadData()
    return () => { mounted = false }
  }, [navigate])

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  const handleImageChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) { setImageFile(null); return }
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setMessage({ type: 'error', text: 'รองรับเฉพาะไฟล์รูปภาพ JPG, PNG หรือ WEBP เท่านั้น' })
      e.target.value = ''
      setImageFile(null)
      return
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setMessage({ type: 'error', text: 'ขนาดไฟล์รูปภาพต้องไม่เกิน 5MB' })
      e.target.value = ''
      setImageFile(null)
      return
    }
    setMessage({ type: '', text: '' })
    setImageFile(file)
  }
  const handleAddFacility = () => { if (!facilityInput.trim()) return; if (facilities.includes(facilityInput.trim())) return; setFacilities([...facilities, facilityInput.trim()]); setFacilityInput(''); setMessage({ type: '', text: '' }) }
  const handleRemoveFacility = (indexToRemove) => setFacilities(facilities.filter((_, index) => index !== indexToRemove))

  const handleSubmit = async (e) => {
    e.preventDefault(); setMessage({ type: '', text: '' })
    if (!form.name || !form.minCapacity || !form.capacity || !form.status) { setMessage({ type: 'error', text: 'กรุณากรอกข้อมูลหลักให้ครบ' }); return }

    const minCapacityNum = Number(form.minCapacity)
    const maxCapacityNum = Number(form.capacity)

    if (!Number.isInteger(minCapacityNum) || minCapacityNum < 1) {
      setMessage({ type: 'error', text: 'ความจุขั้นต่ำต้องเป็นจำนวนเต็มตั้งแต่ 1 คนขึ้นไป' })
      return
    }
    if (!Number.isInteger(maxCapacityNum) || maxCapacityNum < 1) {
      setMessage({ type: 'error', text: 'ความจุสูงสุดต้องเป็นจำนวนเต็มตั้งแต่ 1 คนขึ้นไป' })
      return
    }
    if (minCapacityNum > maxCapacityNum) {
      setMessage({ type: 'error', text: 'ความจุขั้นต่ำต้องไม่มากกว่าความจุสูงสุด' })
      return
    }

    setLoading(true)
    try {
      let imageUrl = editingRoom?.image_url || null
      if (imageFile) {
        const fileName = `${Date.now()}-${imageFile.name}`
        const { error: uploadError, data: uploadData } = await supabase.storage.from('room-images').upload(fileName, imageFile)
        if (uploadError) { setMessage({ type: 'error', text: `อัปโหลดรูปไม่สำเร็จ: ${uploadError.message}` }); return }
        imageUrl = supabase.storage.from('room-images').getPublicUrl(uploadData.path).data.publicUrl
      }
      const roomPayload = { name: form.name, min_capacity: minCapacityNum, capacity: maxCapacityNum, is_active: true, image_url: imageUrl, facilities: facilities, prefix: form.prefix.toUpperCase().trim() || 'BK' }
      const userId = (await supabase.auth.getUser()).data.user.id

      if (editingRoom) {
        const { error: roomError } = await supabase.from('rooms').update(roomPayload).eq('id', editingRoom.id)
        if (roomError) { setMessage({ type: 'error', text: roomError.message }); return }

        const { error: statusError } = await supabase
          .from('room_status')
          .upsert({ room_id: editingRoom.id, status: form.status, updated_by: userId }, { onConflict: 'room_id' })
        if (statusError) {
          setMessage({ type: 'error', text: `บันทึกสถานะห้องไม่สำเร็จ: ${statusError.message}` })
          return
        }
        setMessage({ type: 'success', text: 'แก้ไขห้องเรียบร้อย' })
      } else {
        const { data: newRoom, error: roomError } = await supabase.from('rooms').insert(roomPayload).select('id').single()
        if (roomError) { setMessage({ type: 'error', text: roomError.message }); return }

        const { error: statusError } = await supabase
          .from('room_status')
          .insert({ room_id: newRoom.id, status: form.status, updated_by: userId })
        if (statusError) {
          setMessage({ type: 'error', text: `สร้างสถานะห้องไม่สำเร็จ: ${statusError.message}` })
          return
        }
        setMessage({ type: 'success', text: 'สร้างห้องใหม่เรียบร้อย' })
      }

      setForm({ name: '', minCapacity: '', capacity: '', status: '', prefix: '' })
      setEditingRoom(null)
      setImageFile(null)
      setFacilities([])
      await refreshRooms()
    } catch (error) {
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่' })
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (room) => { setEditingRoom(room); setForm({ name: room.name, minCapacity: (room.min_capacity ?? 1).toString(), capacity: room.capacity.toString(), status: room.room_status?.status || '', prefix: room.prefix || '' }); setFacilities(room.facilities || []); setMessage({ type: '', text: '' }) }
  const handleDelete = async (room) => { if (!window.confirm(`ต้องการปิดการใช้งานห้อง "${room.name}" หรือไม่?`)) return; try { await supabase.from('rooms').update({ is_active: false }).eq('id', room.id); await supabase.from('room_status').update({ status: 'out_of_service' }).eq('room_id', room.id); setMessage({ type: 'success', text: 'ปิดการใช้งานห้องเรียบร้อย' }); await refreshRooms() } catch (error) { setMessage({ type: 'error', text: 'เกิดข้อผิดพลาด: ' + error.message }) } }
  const handleCancelEdit = () => { setEditingRoom(null); setImageFile(null); setForm({ name: '', minCapacity: '', capacity: '', status: '', prefix: '' }); setFacilities([]); setMessage({ type: '', text: '' }) }
  const getStatusLabel = (statusValue) => { const found = STATUS_OPTIONS.find((opt) => opt.value === statusValue); return found ? found.label : statusValue || 'ไม่ระบุ' }

  return (
    <main className="page-container">
      <section className="card">
        <div className="page-header">
          <div>
            
            <h1>🏢 จัดการห้องประชุม</h1>
            <p>เพิ่ม แก้ไข หรือปิดการใช้งานห้องประชุม</p>
          </div>
        </div>
        {message.text && <div className={`message ${message.type}`}>{message.text}</div>}
        <form className="register-form" onSubmit={handleSubmit}>
          <label><span>ชื่อห้อง</span><input name="name" value={form.name} onChange={handleChange} placeholder="เช่น ห้องประชุม A" /></label>
          <label><span>รหัสห้อง (Prefix เช่น MT, MX)</span><input name="prefix" value={form.prefix} onChange={handleChange} placeholder="เช่น MT" maxLength="5" className="text-uppercase" /></label>
          <label>
            <span>ความจุขั้นต่ำ (จองได้ต้องมีคนอย่างน้อยเท่านี้)</span>
            <input type="number" name="minCapacity" value={form.minCapacity} onChange={handleChange} placeholder="เช่น 2" min="1" />
          </label>
          <label>
            <span>ความจุสูงสุด (จำนวนคนที่ห้องรับได้)</span>
            <input type="number" name="capacity" value={form.capacity} onChange={handleChange} placeholder="เช่น 10" min="1" />
          </label>
          <label><span>สถานะ</span><select name="status" value={form.status} onChange={handleChange}><option value="">เลือกสถานะ</option>{STATUS_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></label>
          <label><span>รูปห้อง (ถ้ามี)</span><input type="file" accept="image/*" onChange={handleImageChange} /></label>
          <label className="full-width"><span>อุปกรณ์ภายในห้อง</span><div className="facility-input-group"><input type="text" value={facilityInput} onChange={(e) => setFacilityInput(e.target.value)} placeholder="เช่น Projector, Whiteboard" onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddFacility())} /><button type="button" className="btn-add-facility" onClick={handleAddFacility}>+</button></div>{facilities.length > 0 && (<div className="facility-tag-list">{facilities.map((fac, index) => (<span key={index} className="facility-tag" onClick={() => handleRemoveFacility(index)}>{fac} ×</span>))}</div>)}</label>
          <div className="form-actions"><button type="submit" disabled={loading}>{loading ? 'กำลังบันทึก...' : editingRoom ? 'อัปเดตห้อง' : 'สร้างห้อง'}</button>{editingRoom && <button type="button" className="secondary-button" onClick={handleCancelEdit}>ยกเลิก</button>}</div>
        </form>
        <div className="room-table-wrapper">
          <h2 className="table-title">รายการห้องประชุม ({rooms.length})</h2>
          {loading ? <p className="text-center">กำลังโหลด...</p> : (
            <table className="room-table">
              <thead><tr><th>รูป</th><th>ชื่อห้อง</th><th>ความจุ</th><th>อุปกรณ์</th><th>สถานะ</th><th>การจัดการ</th></tr></thead>
              <tbody>
                {rooms.map((room) => (
                  <tr key={room.id}>
                    <td>{room.image_url ? <img src={room.image_url} alt={room.name} /> : <div className="img-placeholder">ไม่มีรูป</div>}</td>
                    <td><strong>{room.name}</strong></td>
                    <td>{room.min_capacity ?? 1}-{room.capacity} คน</td>
                    <td>{room.facilities && room.facilities.length > 0 ? (<div className="facilities-list">{room.facilities.map((fac, index) => <span key={index} className="facility-badge">{fac}</span>)}</div>) : <span className="text-empty">ไม่มีข้อมูล</span>}</td>
                    <td><span className={`status ${room.room_status?.status}`}>{getStatusLabel(room.room_status?.status)}</span></td>
                    <td>
                      <div className="table-actions">
                        <button onClick={() => handleEdit(room)}>แก้ไข</button>
                        <button className="qr-button" onClick={() => setQrRoom(room)}>🖨️ QR</button>
                        <button className="danger-button" onClick={() => handleDelete(room)}>ปิดใช้งาน</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {qrRoom && <RoomQRModal room={qrRoom} onClose={() => setQrRoom(null)} />}
    </main>
  )
}
export default RoomsAdmin