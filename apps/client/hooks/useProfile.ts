import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// Assuming Profile type based on requirements, adjust imports if needed
export type Profile = {
  id: string
  full_name?: string
  email?: string
  role?: string
  phone?: string
}

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProfile = async () => {
    setLoading(true)
    setError(null)
    const supabase = createClient()
    
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError) throw sessionError
      if (!session?.user) {
        setProfile(null)
        return
      }

      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()

      if (profileError) throw profileError
      setProfile(data as Profile)
    } catch (err: unknown) {
      setError((err as Error).message)
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProfile()
  }, [])

  return { profile, loading, error, refetch: fetchProfile }
}
