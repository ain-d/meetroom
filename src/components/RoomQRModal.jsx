import { QRCodeSVG } from 'qrcode.react'

function RoomQRModal({ room, onClose }) {
  // ✅ QR พาไปหน้า login พร้อมแนบ room id ผ่าน query string
  const qrUrl = `${window.location.origin}/login?room=${room.id}`

  return (
    <div className="qr-modal-overlay" onClick={onClose}>
      <div className="qr-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="qr-modal-close" onClick={onClose}>✕</button>

        <h3>📱 QR ประจำห้อง</h3>
        <h2>{room.name}</h2>
        <p>สแกนเพื่อเข้าสู่ระบบและจองห้องนี้</p>

        <div className="qr-box">
          <QRCodeSVG value={qrUrl} size={220} />
        </div>

        <p className="qr-url">{qrUrl}</p>

        <button className="qr-print-btn" onClick={() => window.print()}>
          🖨️ พิมพ์ QR Code นี้
        </button>
      </div>
    </div>
  )
}

export default RoomQRModal