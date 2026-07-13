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
  then: jest.fn(function (resolve, reject) {
    const result = queryResults.shift();
    if (result && result.throwMsg) {
      reject(new Error(result.throwMsg));
    } else {
      resolve(result);
    }
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

describe('Notifications API Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    currentProfile = mockStudentProfile;
    queryResults = [];
  });

  describe('GET /api/notifications', () => {
    /**
     * Test: should return notifications for authenticated user
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should return notifications for authenticated user', async () => {
      queryResults = [
        { data: [], count: 0, error: null },
        { count: 0, error: null },
      ];
      const res = await request(app).get('/api/v1/notifications');
      expect(res.status).toBe(200);
    });

    /**
     * Test: should return unread_count
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should return unread_count', async () => {
      queryResults = [
        { data: [{ is_read: false }], count: 1, error: null },
        { count: 1, error: null },
      ];
      const res = await request(app).get('/api/v1/notifications');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('unread_count');
      expect(res.body.data.unread_count).toBe(1);
    });

    /**
     * Test: should handle supabase error safely
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should handle supabase error safely', async () => {
      queryResults = [{ data: null, error: new Error('DB Error') }];
      const res = await request(app).get('/api/v1/notifications');
      expect(res.status).toBe(200);
      expect(res.body.data.notifications).toHaveLength(0);
    });

    /**
     * Test: should catch exceptions safely
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should catch exceptions safely', async () => {
      queryResults = [{ throwMsg: 'Network Error' }];
      const res = await request(app).get('/api/v1/notifications');
      expect(res.status).toBe(200);
      expect(res.body.data.notifications).toHaveLength(0);
    });

    /**
     * Test: should respect the limit and page query parameters
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should respect the limit and page query parameters', async () => {
      queryResults = [
        { data: [], count: 0, error: null },
        { count: 0, error: null },
      ];
      const res = await request(app).get('/api/v1/notifications?limit=5&page=2');
      expect(res.status).toBe(200);
      expect(supabaseMock.range).toHaveBeenCalledWith(5, 9);
    });
  });

  describe('PATCH /api/notifications/read-all', () => {
    /**
     * Test: should mark all as read
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should mark all as read', async () => {
      queryResults = [{ error: null }];
      const res = await request(app).patch('/api/v1/notifications/read-all');
      expect(res.status).toBe(200);
    });

    /**
     * Test: should handle errors gracefully
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should handle errors gracefully', async () => {
      queryResults = [{ error: new Error('DB Error') }];
      const res = await request(app).patch('/api/v1/notifications/read-all');
      expect(res.status).toBe(200);
    });

    it('should catch exceptions safely', async () => {
      queryResults = [{ throwMsg: 'Network Error' }];
      const res = await request(app).patch('/api/v1/notifications/read-all');
      expect(res.status).toBe(200);
    });
  });

  describe('PATCH /api/notifications/:id/read', () => {
    it('should mark single notification as read', async () => {
      queryResults = [{ error: null }];
      const res = await request(app).patch('/api/v1/notifications/1/read');
      expect(res.status).toBe(200);
    });

    it('should handle errors gracefully', async () => {
      queryResults = [{ error: new Error('DB Error') }];
      const res = await request(app).patch('/api/v1/notifications/1/read');
      expect(res.status).toBe(200);
    });

    it('should catch exceptions safely', async () => {
      queryResults = [{ throwMsg: 'Network Error' }];
      const res = await request(app).patch('/api/v1/notifications/1/read');
      expect(res.status).toBe(200);
    });
  });

  describe('DELETE /api/notifications/:id', () => {
    it('should delete notification', async () => {
      queryResults = [{ error: null }];
      const res = await request(app).delete('/api/v1/notifications/1');
      expect(res.status).toBe(200);
    });

    it('should handle errors gracefully', async () => {
      queryResults = [{ error: new Error('DB Error') }];
      const res = await request(app).delete('/api/v1/notifications/1');
      expect(res.status).toBe(200);
    });

    it('should catch exceptions safely', async () => {
      queryResults = [{ throwMsg: 'Network Error' }];
      const res = await request(app).delete('/api/v1/notifications/1');
      expect(res.status).toBe(200);
    });
  });
});
