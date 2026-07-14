import { Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

function ProtectedRoute({ children }) {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState(null)

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession()
      setSession(data.session)
      setLoading(false)
    }
    checkSession()
  }, [])

  // ✅ แก้ Syntax: ใส่ Tag <p> ครอบ
  if (loading) return <p style={{textAlign:'center', padding: 30}}>Loading...</p>

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return children
}

export default ProtectedRoute