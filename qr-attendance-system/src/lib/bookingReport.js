// ✅ ฟังก์ชันป้องกัน XSS
const escapeHtml = (text) => {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text || '').replace(/[&<>"']/g, m => map[m]);
}

const escapeCsvValue = (value) => {
  if (value === null || value === undefined) return ''
  const stringValue = String(value)
  if (/[",\n]/.test(stringValue)) return `"${stringValue.replace(/"/g, '""')}"`
  return stringValue
}

export const buildBookingReportRows = (bookings = []) =>
  bookings.map((booking) => ({
    bookingNo: booking.booking_number || '-',
    room: booking.rooms?.name || `Room ${booking.room_id}`,
    user: booking.users?.full_name || booking.user_id || '-',
    time: `${new Date(booking.start_time).toLocaleString()} - ${new Date(booking.end_time).toLocaleString()}`,
    purpose: booking.purpose || '-',
    status: booking.status === 'approved' ? 'อนุมัติแล้ว' : booking.status === 'cancelled' ? 'ยกเลิกแล้ว' : 'รออนุมัติ',
    approver: booking.approved_by_name || booking.approved_by || '-',
    approvedAt: booking.approved_at ? new Date(booking.approved_at).toLocaleString() : '-',
  }))

export const createBookingCsvContent = (bookings = []) => {
  const rows = buildBookingReportRows(bookings)
  // ✅ เพิ่ม 'เลขคิว' ใน headers
  const headers = ['เลขคิว', 'ห้อง', 'ชื่อผู้จอง', 'เวลา', 'วัตถุประสงค์', 'สถานะ', 'ผู้อนุมัติ', 'เวลาอนุมัติ']
  const csvLines = [headers.join(',')]

  rows.forEach((row) => {
    csvLines.push([
      // ✅ เพิ่ม bookingNo เข้าไปด้านหน้าสุด
      escapeCsvValue(row.bookingNo), 
      escapeCsvValue(row.room), 
      escapeCsvValue(row.user), 
      escapeCsvValue(row.time),
      escapeCsvValue(row.purpose), 
      escapeCsvValue(row.status), 
      escapeCsvValue(row.approver),
      escapeCsvValue(row.approvedAt),
    ].join(','))
  })

  // ✅ เพิ่ม BOM เพื่อแก้ภาษาไทยเพี้ยนใน Excel
  return '\uFEFF' + csvLines.join('\n')
}

export const downloadBookingCsv = (bookings = [], filename = 'booking-report.csv') => {
  const csv = createBookingCsvContent(bookings)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export const printBookingReport = (bookings = []) => {
  const rows = buildBookingReportRows(bookings)
  const printWindow = window.open('', '_blank', 'width=900,height=700')

  if (!printWindow) return false

  // ✅ เพิ่ม <td> ของ bookingNo เข้าไป
  const rowsMarkup = rows.map((row) => `
    <tr>
      <td>${escapeHtml(row.bookingNo)}</td>
      <td>${escapeHtml(row.room)}</td>
      <td>${escapeHtml(row.user)}</td>
      <td>${escapeHtml(row.time)}</td>
      <td>${escapeHtml(row.purpose)}</td>
      <td>${escapeHtml(row.status)}</td>
      <td>${escapeHtml(row.approver)}</td>
      <td>${escapeHtml(row.approvedAt)}</td>
    </tr>
  `).join('')

  printWindow.document.write(`
    <html>
      <head>
        <title>รายงานการจองห้อง</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
          h1 { margin-bottom: 8px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; font-size: 12px; }
          th { background: #f3f4f6; }
          .meta { color: #4b5563; margin-bottom: 8px; }
        </style>
      </head>
      <body>
        <h1>รายงานการจองห้อง</h1>
        <div class="meta">สร้างเมื่อ ${new Date().toLocaleString('th-TH')}</div>
        <table>
          <thead>
            <tr>
              <th>เลขคิว</th>
              <th>ห้อง</th>
              <th>ชื่อผู้จอง</th>
              <th>เวลา</th>
              <th>วัตถุประสงค์</th>
              <th>สถานะ</th>
              <th>ผู้อนุมัติ</th>
              <th>เวลาอนุมัติ</th>
            </tr>
          </thead>
          <tbody>${rowsMarkup}</tbody>
        </table>
      </body>
    </html>
  `)

  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
  return true
}