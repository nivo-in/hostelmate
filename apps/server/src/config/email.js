/**
 * @file apps/server/src/config/email.js
 * Server configuration and helper utilities for email operations.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import logger from './logger.js';

/**
 * Shared email infrastructure for HostelMate.
 *
 * Two providers, chosen automatically at send time:
 *   1. Resend (preferred) — used when a `re_…` API key is present in
 *      RESEND_API_KEY or the local apps/server/.resend-key file. Best
 *      deliverability (SPF/DKIM/DMARC via a verified domain).
 *   2. Gmail SMTP (fallback) — used when GMAIL_USER + GMAIL_APP_PASSWORD are
 *      set but no Resend key.
 * If neither is configured it logs instead of failing (local dev).
 *
 * NOTE on Resend sender domains: the default `onboarding@resend.dev` sender
 * works WITHOUT domain verification but only delivers to your own Resend
 * account email — perfect for receiving demo/FAQ leads at DEMO_RECIPIENT_EMAIL.
 * To send OTPs to arbitrary visitors, verify a domain in Resend and set
 * RESEND_FROM (e.g. "HostelMate <noreply@yourdomain.com>").
 */

const __dirname = dirname(fileURLToPath(import.meta.url));

let cachedResendKey;
function getResendKey() {
  if (cachedResendKey !== undefined) {return cachedResendKey;}
  // 1) env var, 2) local key file — extract the first re_… token so any format
  // (bare key, "RESEND_API_KEY=re_…", with comments) works.
  let raw = process.env.RESEND_API_KEY || '';
  if (!/re_[A-Za-z0-9_-]+/.test(raw)) {
    try {
      raw = readFileSync(join(__dirname, '..', '..', '.resend-key'), 'utf-8');
    } catch {
      raw = '';
    }
  }
  const match = raw.match(/re_[A-Za-z0-9_-]+/);
  cachedResendKey = match ? match[0] : null;
  return cachedResendKey;
}

const RESEND_FROM = process.env.RESEND_FROM || 'HostelMate <onboarding@resend.dev>';

let cachedResend = null;
function getResend() {
  if (cachedResend) {return cachedResend;}
  const key = getResendKey();
  if (!key) {return null;}
  cachedResend = new Resend(key);
  return cachedResend;
}

