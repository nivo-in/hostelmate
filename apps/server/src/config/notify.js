import { supabaseAdmin } from './supabase.js';
import logger from './logger.js';

export async function createNotification(userId, title, message, type, relatedId = null) {
  try {
    const { error } = await supabaseAdmin.from('notifications').insert({
      user_id: userId,
      title,
      message,
      type,
      related_id: relatedId,
    });

    if (error) throw error;
    logger.info(`Notification created for user ${userId}: ${title}`);
  } catch (err) {
    logger.error('Failed to create notification:', err);
  }
}
