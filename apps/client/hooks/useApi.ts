import { createClient } from '@/lib/supabase/client'

export function useApi() {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

  const getToken = async () => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token
  }

  const apiGet = async (path: string) => {
    const token = await getToken()
    const res = await fetch(`${baseUrl}${path}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    return res.json()
  }

  const apiPost = async (path: string, body: any) => {
    const token = await getToken()
    const res = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })
    return res.json()
  }

  const apiPatch = async (path: string, body: any) => {
    const token = await getToken()
    const res = await fetch(`${baseUrl}${path}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })
    return res.json()
  }

  const apiPut = async (path: string, body: any) => {
    const token = await getToken()
    const res = await fetch(`${baseUrl}${path}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })
    return res.json()
  }

  return { apiGet, apiPost, apiPatch, apiPut }
}
