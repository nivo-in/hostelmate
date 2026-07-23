/**
 * @file apps/server/src/config/supabase.js
 * Server configuration and helper utilities for supabase operations.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

/**
 * Supabase admin client initialized with the SERVICE_ROLE_KEY.
 * Bypasses Row-Level Security (RLS) policies completely.
 * MUST ONLY be used on the secure server side for system-level operations.
 */
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Supabase client initialized with the public ANON_KEY.
 * Subject to Row-Level Security (RLS) policies.
 */
export const supabasePublic = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
