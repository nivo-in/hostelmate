import { jest } from '@jest/globals';
import request from 'supertest';

const supabaseMock = {
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  upsert: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  neq: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  lte: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  range: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: null, error: null }),
  head: jest.fn().mockResolvedValue({ count: 0, error: null }),
};

jest.unstable_mockModule('../config/supabase.js', () => ({
  supabaseAdmin: {
    from: jest.fn(() => supabaseMock),
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null,
      }),
    },
  },
}));

jest.unstable_mockModule('../config/redis.js', () => ({
  getCache: jest.fn().mockResolvedValue(null),
  setCache: jest.fn().mockResolvedValue(true),
  deleteCache: jest.fn().mockResolvedValue(true),
  deleteCachePattern: jest.fn().mockResolvedValue(true),
  publishEvent: jest.fn().mockResolvedValue(true),
  redis: {},
}));

jest.unstable_mockModule('../config/logger.js', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), http: jest.fn() },
}));

jest.unstable_mockModule('../config/socket.js', () => ({
  emitToUser: jest.fn(),
  emitToAll: jest.fn(),
  getIO: jest.fn(),
  initSocket: jest.fn(),
}));

const mockWardenProfile = {
  id: 'warden-id',
  role: 'warden',
  email: 'warden@test.com',
  full_name: 'Test Warden',
};
const mockStudentProfile = {
  id: 'student-id',
  role: 'student',
  email: 'student@test.com',
  full_name: 'Test Student',
};

let currentProfile = mockWardenProfile;

jest.unstable_mockModule('../middleware/rateLimit.js', () => ({
  generalLimiter: (req, res, next) => next(),
  authLimiter: (req, res, next) => next(),
  notificationLimiter: (req, res, next) => next(),
}));

jest.unstable_mockModule('../middleware/auth.js', () => ({
  authenticate: (req, res, next) => {
    if (!currentProfile) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    req.user = { id: currentProfile.id };
    req.profile = currentProfile;
    next();
  },
}));

const { default: app } = await import('../index.js');
const { supabaseAdmin } = await import('../config/supabase.js');

describe('Notices API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    currentProfile = mockWardenProfile;
  });

  describe('POST /api/notices - Warden posts', () => {
    /**
     * Test: should reject notice with short title
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should reject notice with short title', async () => {
      const res = await request(app).post('/api/v1/notices').send({
        title: 'ab',
        content: 'valid content 20 chars......',
        target_audience: 'all',
      });
      expect(res.status).toBe(400);
    });

    /**
     * Test: should reject invalid target_audience
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should reject invalid target_audience', async () => {
      const res = await request(app).post('/api/v1/notices').send({
        title: 'valid title',
        content: 'valid content 20 chars......',
        target_audience: 'invalid',
      });
      expect(res.status).toBe(400);
    });

    /**
     * Test: should accept valid notice
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should accept valid notice', async () => {
      // Return notice data on insert
      supabaseMock.single.mockResolvedValueOnce({ data: { id: '1' }, error: null });
      // Return users for notification
      supabaseMock.in.mockResolvedValueOnce({ data: [{ id: 'u1' }, { id: 'u2' }] });
      
      const res = await request(app).post('/api/v1/notices').send({
        title: 'valid title',
        content: 'valid content 20 chars......',
        target_audience: 'all',
        priority: 'normal',
      });
      expect(res.status).toBe(200);
    });

    /**
     * Test: should return 403 for student
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should return 403 for student', async () => {
      currentProfile = mockStudentProfile;
      const res = await request(app).post('/api/v1/notices').send({
        title: 'valid title',
        content: 'valid content 20 chars......',
        target_audience: 'all',
      });
      expect(res.status).toBe(403);
    });

    /**
     * Test: should accept notice targeting students
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should accept notice targeting students', async () => {
      currentProfile = mockWardenProfile;
      supabaseMock.single.mockResolvedValueOnce({ data: { id: '2' }, error: null });
      supabaseMock.in.mockResolvedValueOnce({ data: [{ id: 'u1' }] });
      const res = await request(app).post('/api/v1/notices').send({
        title: 'valid title',
        content: 'valid content 20 chars......',
        target_audience: 'students',
      });
      expect(res.status).toBe(200);
    });

    /**
     * Test: should accept notice targeting parents
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should accept notice targeting parents', async () => {
      currentProfile = mockWardenProfile;
      supabaseMock.single.mockResolvedValueOnce({ data: { id: '3' }, error: null });
      supabaseMock.in.mockResolvedValueOnce({ data: [{ id: 'u2' }] });
      const res = await request(app).post('/api/v1/notices').send({
        title: 'valid title',
        content: 'valid content 20 chars......',
        target_audience: 'parents',
      });
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/notices - Any authenticated user', () => {
    it('should return notices for student (filtered)', async () => {
      currentProfile = mockStudentProfile;
      supabaseMock.limit.mockResolvedValueOnce({ data: [], error: null });
      const res = await request(app).get('/api/v1/notices');
      expect(res.status).toBe(200);
    });

    it('should return all notices for warden', async () => {
      supabaseMock.limit.mockResolvedValueOnce({ data: [], error: null });
      const res = await request(app).get('/api/v1/notices');
      expect(res.status).toBe(200);
    });

    it('should return notices for parent (filtered)', async () => {
      currentProfile = { id: 'parent-id', role: 'parent', email: 'parent@test.com' };
      supabaseMock.limit.mockResolvedValueOnce({ data: [], error: null });
      const res = await request(app).get('/api/v1/notices');
      expect(res.status).toBe(200);
    });

    it('should return 401 without auth', async () => {
      currentProfile = null;
      const res = await request(app).get('/api/v1/notices');
      expect(res.status).toBe(401);
    });
  });
});
