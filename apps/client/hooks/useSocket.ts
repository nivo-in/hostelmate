'use client'
import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { connectSocket, getSocket } from '@/lib/socket'

type SocketHandlers = Record<string, (_data: unknown) => void>

export function useSocket(handlers: SocketHandlers) {
  // Keep a ref to always have the latest handlers without re-subscribing
  const handlersRef = useRef<SocketHandlers>(handlers)

  useEffect(() => {
    handlersRef.current = handlers
  }, [handlers])
  useEffect(() => {
    let mounted = true

    // Stable wrapper functions stored per event so we can remove them later
    const wrappers: Record<string, (_data: unknown) => void> = {}

    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !mounted) return

      connectSocket(user.id)
      const socket = getSocket()

      Object.keys(handlersRef.current).forEach((event) => {
        const wrapper = (_data: unknown) => {
          // Always call the latest handler via ref — no stale closures
          handlersRef.current[event]?.(_data)
        }
        wrappers[event] = wrapper
        socket.on(event, wrapper)
      })
      socket.on('connect', (_data: unknown) => {     })
    }

    init()

    return () => {
      mounted = false
      const socket = getSocket()
      Object.entries(wrappers).forEach(([event, wrapper]) => {
        socket.off(event, wrapper)
      })
    }
  }, [])
}
