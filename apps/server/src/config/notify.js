/**
 * @file apps/server/src/config/notify.js
 * Server configuration and helper utilities for notify operations.
 */

import { supabaseAdmin } from './supabase.js';
import logger from './logger.js';

/**
 * Inserts a notification record into the `notifications` table and
 * logs the outcome. Used by all route handlers to push in-app alerts.
 *
 * @param {string} userId - Supabase user UUID of the recipient
 * @param {string} title - Short notification headline (shown in bell panel)
 * @param {string} message - Full notification body text
 * @param {string} type - Notification category (e.g. 'leave', 'complaint', 'payment', 'curfew')
 * @param {string|null} [relatedId] - Optional UUID of the related resource for deep-link navigation
 * @returns {Promise<void>}
 */
export async function createNotification(userId, title, message, type, relatedId = null) {
  try {
    const { error } = await supabaseAdmin.from('notifications').insert({
      user_id: userId,
      title,
      message,
      type,
      related_id: relatedId,
    });

    if (error) {throw error;}
    logger.info(`Notification created for user ${userId}: ${title}`, { type, relatedId });
  } catch (err) {
    logger.error('Failed to create notification', { userId, title, type, error: err?.message });
  }
}

/**
 * Sends a notification to all warden and admin profiles in the system.
 *
 * @param {string} title - Headline text
 * @param {string} message - Body text
 * @param {string} type - Category tag
 * @param {string|null} [relatedId] - Optional resource UUID
 * @returns {Promise<void>}
 */
export async function notifyWardens(title, message, type, relatedId = null) {
  try {
    const { data: wardens } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .in('role', ['warden', 'admin']);

    if (wardens && wardens.length > 0) {
      await Promise.all(
        wardens.map((w) => createNotification(w.id, title, message, type, relatedId))
      );
    }
  } catch (err) {
    logger.error('Failed to notify wardens', { title, type, error: err?.message });
  }
}
