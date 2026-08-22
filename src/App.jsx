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
import Calendar from './pages/Calendar'
import Profile from './pages/Profile'
import UsersAdmin from './pages/UsersAdmin'
import BookingUsage from './pages/BookingUsage'
import Layout from './components/Layout'

import RoomKiosk from './pages/RoomKiosk'
import AppQRCode from './components/AppQRCode'

// ✅ หน้าใหม่: ติดต่อเรา / แจ้งปัญหาห้อง / จัดการปัญหาห้อง (แอดมิน) / ตั้งค่าข้อมูลติดต่อ (แอดมิน)
import Contact from './pages/Contact'
import ReportIssue from './pages/ReportIssue'
import IssuesAdmin from './pages/IssuesAdmin'
import ContactAdmin from './pages/ContactAdmin'

import Notifications from './components/Notifications'
import useBookingNotifications from './hooks/useBookingNotifications'
import SessionGuard from './components/SessionGuard'

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
  const { notifications, dismissNotification, soundEnabled, toggleSound } = useBookingNotifications()

  return (
    <>
      {/* ✅ เฝ้าสถานะ session ทั้งระบบ: เด้ง login ถ้า session หมดอายุ + auto logout เมื่อไม่มีการใช้งานนาน */}
      <SessionGuard />
      <Notifications notifications={notifications} onDismiss={dismissNotification} soundEnabled={soundEnabled} onToggleSound={toggleSound} />

      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route path="/dashboard" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
        <Route path="/booking" element={<ProtectedRoute><Layout><Booking /></Layout></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Layout><Profile /></Layout></ProtectedRoute>} />
        <Route path="/calendar" element={<ProtectedRoute><Layout><Calendar /></Layout></ProtectedRoute>} />
        <Route path="/booking-history" element={<ProtectedRoute><Layout><BookingHistory /></Layout></ProtectedRoute>} />
        <Route path="/booking/:id/usage" element={<ProtectedRoute><Layout><BookingUsage /></Layout></ProtectedRoute>} />

        {/* ✅ ติดต่อเรา: ทั้งผู้ใช้และแอดมินเข้าได้ (แค่ล็อกอิน ไม่ต้องเป็นแอดมิน) */}
        <Route path="/contact" element={<ProtectedRoute><Layout><Contact /></Layout></ProtectedRoute>} />
        {/* ✅ แจ้งปัญหาห้อง: สำหรับผู้ใช้ทั่วไป (แอดมินเข้าได้เช่นกันเพราะไม่ได้บังคับ role) */}
        <Route path="/report-issue" element={<ProtectedRoute><Layout><ReportIssue /></Layout></ProtectedRoute>} />

        <Route path="/admin/rooms" element={<RoleProtectedRoute requireAdmin={true}><Layout><RoomsAdmin /></Layout></RoleProtectedRoute>} />
        <Route path="/admin/bookings" element={<RoleProtectedRoute requireAdmin={true}><Layout><BookingAdmin /></Layout></RoleProtectedRoute>} />
        <Route path="/admin/users" element={<RoleProtectedRoute requireAdmin={true}><Layout><UsersAdmin /></Layout></RoleProtectedRoute>} />
        {/* ✅ /reports ถูกรวมเข้าไปในหน้า /dashboard (AdminDashboard) แล้ว ไม่มีหน้านี้แยกอีกต่อไป */}
        <Route path="/admin/qrcode" element={<RoleProtectedRoute requireAdmin={true}><Layout><AppQRCode /></Layout></RoleProtectedRoute>} />
        {/* ✅ จัดการปัญหาห้อง (เฉพาะแอดมิน) */}
        <Route path="/admin/issues" element={<RoleProtectedRoute requireAdmin={true}><Layout><IssuesAdmin /></Layout></RoleProtectedRoute>} />
        {/* ✅ ตั้งค่าข้อมูลติดต่อ (เฉพาะแอดมิน) */}
        <Route path="/admin/contact" element={<RoleProtectedRoute requireAdmin={true}><Layout><ContactAdmin /></Layout></RoleProtectedRoute>} />

        <Route path="/kiosk/:roomId" element={<ProtectedRoute><RoomKiosk /></ProtectedRoute>} />

        {/* ✅ /admin/setup ถูกลบออกแล้ว (ใช้งานจริงไม่ได้เพราะ server.js ไม่ได้ deploy บน Vercel)
            ต่อไปนี้ตั้ง admin คนใหม่ผ่าน Supabase Dashboard -> Table Editor -> users -> แก้ role เอง */}

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </>
  )
}

export default App