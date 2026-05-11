/**
 * @file apps/server/src/config/notifications.js
 * Server configuration and helper utilities for notifications operations.
 */

import { supabaseAdmin } from './supabase.js';
import logger from './logger.js';

export async function notifyLostFoundMatch(
  reporterStudentId,
  matchedStudentId,
  newItem,
  matchedItem,
  score
) {
  try {
    const scorePercent = Math.round(score * 100);

    // Notify the person who just reported
    await supabaseAdmin.from('notices').insert({
      title: '🔍 Possible Match Found!',
      content: `Your ${newItem.status} item "${newItem.item_name}" may match a ${matchedItem.status} report: "${matchedItem.item_name}". Match confidence: ${scorePercent}%. Please check Lost & Found section.`,
      target_audience: 'students',
      posted_by: null,
    });

    logger.info(
      `Lost & Found match notification sent — Score: ${scorePercent}% — Items: "${newItem.item_name}" ↔ "${matchedItem.item_name}"`
    );

    return true;
  } catch (err) {
    logger.error('Failed to send match notification', { error: err.message });
    return false;
  }
}
