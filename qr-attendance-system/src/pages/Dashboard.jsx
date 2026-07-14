import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import AdminDashboard from './AdminDashboard'
import UserDashboard from './UserDashboard'

function Dashboard() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    const loadProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { navigate('/login'); return }
      const user = session.user

      let { data: profileData, error: profileError } = await supabase
        .from('users')
        .select('full_name, email, avatar_url, role')
        .eq('id', user.id)
        .maybeSingle()

      if (!mounted) return
      if (profileError) { setError(profileError.message); setLoading(false); return }

      // Auto-fix: ถ้าไม่มีโปรไฟล์ ให้สร้างให้
      if (!profileData) {
        const { data: newProfile, error: insertError } = await supabase
          .from('users')
          .insert({ id: user.id, email: user.email, full_name: user.user_metadata?.full_name || 'ผู้ใช้ใหม่', role: 'staff' })
          .select().single()

        if (insertError) { setError(insertError.message); setLoading(false); return }
        profileData = newProfile
      }

      setProfile(profileData)
      setLoading(false)
    }
    loadProfile()
    return () => { mounted = false }
  }, [navigate])

  // ✅ ใช้ Class จาก App.css แทน Inline Style
  if (loading) return <p className="text-center">กำลังโหลด...</p>
  if (error) return <p className="text-center text-error">{error}</p>
  if (!profile) return null

  return profile.role === 'admin' 
    ? <AdminDashboard profile={profile} /> 
    : <UserDashboard profile={profile} />
}

export default Dashboard