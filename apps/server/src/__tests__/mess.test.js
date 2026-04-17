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

describe('Mess API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    currentProfile = mockStudentProfile;
  });

  describe('GET /api/mess/menu', () => {
    it('should return menu for any authenticated user', async () => {
      supabaseMock.order.mockResolvedValueOnce({ data: [], error: null });
      const res = await request(app).get('/api/v1/mess/menu');
      expect(res.status).toBe(200);
    });

    it('should return 401 without auth', async () => {
      currentProfile = null;
      const res = await request(app).get('/api/v1/mess/menu');
      expect(res.status).toBe(401);
    });

    it('should return cached menu on second request', async () => {
      const { getCache } = await import('../config/redis.js');
      getCache.mockResolvedValueOnce([{ day: 'Monday' }]);
      const res = await request(app).get('/api/v1/mess/menu');
      expect(res.body.data).toEqual([{ day: 'Monday' }]);
    });
  });

  describe('PUT /api/mess/menu - Warden updates', () => {
    it('should update menu item', async () => {
      currentProfile = mockWardenProfile;
      supabaseMock.single.mockResolvedValueOnce({ data: { id: '1' }, error: null });
      const res = await request(app)
        .put('/api/v1/mess/menu')
        .send({
          day_of_week: 'monday',
          meal_type: 'lunch',
          items: ['rice', 'dal'],
        });
      expect(res.status).toBe(200);
    });

    it('should reject invalid day_of_week', async () => {
      currentProfile = mockWardenProfile;
      const res = await request(app)
        .put('/api/v1/mess/menu')
        .send({
          day_of_week: 'invalid',
          meal_type: 'lunch',
          items: ['rice'],
        });
      expect(res.status).toBe(400);
    });

    it('should reject invalid meal_type', async () => {
      currentProfile = mockWardenProfile;
      const res = await request(app)
        .put('/api/v1/mess/menu')
        .send({
          day_of_week: 'monday',
          meal_type: 'invalid',
          items: ['rice'],
        });
      expect(res.status).toBe(400);
    });

    it('should return 403 for student', async () => {
      const res = await request(app)
        .put('/api/v1/mess/menu')
        .send({
          day_of_week: 'monday',
          meal_type: 'lunch',
          items: ['rice'],
        });
      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/mess/review - Student rates', () => {
    it('should accept valid review', async () => {
      supabaseMock.single.mockResolvedValueOnce({ data: { id: '1' }, error: null });
      const res = await request(app).post('/api/v1/mess/review').send({
        rating: 4,
        meal_type: 'lunch',
        comments: 'good',
        date: '2023-10-10',
      });
      expect(res.status).toBe(200);
    });

    it('should reject rating below 1', async () => {
      const res = await request(app).post('/api/v1/mess/review').send({
        rating: 0,
        meal_type: 'lunch',
        date: '2023-10-10',
      });
      expect(res.status).toBe(400);
    });

    it('should reject rating above 5', async () => {
      const res = await request(app).post('/api/v1/mess/review').send({
        rating: 6,
        meal_type: 'lunch',
        date: '2023-10-10',
      });
      expect(res.status).toBe(400);
    });

    it('should return 403 for warden', async () => {
      currentProfile = mockWardenProfile;
      const res = await request(app).post('/api/v1/mess/review').send({
        rating: 4,
        meal_type: 'lunch',
        date: '2023-10-10',
      });
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/mess/reviews - Warden views', () => {
    it('should return reviews with averages', async () => {
      currentProfile = mockWardenProfile;
      supabaseMock.order.mockResolvedValueOnce({ data: [], error: null });
      const res = await request(app).get('/api/v1/mess/reviews');
      expect(res.status).toBe(200);
    });

    it('should respect the limit query parameter', async () => {
      currentProfile = mockWardenProfile;
      supabaseMock.order.mockResolvedValueOnce({ data: [], error: null });
      const res = await request(app).get('/api/v1/mess/reviews?limit=5');
      expect(res.status).toBe(200);
      expect(supabaseMock.limit).toHaveBeenCalledWith(5);
    });

    it('should return 403 for student', async () => {
      const res = await request(app).get('/api/v1/mess/reviews');
      expect(res.status).toBe(403);
    });
  });
});
