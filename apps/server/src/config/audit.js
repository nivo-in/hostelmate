import { supabaseAdmin } from './supabase.js'
import logger from './logger.js'

export async function auditLog(userId, action, resource, resourceId, details = {}) {
  try {
    const { error } = await supabaseAdmin
      .from('audit_logs')
      .insert({
        user_id: userId,
        action,
        resource,
        resource_id: resourceId,
        details
      })
      
    if (error) throw error
    logger.info(`Audit: User ${userId} performed ${action} on ${resource} ${resourceId}`)
  } catch (err) {
    logger.error('Failed to create audit log:', err)
  }
}
