/**
 * @file apps/client/hooks/useApi.ts
 * Custom React hook managing local state and side effects.
 */

import { createClient } from '@/lib/supabase/client';

// Compute once at module load time — avoids window.location access on every hook call
const BASE_URL =
  typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:3001`
    : process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function useApi() {
  const getToken = async () => {
    // Uses the module-level singleton — no new client created per call
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.access_token) {
      // Check if token expires in next 60 seconds
      const expiresAt = session.expires_at ?? 0;
      const now = Math.floor(Date.now() / 1000);

      if (expiresAt - now < 60) {
        // Refresh token proactively
        const { data: refreshed } = await supabase.auth.refreshSession();
        return refreshed.session?.access_token || null;
      }

      return session.access_token;
    }

    return null;
  };

  const handleResponse = async (res: Response) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || data.message || 'API request failed');
    }
    return data;
  };

  const apiGet = async (path: string) => {
    const token = await getToken();
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    return handleResponse(res);
  };

  const apiPost = async (path: string, body: unknown) => {
    const token = await getToken();
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    return handleResponse(res);
  };

  const apiPatch = async (path: string, body: unknown) => {
    const token = await getToken();
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    return handleResponse(res);
  };

  const apiDelete = async (path: string) => {
    const token = await getToken();
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'DELETE',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    return handleResponse(res);
  };

  const apiPut = async (path: string, body: unknown) => {
    const token = await getToken();
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    return handleResponse(res);
  };

  return { apiGet, apiPost, apiPatch, apiPut, apiDelete };
}
