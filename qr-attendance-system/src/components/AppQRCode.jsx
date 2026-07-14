import { QRCodeSVG } from 'qrcode.react'

function AppQRCode() {
  const appUrl = window.location.origin

  return (
    <div className="qr-container">
      <h3>📱 เข้าสู่ระบบจองห้อง</h3>
      <p>
        สำหรับผู้ใช้งานใหม่ หรือต้องการเข้าถึงระบบ<br/>กรุณาสแกน QR Code นี้
      </p>
      
      <div className="qr-box">
        <QRCodeSVG value={appUrl} size={180} />
      </div>

      <p className="qr-url">
        {appUrl}
      </p>

      <button 
        className="qr-print-btn"
        onClick={() => window.print()}
      >
        🖨️ พิมพ์ QR Code นี้
      </button>
    </div>
  )
}

export default AppQRCode