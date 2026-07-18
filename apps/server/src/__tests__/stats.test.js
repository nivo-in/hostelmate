import { jest } from '@jest/globals';
import request from 'supertest';

let queryResults = [];
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
  head: jest.fn().mockReturnThis(),
  then: jest.fn((resolve) => resolve(queryResults.shift() || { data: [], count: 0, error: null })),
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

describe('Stats API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    currentProfile = mockWardenProfile;
    queryResults = [];
  });

  describe('GET /api/stats/dashboard - Warden', () => {
    /**
     * Test: GET /api/v1/stats/dashboard should return dashboard stats
     * Verifies behaviour under correct inputs and constraints.
     */
    it('GET /api/v1/stats/dashboard should return dashboard stats', async () => {
      queryResults = [
        { count: 100 }, // totalStudents
        { count: 90 }, // presentToday
        { count: 5 }, // pendingLeaves
        { count: 10 }, // approvedLeavesMonth
        { count: 2 }, // rejectedLeavesMonth
        { count: 3 }, // openComplaints
        { count: 2 }, // inProgressComplaints
        { count: 15 }, // resolvedComplaintsMonth
        { count: 4 }, // totalActiveNotices
        { data: [{ status: 'lost' }, { status: 'found' }, { status: 'claimed' }] }, // lostFoundData
      ];

      const res = await request(app).get('/api/v1/stats/dashboard');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.attendance.today_present).toBe(90);
      expect(res.body.data.attendance.today_percentage).toBe(90);
    });

    /**
     * Test: should return 403 for student
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should return 403 for student', async () => {
      currentProfile = mockStudentProfile;
      const res = await request(app).get('/api/v1/stats/dashboard');
      expect(res.status).toBe(403);
    });

    /**
     * Test: should return 401 without auth
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should return 401 without auth', async () => {
      currentProfile = null;
      const res = await request(app).get('/api/v1/stats/dashboard');
      expect(res.status).toBe(401);
    });

    it('should return cached data if available', async () => {
      const { getCache } = await import('../config/redis.js');
      getCache.mockResolvedValueOnce({ attendance: { today_present: 50 } });

      const res = await request(app).get('/api/v1/stats/dashboard');
      expect(res.status).toBe(200);
      expect(res.body.data.attendance.today_present).toBe(50);
    });
  });
});