let cachedTransporter = null;
function gmailConfigured() {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

/** True when any email provider (Resend or Gmail) is configured. */
export function isEmailConfigured() {
  return Boolean(getResendKey() || gmailConfigured());
}

function getTransporter() {
  if (cachedTransporter) {return cachedTransporter;}
  cachedTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
  return cachedTransporter;
}

/**
 * Escape user-supplied text before interpolating into HTML email bodies.
 * Prevents HTML/content injection in the inbox of whoever reads the lead email.
 */
export function escapeHtml(value) {
  if (value === null || value === undefined) {return '';}
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Send an email. Never throws — returns { sent: boolean } so callers can
 * proceed regardless of mail-server availability. When SMTP is not configured
 * (local dev) it logs instead of failing the request.
 */
export async function sendEmail({ to, subject, html, replyTo }) {
  const resend = getResend();
  if (resend) {
    try {
      const { error } = await resend.emails.send({
        from: RESEND_FROM,
        to,
        subject,
        html,
        ...(replyTo ? { replyTo } : {}),
      });
      if (error) {throw new Error(error.message || 'Resend error');}
      return { sent: true, provider: 'resend' };
    } catch (error) {
      // Common cause: sending to a non-account address before a domain is
      // verified. Fall through to Gmail if it's configured.
      logger.error(`Resend send failed (${subject}): ${error.message}`);
      if (!gmailConfigured()) {return { sent: false, reason: 'send_error' };}
    }
  }

  if (gmailConfigured()) {
    try {
      await getTransporter().sendMail({
        from: `HostelMate <${process.env.GMAIL_USER}>`,
        to,
        subject,
        html,
        ...(replyTo ? { replyTo } : {}),
      });
      return { sent: true, provider: 'gmail' };
    } catch (error) {
      logger.error(`Gmail send failed (${subject}): ${error.message}`);
      return { sent: false, reason: 'send_error' };
    }
  }

  logger.warn(`Email not configured — would have sent "${subject}" to ${to}`);
  return { sent: false, reason: 'not_configured' };
}

/* ------------------------------------------------------------------ */
/* Branded templates                                                  */
/* ------------------------------------------------------------------ */

const BG = '#080810';

function shell(innerHtml) {
  return `
  <div style="background:${BG};padding:32px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;">
    <div style="max-width:520px;margin:0 auto;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:36px;color:#ffffff;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:28px;">
        <div style="width:26px;height:26px;border-radius:7px;background:linear-gradient(135deg,#4ade80,#3b82f6);"></div>
        <span style="font-size:17px;font-weight:600;letter-spacing:-0.4px;color:#fff;">HostelMate</span>
      </div>
      ${innerHtml}
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:28px 0 16px;" />
      <p style="color:rgba(255,255,255,0.32);font-size:11px;margin:0;">HostelMate by Nivo Technologies · This is an automated message.</p>
    </div>
  </div>`;
}

/** OTP verification email sent to the requester. `otp` is the plaintext code. */
export function otpEmailTemplate(otp) {
  return shell(`
    <h2 style="margin:0 0 8px;font-size:20px;font-weight:600;">Verify your email</h2>
    <p style="color:rgba(255,255,255,0.55);font-size:14px;margin:0 0 24px;">Use the code below to confirm your email for your HostelMate demo request.</p>
    <div style="font-size:34px;font-weight:700;letter-spacing:8px;color:#fff;background:rgba(124,92,252,0.12);border:1px solid rgba(124,92,252,0.25);border-radius:12px;padding:18px;text-align:center;">${escapeHtml(otp)}</div>
    <p style="color:rgba(255,255,255,0.4);font-size:12px;margin:20px 0 0;">This code expires in 10 minutes. If you didn't request it, you can ignore this email.</p>
  `);
}

export function faqQueryTemplate({ name, email, query }) {
  return shell(`
    <h2 style="margin:0 0 8px;font-size:20px;font-weight:600;">New Demo Query</h2>
    <p style="color:rgba(255,255,255,0.7);font-size:14px;"><strong>Name:</strong> ${escapeHtml(name)}</p>
    <p style="color:rgba(255,255,255,0.7);font-size:14px;"><strong>Email:</strong> ${escapeHtml(email)}</p>
    <div style="margin-top:16px;padding:16px;background:rgba(255,255,255,0.05);border-radius:8px;">
      <p style="color:rgba(255,255,255,0.9);font-size:14px;margin:0;">${escapeHtml(query).replace(/\n/g, '<br/>')}</p>
    </div>
  `);
}

export function demoRequestTemplate({ name, email, institution, role, phone }) {
  return shell(`
    <h2 style="margin:0 0 8px;font-size:20px;font-weight:600;">New Demo Request</h2>
    <div style="background:rgba(255,255,255,0.05);padding:16px;border-radius:8px;margin-top:16px;">
      <p style="margin:0 0 8px;font-size:14px;"><strong style="color:rgba(255,255,255,0.5);">Name:</strong> ${escapeHtml(name)}</p>
      <p style="margin:0 0 8px;font-size:14px;"><strong style="color:rgba(255,255,255,0.5);">Email:</strong> ${escapeHtml(email)}</p>
      <p style="margin:0 0 8px;font-size:14px;"><strong style="color:rgba(255,255,255,0.5);">Phone:</strong> ${escapeHtml(phone || 'Not provided')}</p>
      <p style="margin:0 0 8px;font-size:14px;"><strong style="color:rgba(255,255,255,0.5);">Institution:</strong> ${escapeHtml(institution || 'Not provided')}</p>
      <p style="margin:0;font-size:14px;"><strong style="color:rgba(255,255,255,0.5);">Role:</strong> ${escapeHtml(role || 'Not provided')}</p>
    </div>
  `);
}