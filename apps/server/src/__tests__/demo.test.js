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
    it('should require a valid email', async () => {
      const res = await request(app).post('/api/v1/demo/send-otp').send({ email: 'invalid' });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should send otp on valid email', async () => {
      const res = await request(app)
        .post('/api/v1/demo/send-otp')
        .send({ email: 'test@example.com' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(sendEmail).toHaveBeenCalled();
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
  });

  describe('POST /api/demo/submit', () => {
    it('should fail if no valid verified token exists', async () => {
      redis.get.mockResolvedValueOnce(null);
      const res = await request(app)
        .post('/api/v1/demo/submit')
        .send({ email: 'test@example.com', token: 'fake-token' });
      expect(res.status).toBe(403);
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
  });
});
