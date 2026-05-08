import { createClient } from '@/lib/supabase/client'

export function useApi() {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

  const getToken = async () => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  }

  const handleResponse = async (res: Response) => {
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(data.error || data.message || 'API request failed')
    }
    return data
  }

  const apiGet = async (path: string) => {
    const token = await getToken()
    const res = await fetch(`${baseUrl}${path}`, {
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    })
    return handleResponse(res)
  }

  const apiPost = async (path: string, body: unknown) => {
    const token = await getToken()
    const res = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify(body)
    })
    return handleResponse(res)
  }

  const apiPatch = async (path: string, body: unknown) => {
    const token = await getToken()
    const res = await fetch(`${baseUrl}${path}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify(body)
    })
    return handleResponse(res)
  }

  const apiDelete = async (path: string) => {
    const token = await getToken()
    const res = await fetch(`${baseUrl}${path}`, {
      method: 'DELETE',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    })
    return handleResponse(res)
  }

  const apiPut = async (path: string, body: unknown) => {
    const token = await getToken()
    const res = await fetch(`${baseUrl}${path}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify(body)
    })
    return handleResponse(res)
  }

  return { apiGet, apiPost, apiPatch, apiPut, apiDelete }
}
