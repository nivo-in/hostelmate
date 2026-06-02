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
  single: jest.fn().mockResolvedValue({ data: null, error: null }),
  head: jest.fn().mockResolvedValue({ count: 0, error: null }),
};

jest.unstable_mockModule('../config/supabase.js', () => ({
  supabaseAdmin: {
    from: jest.fn(() => supabaseMock),
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null
      })
    }
  }
}));

jest.unstable_mockModule('../config/redis.js', () => ({
  getCache: jest.fn().mockResolvedValue(null),
  setCache: jest.fn().mockResolvedValue(true),
  deleteCache: jest.fn().mockResolvedValue(true),
  deleteCachePattern: jest.fn().mockResolvedValue(true),
  publishEvent: jest.fn().mockResolvedValue(true),
  redis: {}
}));

jest.unstable_mockModule('../config/logger.js', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), http: jest.fn() }
}));

jest.unstable_mockModule('../config/socket.js', () => ({
  emitToUser: jest.fn(),
  emitToAll: jest.fn(),
  getIO: jest.fn(),
  initSocket: jest.fn()
}));

const mockWardenProfile = { id: 'warden-id', role: 'warden', email: 'warden@test.com', full_name: 'Test Warden' };
const mockStudentProfile = { id: 'student-id', role: 'student', email: 'student@test.com', full_name: 'Test Student' };

let currentProfile = mockWardenProfile;


jest.unstable_mockModule('../middleware/rateLimit.js', () => ({
  generalLimiter: (req, res, next) => next(),
  authLimiter: (req, res, next) => next(),
  notificationLimiter: (req, res, next) => next()
}));

jest.unstable_mockModule('../middleware/auth.js', () => ({
  authenticate: (req, res, next) => {
    if (!currentProfile) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    req.user = { id: currentProfile.id };
    req.profile = currentProfile;
    next();
  }
}));

const { default: app } = await import('../index.js');
const { supabaseAdmin } = await import('../config/supabase.js');

describe('Stats API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    currentProfile = mockWardenProfile;
  });

  describe('GET /api/stats/dashboard - Warden', () => {
    it('should return all dashboard stats', async () => {
      supabaseMock.head.mockResolvedValue({ count: 10, error: null });
      supabaseMock.select.mockResolvedValue({ data: [], error: null });
      
      const res = await request(app).get('/api/stats/dashboard');
      expect(res.status).toBe(200);
    });

    it('should return 403 for student', async () => {
      currentProfile = mockStudentProfile;
      const res = await request(app).get('/api/stats/dashboard');
      expect(res.status).toBe(403);
    });

    it('should return 401 without auth', async () => {
      currentProfile = null;
      const res = await request(app).get('/api/stats/dashboard');
      expect(res.status).toBe(401);
    });

    it('should include attendance, leaves, complaints, notices stats', async () => {
      supabaseMock.head.mockResolvedValue({ count: 5, error: null });
      supabaseMock.select.mockResolvedValue({ data: [], error: null });
      
      const res = await request(app).get('/api/stats/dashboard');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('attendance');
      expect(res.body.data).toHaveProperty('leaves');
      expect(res.body.data).toHaveProperty('complaints');
      expect(res.body.data).toHaveProperty('notices');
    });
  });
});
