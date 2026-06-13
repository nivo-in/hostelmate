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
  single: jest.fn().mockReturnThis(),
  not: jest.fn().mockReturnThis(),
  is: jest.fn().mockReturnThis(),
  head: jest.fn().mockReturnThis(),
  then: jest.fn(function (resolve) {
    resolve(queryResults.shift() || { data: null, error: null });
  }),
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

const mockRedisGet = jest.fn().mockResolvedValue(null);
const mockRedisSet = jest.fn().mockResolvedValue('OK');

jest.unstable_mockModule('../config/redis.js', () => ({
  getCache: jest.fn().mockResolvedValue(null),
  setCache: jest.fn().mockResolvedValue(true),
  deleteCache: jest.fn().mockResolvedValue(true),
  deleteCachePattern: jest.fn().mockResolvedValue(true),
  publishEvent: jest.fn().mockResolvedValue(true),
  redis: {
    get: mockRedisGet,
    set: mockRedisSet,
  },
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

describe('Curfew API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    currentProfile = mockWardenProfile;
    queryResults = [];
    mockRedisGet.mockResolvedValue(null);
    mockRedisSet.mockResolvedValue('OK');

    // Set time to 23:00 (11 PM) to bypass curfew check
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-31T23:30:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('GET /api/curfew/violations', () => {
    /**
     * Test: should return students absent after curfew
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should return students absent after curfew', async () => {
      mockRedisGet.mockResolvedValueOnce(JSON.stringify({ curfew_time: '00:00', enabled: true }));
      queryResults = [
        {
          data: [
            { id: 's1', profiles: { full_name: 'Absent Student' } },
            { id: 's2', profiles: { full_name: 'Present Student' } },
          ],
          error: null,
        }, // students query
        { data: [{ student_id: 's2' }], error: null }, // attendance query
      ];

      const res = await request(app).get('/api/v1/curfew/violations');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].student_id).toBe('s1');
    });

    /**
     * Test: should return empty if before curfew time
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should return empty if before curfew time', async () => {
      mockRedisGet.mockResolvedValueOnce(JSON.stringify({ curfew_time: '23:59', enabled: true }));

      const res = await request(app).get('/api/v1/curfew/violations');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });

    /**
     * Test: should return empty if curfew is disabled
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should return empty if curfew is disabled', async () => {
      mockRedisGet.mockResolvedValueOnce(JSON.stringify({ curfew_time: '00:00', enabled: false }));

      const res = await request(app).get('/api/v1/curfew/violations');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });
  });

  describe('POST /api/curfew/notify', () => {
    /**
     * Test: should notify parents of absent students
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should notify parents of absent students', async () => {
      queryResults = [
        { data: { profiles: { full_name: 'Student 1' } }, error: null }, // student single query
        { error: null }, // notices insert
      ];

      const res = await request(app)
        .post('/api/v1/curfew/notify')
        .send({ student_ids: ['s1'] });
      expect(res.status).toBe(200);
      expect(res.body.notified_count).toBe(1);
    });

    it('should reject invalid payload', async () => {
      const res = await request(app)
        .post('/api/v1/curfew/notify')
        .send({ student_ids: 'not-an-array' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/curfew/settings', () => {
    it('should return default settings if no cache', async () => {
      const res = await request(app).get('/api/v1/curfew/settings');
      expect(res.status).toBe(200);
      expect(res.body.data.curfew_time).toBe('22:00');
    });

    it('should return cached settings', async () => {
      mockRedisGet.mockResolvedValueOnce(JSON.stringify({ curfew_time: '23:00', enabled: false }));
      const res = await request(app).get('/api/v1/curfew/settings');
      expect(res.status).toBe(200);
      expect(res.body.data.curfew_time).toBe('23:00');
      expect(res.body.data.enabled).toBe(false);
    });
  });

  describe('PATCH /api/curfew/settings', () => {
    it('should update curfew settings', async () => {
      const res = await request(app)
        .patch('/api/v1/curfew/settings')
        .send({ curfew_time: '21:00', enabled: true });
      expect(res.status).toBe(200);
      expect(res.body.data.curfew_time).toBe('21:00');
      expect(mockRedisSet).toHaveBeenCalled();
    });
  });
});
