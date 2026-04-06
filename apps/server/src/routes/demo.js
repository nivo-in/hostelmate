import { Router } from 'express';
import crypto from 'crypto';
import { redis } from '../config/redis.js';
import logger from '../config/logger.js';
import {
  sendEmail,
  otpEmailTemplate,
  demoRequestTemplate,
  faqQueryTemplate,
} from '../config/email.js';

const router = Router();

/* ------------------------------------------------------------------ */
/* Config                                                             */
/* ------------------------------------------------------------------ */

const OTP_TTL_SECONDS = 600; // 10 minutes
const VERIFIED_TTL_SECONDS = 1800; // 30 minutes to complete the form after verifying
const MAX_OTP_REQUESTS_PER_EMAIL = 5; // per hour
const MAX_OTP_REQUESTS_PER_IP = 15; // per hour (covers multiple people on one NAT)
const MAX_VERIFY_ATTEMPTS = 5; // per OTP lifetime
const MAX_FAQ_PER_IP = 5; // per hour

// Accepts institutional / custom domains — NOT restricted to Gmail.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Pepper hardens the stored OTP hash against offline brute force if Redis leaks.
const OTP_PEPPER = process.env.OTP_PEPPER || process.env.SUPABASE_SERVICE_ROLE_KEY || 'hostelmate';

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function getClientIp(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

function hashOtp(email, otp) {
  return crypto.createHmac('sha256', OTP_PEPPER).update(`${email}:${otp}`).digest('hex');
}

/** Constant-time string compare that tolerates length differences. */
function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/**
 * Increment a fixed-window counter in Redis and report whether the limit is
 * exceeded. Fails open (allows the request) if Redis is unavailable so the
 * feature degrades gracefully rather than hard-failing.
 */
async function rateLimited(key, max, windowSeconds) {
  try {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, windowSeconds);
    return count > max;
  } catch (err) {
    logger.warn(`Rate-limit check failed (${key}): ${err.message}`);
    return false;
  }
}

function clamp(value, maxLen) {
  if (value === null || value === undefined) return '';
  return String(value).slice(0, maxLen).trim();
}

/* ------------------------------------------------------------------ */
/* POST /send-otp                                                     */
/* ------------------------------------------------------------------ */

router.post('/send-otp', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const ip = getClientIp(req);

    if (!EMAIL_RE.test(email) || email.length > 254) {
      return res.status(400).json({ success: false, error: 'Enter a valid email address.' });
    }

    // Per-IP throttle first (cheap abuse ceiling), then per-email.
    if (await rateLimited(`demo:otp:ip:${ip}`, MAX_OTP_REQUESTS_PER_IP, 3600)) {
      return res
        .status(429)
        .json({ success: false, error: 'Too many requests from this network. Try again later.' });
    }
    if (await rateLimited(`demo:otp:email:${email}`, MAX_OTP_REQUESTS_PER_EMAIL, 3600)) {
      return res
        .status(429)
        .json({ success: false, error: 'Too many codes requested. Try again in an hour.' });
    }

    // Cryptographically secure 6-digit code.
    const otp = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');

    // Store only the HMAC of the code (never the code itself) with a real TTL.
    await redis.set(`demo:otp:${email}`, hashOtp(email, otp), { ex: OTP_TTL_SECONDS });
    // Reset the verify-attempt counter for this fresh code.
    await redis.del(`demo:verify:${email}`);

    await sendEmail({
      to: email,
      subject: 'Your HostelMate verification code',
      html: otpEmailTemplate(otp),
    });

    // Identical response whether or not mail was sent — no account enumeration,
    // no signal about deliverability.
    if (process.env.NODE_ENV !== 'production') {
      logger.info(`[dev] Demo OTP for ${email}: ${otp}`);
    }
    return res.json({ success: true, message: 'If the address is valid, a code has been sent.' });
  } catch (error) {
    logger.error(`Send OTP error: ${error.message}`);
    return res.status(500).json({ success: false, error: 'Failed to send code.' });
  }
});

/* ------------------------------------------------------------------ */
/* POST /verify-otp                                                   */
/* ------------------------------------------------------------------ */

