import { jest } from '@jest/globals';
import request from 'supertest';

// Mock config/redis.js
jest.unstable_mockModule('../config/redis.js', () => ({
  getCache: jest.fn().mockResolvedValue(null),
  setCache: jest.fn().mockResolvedValue(true),
  deleteCache: jest.fn().mockResolvedValue(true),
  deleteCachePattern: jest.fn().mockResolvedValue(true),
  publishEvent: jest.fn().mockResolvedValue(true),
  redis: {
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue('fake-hash'),
    del: jest.fn().mockResolvedValue(1),
  },
}));

// Mock config/supabase.js
jest.unstable_mockModule('../config/supabase.js', () => ({
  supabaseAdmin: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
  },
}));

// Mock config/email.js
jest.unstable_mockModule('../config/email.js', () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
  otpEmailTemplate: jest.fn().mockReturnValue('Mock OTP email'),
  demoRequestTemplate: jest.fn().mockReturnValue('Mock demo email'),
  faqQueryTemplate: jest.fn().mockReturnValue('Mock FAQ email'),
}));

// Mock config/logger.js
jest.unstable_mockModule('../config/logger.js', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), http: jest.fn() },
}));

const { default: app } = await import('../index.js');
const { redis } = await import('../config/redis.js');
const { sendEmail } = await import('../config/email.js');
const crypto = await import('crypto');

// Mock crypto inside tests dynamically
const originalCreateHmac = crypto.createHmac;
const originalTimingSafeEqual = crypto.timingSafeEqual;

