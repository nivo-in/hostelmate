import { supabaseAdmin } from '../config/supabase.js'
import logger from '../config/logger.js'

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    const token = authHeader.split(' ')[1]
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      logger.error("Auth FAILED - no profile: " + JSON.stringify(profileError));
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    logger.info(`Auth Success - user: ${user.id}, profile role: ${profile.role}`);
    req.user = user
    req.profile = profile
    next()
  } catch (err) {
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}
