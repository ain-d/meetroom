import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { supabase } from './lib/supabase'

import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import RoomsAdmin from './pages/RoomsAdmin'
import Booking from './pages/Booking'
import BookingAdmin from './pages/BookingAdmin'
import BookingHistory from './pages/BookingHistory'
import AdminSetup from './pages/AdminSetup'
import Calendar from './pages/Calendar'
import Profile from './pages/Profile'
import UsersAdmin from './pages/UsersAdmin'
import Reports from './pages/Reports'
import BookingUsage from './pages/BookingUsage'
import CheckInPage from './pages/CheckInPage' 
import RoomKiosk from './pages/RoomKiosk'

import Notifications from './components/Notifications'
import useBookingNotifications from './hooks/useBookingNotifications'

import './App.css'

function ProtectedRoute({ children }) {
  const location = useLocation()
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    let mounted = true
    const checkSession = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (mounted) {
        setIsAuthenticated(!!user)
        setLoading(false)
      }
    }
    checkSession()
    return () => { mounted = false }
  }, [])

  if (loading) return <p style={{textAlign:'center', padding: 30}}>Loading...</p>
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />
  return children
}

function RoleProtectedRoute({ children, requireAdmin = false }) {
  const location = useLocation()
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isAuthorized, setIsAuthorized] = useState(false)

  useEffect(() => {
    let mounted = true
    const checkRole = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        if (mounted) { setIsAuthenticated(false); setLoading(false) }
        return
      }

      const { data: profileData } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

      if (!mounted) return

      const role = profileData?.role || 'staff'
      setIsAuthenticated(true)
      setIsAuthorized(!requireAdmin || role === 'admin')
      setLoading(false)
    }
    checkRole()
    return () => { mounted = false }
  }, [requireAdmin])

  if (loading) return <p style={{textAlign:'center', padding: 30}}>Loading...</p>
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />
  if (!isAuthorized) return <Navigate to="/dashboard" replace />
  return children
}

function App() {
  const { notifications, dismissNotification } = useBookingNotifications()

  return (
    <>
      <Notifications notifications={notifications} onDismiss={dismissNotification} />

      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/booking" element={<ProtectedRoute><Booking /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/calendar" element={<ProtectedRoute><Calendar /></ProtectedRoute>} />
        <Route path="/booking-history" element={<ProtectedRoute><BookingHistory /></ProtectedRoute>} />
        <Route path="/booking/:id/usage" element={<ProtectedRoute><BookingUsage /></ProtectedRoute>} />

        <Route path="/admin/rooms" element={<RoleProtectedRoute requireAdmin={true}><RoomsAdmin /></RoleProtectedRoute>} />
        <Route path="/admin/bookings" element={<RoleProtectedRoute requireAdmin={true}><BookingAdmin /></RoleProtectedRoute>} />
        <Route path="/admin/users" element={<RoleProtectedRoute requireAdmin={true}><UsersAdmin /></RoleProtectedRoute>} />
        <Route path="/reports" element={<RoleProtectedRoute requireAdmin={true}><Reports /></RoleProtectedRoute>} />
        <Route path="/checkin/:id" element={<ProtectedRoute><CheckInPage /></ProtectedRoute>} />
        <Route path="/kiosk/:roomId" element={<ProtectedRoute><RoomKiosk /></ProtectedRoute>} />
        
        {/* ✅ แก้ช่องโหว่: ใส่ RoleProtectedRoute ให้แล้ว (ไม่มีคอมเมนต์ทำลาย JSX) */}
        <Route path="/admin/setup" element={<RoleProtectedRoute requireAdmin={true}><AdminSetup /></RoleProtectedRoute>} />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </>
  )
}

export default App