import './Notifications.css'

function Notifications({ notifications, onDismiss, soundEnabled, onToggleSound }) {
  return (
    <>
      <button
        type="button"
        className="notification-sound-toggle"
        onClick={onToggleSound}
        title={soundEnabled ? 'ปิดเสียงแจ้งเตือน' : 'เปิดเสียงแจ้งเตือน'}
      >
        {soundEnabled ? '🔔' : '🔕'}
      </button>

      {notifications?.length > 0 && (
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
      )}
    </>
  )
}

export default Notifications