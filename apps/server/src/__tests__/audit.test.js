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
  single: jest.fn().mockReturnThis(),
  not: jest.fn().mockReturnThis(),
  is: jest.fn().mockReturnThis(),
  head: jest.fn().mockReturnThis(),
  then: jest.fn(function (resolve) {
    resolve(queryResults.shift());
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

describe('Audit API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    currentProfile = mockWardenProfile;
    queryResults = [];
  });

  describe('GET /api/audit', () => {
    it('should return audit logs without filters', async () => {
      queryResults = [{ data: [{ id: 1, action: 'login', resource: 'auth' }], error: null }];

      const res = await request(app).get('/api/v1/audit');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('should filter by resource and action', async () => {
      queryResults = [{ data: [{ id: 2, action: 'create', resource: 'room' }], error: null }];

      const res = await request(app).get('/api/v1/audit?resource=room&action=create');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('should reject non-warden access', async () => {
      currentProfile = mockStudentProfile;
      const res = await request(app).get('/api/v1/audit');
      expect(res.status).toBe(403);
    });
  });
});
