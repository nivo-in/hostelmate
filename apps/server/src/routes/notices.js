import { Router } from 'express'
import { supabaseAdmin } from '../config/supabase.js'
import { authenticate } from '../middleware/auth.js'
import { requireWarden } from '../middleware/rbac.js'
import { validate } from '../middleware/validate.js'
import { noticeSchema } from '../config/validation.js'
import logger from '../config/logger.js'
import { getCache, setCache, deleteCache } from '../config/redis.js'

const router = Router()

router.post('/', authenticate, requireWarden, validate(noticeSchema), async (req, res, next) => {
  try {
    const { title, content, target_audience } = req.body

    const { data: record, error } = await supabaseAdmin
      .from('notices')
      .insert({
        author_id: req.user.id,
        title,
        content,
        target_audience
      })
      .select()
      .single()

    if (error) throw error

    logger.info(`Notice "${title}" posted by ${req.user.id}`)
    
    await deleteCache('notices:student')
    await deleteCache('notices:parent')
    await deleteCache('notices:warden')
    await deleteCache('stats:dashboard')
    
    res.json({ success: true, data: record })
  } catch (error) {
    next(error)
  }
})

router.get('/', authenticate, async (req, res, next) => {
  try {
    const role = req.profile.role
    const cacheKey = `notices:${role}`
    
    const cached = await getCache(cacheKey)
    if (cached) {
      logger.info(`Cache hit: notices ${role}`)
      return res.json({ success: true, data: cached })
    }
    logger.info(`Cache miss: notices ${role}`)

    let query = supabaseAdmin
      .from('notices')
      .select('*')
      .order('created_at', { ascending: false })

    if (role === 'student') {
      query = query.in('target_audience', ['students', 'all'])
    } else if (role === 'parent') {
      query = query.in('target_audience', ['parents', 'all'])
    }

    const { data, error } = await query

    if (error) throw error

    await setCache(cacheKey, data, 180)
    res.json({ success: true, data })
  } catch (error) {
    next(error)
  }
})

export default router