describe('Demo API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/demo/send-otp', () => {
    /**
     * Test: should require a valid email
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should require a valid email', async () => {
      const res = await request(app).post('/api/v1/demo/send-otp').send({ email: 'invalid' });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    /**
     * Test: should send otp on valid email
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should send otp on valid email', async () => {
      const res = await request(app)
        .post('/api/v1/demo/send-otp')
        .send({ email: 'test@example.com' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(sendEmail).toHaveBeenCalled();
    });

    /**
     * Test: should hit IP rate limit
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should hit IP rate limit', async () => {
      redis.incr.mockResolvedValueOnce(20); // triggers MAX_OTP_REQUESTS_PER_IP
      const res = await request(app)
        .post('/api/v1/demo/send-otp')
        .send({ email: 'test2@example.com' });
      expect(res.status).toBe(429);
      expect(res.body.error).toMatch(/network/i);
    });

    /**
     * Test: should hit email rate limit
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should hit email rate limit', async () => {
      redis.incr.mockResolvedValueOnce(1); // IP limit pass
      redis.incr.mockResolvedValueOnce(10); // triggers MAX_OTP_REQUESTS_PER_EMAIL
      const res = await request(app)
        .post('/api/v1/demo/send-otp')
        .send({ email: 'test3@example.com' });
      expect(res.status).toBe(429);
      expect(res.body.error).toMatch(/Too many codes/i);
    });

    it('should handle internal errors gracefully', async () => {
      redis.incr.mockRejectedValueOnce(new Error('Redis died'));
      // rateLimited catches the error and returns false, so it proceeds to redis.set
      redis.set.mockRejectedValueOnce(new Error('Redis died'));
      const res = await request(app)
        .post('/api/v1/demo/send-otp')
        .send({ email: 'test4@example.com' });
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/demo/verify-otp', () => {
    it('should fail with invalid email or otp length', async () => {
      const res = await request(app)
        .post('/api/v1/demo/verify-otp')
        .send({ email: 'test@example.com', otp: '123' });
      expect(res.status).toBe(400);
    });

    it('should fail on missing redis hash', async () => {
      redis.get.mockResolvedValueOnce(null);
      const res = await request(app)
        .post('/api/v1/demo/verify-otp')
        .send({ email: 'test@example.com', otp: '123456' });
      expect(res.status).toBe(400);
    });

    it('should fail if too many verify attempts', async () => {
      redis.incr.mockResolvedValueOnce(10);
      const res = await request(app)
        .post('/api/v1/demo/verify-otp')
        .send({ email: 'test@example.com', otp: '123456' });
      expect(res.status).toBe(429);
    });

    it('should succeed with valid otp', async () => {
      redis.incr.mockResolvedValueOnce(1);
      
      const expectedPepper = process.env.OTP_PEPPER || process.env.SUPABASE_SERVICE_ROLE_KEY || 'hostelmate';
      const expectedHash = crypto.createHmac('sha256', expectedPepper).update('test@example.com:123456').digest('hex');

      // We mock redis.get to return a valid hash for '123456'
      redis.get.mockResolvedValueOnce(expectedHash);

      const res = await request(app)
        .post('/api/v1/demo/verify-otp')
        .send({ email: 'test@example.com', otp: '123456' });
      expect(res.status).toBe(200);
      expect(res.body.verified).toBe(true);
      expect(res.body.token).toBeDefined();
    });

    it('should handle internal errors gracefully', async () => {
      redis.incr.mockRejectedValueOnce(new Error('Redis died'));
      const res = await request(app)
        .post('/api/v1/demo/verify-otp')
        .send({ email: 'test@example.com', otp: '123456' });
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/demo/submit', () => {
    it('should fail if no valid verified token exists', async () => {
      redis.get.mockResolvedValueOnce(null);
      const res = await request(app)
        .post('/api/v1/demo/submit')
        .send({ email: 'test@example.com', token: 'fake-token' });
      expect(res.status).toBe(403);
    });

    it('should submit successfully if token matches', async () => {
      redis.get.mockResolvedValueOnce('valid-token');
      const res = await request(app)
        .post('/api/v1/demo/submit')
        .send({ email: 'test@example.com', token: 'valid-token', query: 'Help' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should handle internal errors gracefully', async () => {
      redis.get.mockRejectedValueOnce(new Error('Redis died'));
      const res = await request(app)
        .post('/api/v1/demo/submit')
        .send({ email: 'test@example.com', token: 'valid-token' });
      expect(res.status).toBe(500);
    });

    it('should skip email if no recipient is configured', async () => {
      redis.get.mockResolvedValueOnce('valid-token');
      const originalDemoEmail = process.env.DEMO_RECIPIENT_EMAIL;
      const originalGmail = process.env.GMAIL_USER;
      delete process.env.DEMO_RECIPIENT_EMAIL;
      delete process.env.GMAIL_USER;

      const res = await request(app)
        .post('/api/v1/demo/submit')
        .send({ email: 'test@example.com', token: 'valid-token', query: 'Help' });
      
      expect(res.status).toBe(200);
      expect(sendEmail).not.toHaveBeenCalled();

      process.env.DEMO_RECIPIENT_EMAIL = originalDemoEmail;
      process.env.GMAIL_USER = originalGmail;
    });
  });

  describe('POST /api/demo/faq', () => {
    it('should fail with invalid inputs', async () => {
      const res = await request(app).post('/api/v1/demo/faq').send({ email: 'invalid' });
      expect(res.status).toBe(400);
    });

    it('should submit faq and send email', async () => {
      const res = await request(app).post('/api/v1/demo/faq').send({
        name: 'Tester',
        email: 'test@example.com',
        query: 'What is the pricing?',
      });
      expect(res.status).toBe(200);
      expect(sendEmail).toHaveBeenCalled();
    });

    it('should hit FAQ rate limit', async () => {
      redis.incr.mockResolvedValueOnce(20);
      const res = await request(app).post('/api/v1/demo/faq').send({
        name: 'Tester',
        email: 'test@example.com',
        query: 'What is the pricing?',
      });
      expect(res.status).toBe(429);
    });

    it('should handle internal errors gracefully in FAQ', async () => {
      redis.incr.mockRejectedValueOnce(new Error('Redis died'));
      // rateLimited catches the error and returns false, so it proceeds to sendEmail
      sendEmail.mockRejectedValueOnce(new Error('Mail died'));
      const res = await request(app).post('/api/v1/demo/faq').send({
        name: 'Tester',
        email: 'test@example.com',
        query: 'What is the pricing?',
      });
      expect(res.status).toBe(500);
    });

    it('should skip FAQ email if no recipient is configured', async () => {
      const originalDemoEmail = process.env.DEMO_RECIPIENT_EMAIL;
      const originalGmail = process.env.GMAIL_USER;
      delete process.env.DEMO_RECIPIENT_EMAIL;
      delete process.env.GMAIL_USER;

      const res = await request(app).post('/api/v1/demo/faq').send({
        name: 'Tester',
        email: 'test@example.com',
        query: 'What is the pricing?',
      });
      
      expect(res.status).toBe(200);
      expect(sendEmail).not.toHaveBeenCalled();

      process.env.DEMO_RECIPIENT_EMAIL = originalDemoEmail;
      process.env.GMAIL_USER = originalGmail;
    });
  });
});
