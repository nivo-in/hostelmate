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
  is: jest.fn().mockReturnThis(),
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

let currentProfile = mockStudentProfile;

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

describe('Leaves API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    currentProfile = mockStudentProfile;
    supabaseMock.single.mockResolvedValue({ data: { id: 'leave-1' }, error: null });
    supabaseMock.select.mockReturnThis();
  });

  describe('POST /api/leaves - Student submits leave', () => {
    /**
     * Test: should reject leave with missing fields
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should reject leave with missing fields', async () => {
      const res = await request(app).post('/api/v1/leaves').send({});
      expect(res.status).toBe(400);
    });

    /**
     * Test: should reject leave with past start_date
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should reject leave with past start_date', async () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      const futureDate = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      const res = await request(app).post('/api/v1/leaves').send({
        start_date: pastDate,
        end_date: futureDate,
        reason: 'Valid reason of 20 chars......',
      });
      expect(res.status).toBe(400);
    });

    /**
     * Test: should reject leave with end_date before start_date
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should reject leave with end_date before start_date', async () => {
      const futureDate1 = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      const futureDate2 = new Date(Date.now() + 172800000).toISOString().split('T')[0];
      const res = await request(app).post('/api/v1/leaves').send({
        start_date: futureDate2,
        end_date: futureDate1,
        reason: 'Valid reason of 20 chars......',
      });
      expect(res.status).toBe(400);
    });

    /**
     * Test: should reject reason shorter than 20 characters
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should reject reason shorter than 20 characters', async () => {
      const futureDate1 = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      const futureDate2 = new Date(Date.now() + 172800000).toISOString().split('T')[0];
      const res = await request(app).post('/api/v1/leaves').send({
        start_date: futureDate1,
        end_date: futureDate2,
        reason: 'short',
      });
      expect(res.status).toBe(400);
    });

    it('should accept valid leave request', async () => {
      const futureDate1 = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      const futureDate2 = new Date(Date.now() + 172800000).toISOString().split('T')[0];

      supabaseMock.single.mockResolvedValueOnce({ data: { id: 'leave-new' }, error: null });

      const res = await request(app).post('/api/v1/leaves').send({
        start_date: futureDate1,
        end_date: futureDate2,
        reason: 'Valid reason of 20 chars......',
      });
      expect(res.status).toBe(200);
    });

    it('should return 401 without auth token', async () => {
      currentProfile = null;
      const res = await request(app).post('/api/v1/leaves').send({});
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/leaves/my - Student views own leaves', () => {
    it('should return student own leaves', async () => {
      supabaseMock.order.mockResolvedValueOnce({ data: [{ id: '1' }], error: null });
      const res = await request(app).get('/api/v1/leaves/my');
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([{ id: '1' }]);
    });

    it('should respect the limit query parameter for student leaves', async () => {
      supabaseMock.order.mockResolvedValueOnce({ data: [], error: null });
      const res = await request(app).get('/api/v1/leaves/my?limit=5');
      expect(res.status).toBe(200);
      expect(supabaseMock.limit).toHaveBeenCalledWith(5);
    });

    it('should return empty array if no leaves', async () => {
      supabaseMock.order.mockResolvedValueOnce({ data: [], error: null });
      const res = await request(app).get('/api/v1/leaves/my');
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('should handle DB errors gracefully', async () => {
      supabaseMock.order.mockResolvedValueOnce({ data: null, error: new Error('DB error') });
      const res = await request(app).get('/api/v1/leaves/my');
      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/internal/i);
    });

    it('should return 401 without auth', async () => {
      currentProfile = null;
      const res = await request(app).get('/api/v1/leaves/my');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/leaves/all - Warden views all leaves', () => {
    it('should return all leave requests for warden', async () => {
      currentProfile = mockWardenProfile;
      supabaseMock.range.mockResolvedValueOnce({ data: [{ id: '1' }], error: null });
      const res = await request(app).get('/api/v1/leaves/all');
      expect(res.status).toBe(200);
    });

    it('should return 403 for student role', async () => {
      const res = await request(app).get('/api/v1/leaves/all');
      expect(res.status).toBe(403);
    });
  });

  describe('PATCH /api/leaves/:id/approve - Warden approves', () => {
    it('should approve leave and return updated record', async () => {
      currentProfile = mockWardenProfile;
      supabaseMock.single.mockResolvedValue({ data: { id: '1', status: 'approved' }, error: null });
      const res = await request(app).patch('/api/v1/leaves/1/approve');
      expect(res.status).toBe(200);
    });

    it('should return 403 for student role', async () => {
      const res = await request(app).patch('/api/v1/leaves/1/approve');
      expect(res.status).toBe(403);
    });

    it('should return 404 for non-existent leave id', async () => {
      currentProfile = mockWardenProfile;
      supabaseMock.single.mockResolvedValue({ data: null, error: null });
      const res = await request(app).patch('/api/v1/leaves/999/approve');
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/leaves/:id/reject - Warden rejects', () => {
    it('should reject leave and return updated record', async () => {
      currentProfile = mockWardenProfile;
      supabaseMock.single.mockResolvedValue({ data: { id: '1', status: 'rejected' }, error: null });
      const res = await request(app).patch('/api/v1/leaves/1/reject');
      expect(res.status).toBe(200);
    });

    it('should return 403 for student role', async () => {
      const res = await request(app).patch('/api/v1/leaves/1/reject');
      expect(res.status).toBe(403);
    });
  });
});