router.post('/verify-otp', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const otp = clamp(req.body?.otp, 6);

    if (!EMAIL_RE.test(email) || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({ success: false, error: 'Email and 6-digit code required.' });
    }

    // Cap verification attempts per code to block brute force (10^6 space).
    const attempts = await redis.incr(`demo:verify:${email}`);
    if (attempts === 1) await redis.expire(`demo:verify:${email}`, OTP_TTL_SECONDS);
    if (attempts > MAX_VERIFY_ATTEMPTS) {
      return res
        .status(429)
        .json({ success: false, error: 'Too many attempts. Request a new code.' });
    }

    const storedHash = await redis.get(`demo:otp:${email}`);
    if (storedHash && safeEqual(storedHash, hashOtp(email, otp))) {
      // Consume the code (single use) and grant a short verified window.
      await redis.del(`demo:otp:${email}`);
      await redis.del(`demo:verify:${email}`);
      const token = crypto.randomBytes(24).toString('hex');
      await redis.set(`demo:verified:${email}`, token, { ex: VERIFIED_TTL_SECONDS });
      return res.json({ success: true, verified: true, token });
    }

    return res.status(400).json({ success: false, error: 'Invalid or expired code.' });
  } catch (error) {
    logger.error(`Verify OTP error: ${error.message}`);
    return res.status(500).json({ success: false, error: 'Failed to verify code.' });
  }
});

/* ------------------------------------------------------------------ */
/* POST /submit                                                       */
/* ------------------------------------------------------------------ */

router.post('/submit', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const token = clamp(req.body?.token, 64);

    const storedToken = await redis.get(`demo:verified:${email}`);
    // Require a matching verification token, not just "any verified flag".
    if (!storedToken || (token && !safeEqual(storedToken, token))) {
      return res
        .status(403)
        .json({ success: false, error: 'Email not verified. Please verify and try again.' });
    }

    const payload = {
      email,
      institution: clamp(req.body?.collegeName ?? req.body?.institution, 160),
      buildings: clamp(req.body?.buildings, 20),
      students: clamp(req.body?.students, 40),
      query: clamp(req.body?.query, 2000),
    };

    const recipient = process.env.DEMO_RECIPIENT_EMAIL || process.env.GMAIL_USER;
    if (recipient) {
      await sendEmail({
        to: recipient,
        replyTo: email,
        subject: `New HostelMate demo request — ${payload.institution || 'Unknown institution'}`,
        html: demoRequestTemplate(payload),
      });
    }

    // One-time use: invalidate the verified token after submission.
    await redis.del(`demo:verified:${email}`);

    return res.json({ success: true, message: 'Request submitted successfully.' });
  } catch (error) {
    logger.error(`Submit demo error: ${error.message}`);
    return res.status(500).json({ success: false, error: 'Failed to submit request.' });
  }
});

/* ------------------------------------------------------------------ */
/* POST /faq  — "Ask a query" lead capture                            */
/* ------------------------------------------------------------------ */

router.post('/faq', async (req, res) => {
  try {
    const ip = getClientIp(req);
    const name = clamp(req.body?.name, 100);
    const email = normalizeEmail(req.body?.email);
    const query = clamp(req.body?.query, 2000);

    if (!name || !EMAIL_RE.test(email) || query.length < 5) {
      return res
        .status(400)
        .json({ success: false, error: 'Name, a valid email, and a question are required.' });
    }

    if (await rateLimited(`demo:faq:ip:${ip}`, MAX_FAQ_PER_IP, 3600)) {
      return res
        .status(429)
        .json({ success: false, error: 'Too many questions submitted. Try again later.' });
    }

    const recipient = process.env.DEMO_RECIPIENT_EMAIL || process.env.GMAIL_USER;
    if (recipient) {
      await sendEmail({
        to: recipient,
        replyTo: email,
        subject: `New HostelMate question — ${name}`,
        html: faqQueryTemplate({ name, email, query }),
      });
    }

    return res.json({ success: true, message: 'Thanks! We will get back to you shortly.' });
  } catch (error) {
    logger.error(`FAQ submit error: ${error.message}`);
    return res.status(500).json({ success: false, error: 'Failed to submit question.' });
  }
});

export default router;
