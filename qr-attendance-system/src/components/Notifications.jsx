import './Notifications.css'

function Notifications({ notifications, onDismiss }) {
  if (!notifications?.length) {
    return null
  }

  return (
    // ✅ แก้ JSX: ใส่ Tag หลักให้ครบและแก้โครงสร้างให้อ่านง่าย
    <div className="notification-list">
      {notifications.map((notification) => (
        <div key={notification.id} className={`notification-item ${notification.type}`}>
          <div className="notification-content">
            <div>{notification.message}</div>
            <div className="notification-time">{notification.time}</div>
          </div>
          <button 
            type="button" 
            className="notification-close" 
            onClick={() => onDismiss(notification.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}

export default Notifications