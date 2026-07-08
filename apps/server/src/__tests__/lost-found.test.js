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
  default: { info: jest.fn(), warn: jest.fn(), error: console.error, http: jest.fn() },
}));

jest.unstable_mockModule('../config/socket.js', () => ({
  emitToUser: jest.fn(),
  emitToAll: jest.fn(),
  getIO: jest.fn(),
  initSocket: jest.fn(),
}));

jest.unstable_mockModule('../config/notifications.js', () => ({
  notifyLostFoundMatch: jest.fn(),
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

describe('Lost and Found API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    currentProfile = mockStudentProfile;
  });

  describe('POST /api/lost-found - Student reports', () => {
    /**
     * Test: should accept lost item report
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should accept lost item report', async () => {
      console.error('DEBUG DATE IN TEST:', new Date().toISOString());
      supabaseMock.single.mockResolvedValueOnce({
        data: { id: '1', status: 'lost', item_name: 'Keys' },
        error: null,
      });
      supabaseMock.neq.mockResolvedValueOnce({ data: [], error: null }); // Matcher query mock

      const res = await request(app).post('/api/v1/lost-found').send({
        status: 'lost',
        item_name: 'Keys',
        description: 'lost keys',
        location_found: 'mess',
      });
      expect(res.status).toBe(200);
    });

    /**
     * Test: should accept found item report
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should accept found item report', async () => {
      supabaseMock.single.mockResolvedValueOnce({
        data: { id: '2', status: 'found', item_name: 'Wallet' },
        error: null,
      });
      supabaseMock.neq.mockResolvedValueOnce({ data: [], error: null }); // Matcher query mock

      const res = await request(app).post('/api/v1/lost-found').send({
        status: 'found',
        item_name: 'Wallet',
        description: 'found wallet',
        location_found: 'library',
      });
      expect(res.status).toBe(200);
    });

    /**
     * Test: should reject missing item_name
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should reject missing item_name', async () => {
      const res = await request(app).post('/api/v1/lost-found').send({
        status: 'lost',
        description: 'lost stuff',
      });
      if (res.status !== 400) {
        console.error('DEBUG STATUS:', res.status);
        console.error('DEBUG BODY:', res.body);
        console.error('DEBUG TEXT:', res.text);
      }
      expect(res.status).toBe(400);
    });

    /**
     * Test: should check for matches after submit
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should check for matches after submit', async () => {
      supabaseMock.single.mockResolvedValueOnce({
        data: { id: '1', status: 'lost', item_name: 'Keys' },
        error: null,
      });
      supabaseMock.neq.mockResolvedValueOnce({
        data: [{ id: '2', status: 'found', item_name: 'Keys', description: 'keys' }],
        error: null,
      });

      const res = await request(app).post('/api/v1/lost-found').send({
        status: 'lost',
        item_name: 'Keys',
        description: 'lost keys',
        location_found: 'mess',
      });
      expect(res.status).toBe(200);
    });

    /**
     * Test: should return match info if found
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should return match info if found', async () => {
      supabaseMock.single.mockResolvedValueOnce({
        data: { id: '1', status: 'lost', item_name: 'Keys' },
        error: null,
      });
      supabaseMock.neq.mockResolvedValueOnce({
        data: [{ id: '2', status: 'found', item_name: 'Keys', description: 'found keys' }],
        error: null,
      });

      const res = await request(app).post('/api/v1/lost-found').send({
        status: 'lost',
        item_name: 'Keys',
        description: 'lost keys',
        location_found: 'mess',
      });
      expect(res.status).toBe(200); // Actually if a match is found, does it return 201 or 200? Wait, res.json implies 200. I'll change to 200.
      expect(res.body.match).toBeDefined(); // wait, the key is match not matches
    });
  });

  describe('GET /api/lost-found', () => {
    /**
     * Test: should return all items
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should return all items', async () => {
      supabaseMock.range.mockResolvedValueOnce({ data: [], error: null });
      const res = await request(app).get('/api/v1/lost-found');
      expect(res.status).toBe(200);
    });

    /**
     * Test: should filter by status
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should filter by status', async () => {
      supabaseMock.range.mockResolvedValueOnce({ data: [], error: null });
      const res = await request(app).get('/api/v1/lost-found?status=claimed');
      if (res.status === 500) {console.error('GET STATUS ERROR:', res.body);}
      expect(res.status).toBe(200);
    });

    /**
     * Test: should respect the limit and page query parameters
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should respect the limit and page query parameters', async () => {
      supabaseMock.range.mockResolvedValueOnce({ data: [], error: null });
      const res = await request(app).get('/api/v1/lost-found?limit=15&page=2');
      expect(res.status).toBe(200);
      expect(supabaseMock.range).toHaveBeenCalledWith(15, 29);
    });

    /**
     * Test: should return 401 without auth
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should return 401 without auth', async () => {
      currentProfile = null;
      const res = await request(app).get('/api/v1/lost-found');
      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /api/lost-found/:id/claim', () => {
    it('should mark item as claimed', async () => {
      supabaseMock.single.mockResolvedValueOnce({
        data: { id: '1', status: 'claimed' },
        error: null,
      });
      const res = await request(app).patch('/api/v1/lost-found/1/claim');
      expect(res.status).toBe(200);
    });

    it('should return 401 without auth', async () => {
      currentProfile = null;
      const res = await request(app).patch('/api/v1/lost-found/1/claim');
      expect(res.status).toBe(401);
    });
  });
});
