import { Router } from 'express'
import { supabaseAdmin } from '../config/supabase.js'
import { authenticate } from '../middleware/auth.js'
import { getCache, setCache, deleteCache } from '../config/redis.js'

const router = Router()

router.get('/', authenticate, async (req, res, next) => {
  try {
    // Short cache per user — real-time updates come via WebSocket anyway.
    // 30 seconds is safe: new notifications push via socket, not polling.
    const cacheKey = `notifications:${req.user.id}`
    const cached = await getCache(cacheKey)
    if (cached) {
      return res.json({ success: true, data: cached })
    }

    const { data: notifications, error } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) {
      return res.json({ success: true, data: { notifications: [], unread_count: 0 } })
    }

    const safeNotifications = notifications || []
    const unread_count = safeNotifications.filter(n => !n.is_read).length
    const payload = { notifications: safeNotifications, unread_count }

    await setCache(cacheKey, payload, 30) // 30s cache
    res.json({ success: true, data: payload })
  } catch {
    res.json({ success: true, data: { notifications: [], unread_count: 0 } })
  }
})

router.patch('/read-all', authenticate, async (req, res, next) => {
  try {
    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', req.user.id)
      .eq('is_read', false)

    // Invalidate cache so next GET returns fresh data
    await deleteCache(`notifications:${req.user.id}`).catch(() => {})

    if (error) {
      return res.json({ success: true })
    }

    res.json({ success: true })
  } catch {
    res.json({ success: true })
  }
})

router.patch('/:id/read', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params

    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', req.user.id)

    await deleteCache(`notifications:${req.user.id}`).catch(() => {})

    if (error) {
      return res.json({ success: true })
    }

    res.json({ success: true })
  } catch {
    res.json({ success: true })
  }
})

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params

    const { error } = await supabaseAdmin
      .from('notifications')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id)   // guard: only own notifications

    await deleteCache(`notifications:${req.user.id}`).catch(() => {})

    if (error) return res.json({ success: true })
    res.json({ success: true })
  } catch {
    res.json({ success: true })
  }
})

export default router
