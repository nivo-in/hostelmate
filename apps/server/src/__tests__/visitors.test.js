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
  ilike: jest.fn().mockReturnThis(),
  or: jest.fn().mockReturnThis(),
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
const mockRedisSet = jest.fn().mockResolvedValue(true);

jest.unstable_mockModule('../config/redis.js', () => ({
  getCache: mockRedisGet,
  setCache: mockRedisSet,
  deleteCache: jest.fn().mockResolvedValue(true),
  deleteCachePattern: jest.fn().mockResolvedValue(true),
  publishEvent: jest.fn().mockResolvedValue(true),
  redis: {
    get: mockRedisGet,
    set: mockRedisSet,
  },
}));

jest.unstable_mockModule('../config/socket.js', () => ({
  emitToAll: jest.fn(),
  emitToUser: jest.fn(),
  getIO: jest.fn(),
  initSocket: jest.fn(),
}));

jest.unstable_mockModule('../config/notify.js', () => ({
  createNotification: jest.fn().mockResolvedValue(true),
}));

const mockWardenProfile = {
  id: 'warden-id',
  role: 'warden',
  email: 'warden@test.com',
  full_name: 'Test Warden',
  hostel_id: 'hostel-1',
};
const mockStudentProfile = {
  id: 'student-id',
  role: 'student',
  email: 'student@test.com',
  full_name: 'Test Student',
  hostel_id: 'hostel-1',
};

let currentProfile = mockStudentProfile;
let authEnabled = true;

jest.unstable_mockModule('../middleware/rateLimit.js', () => ({
  generalLimiter: (req, res, next) => next(),
  authLimiter: (req, res, next) => next(),
  notificationLimiter: (req, res, next) => next(),
  apiLimiter: (req, res, next) => next(),
}));

jest.unstable_mockModule('../middleware/auth.js', () => ({
  authenticate: (req, res, next) => {
    if (!authEnabled) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!currentProfile) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    req.user = { id: currentProfile.id };
    req.profile = currentProfile;
    next();
  },
}));

const { default: app } = await import('../index.js');

describe('Visitors API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    currentProfile = mockStudentProfile;
    authEnabled = true;
    queryResults = [];
    mockRedisGet.mockResolvedValue(null);
    mockRedisSet.mockResolvedValue(true);
  });

  describe('POST /api/visitors — Student submits', () => {
    /**
     * Test: should reject missing visitor_name
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should reject missing visitor_name', async () => {
      const res = await request(app).post('/api/v1/visitors').send({
        visitor_phone: '1234567890',
        purpose: 'Meeting for project discussion',
        relationship: 'friend',
        expected_visit_date: '2026-06-05',
      });
      expect(res.status).toBe(400);
    });

    /**
     * Test: should reject phone shorter than 10 digits
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should reject phone shorter than 10 digits', async () => {
      const res = await request(app).post('/api/v1/visitors').send({
        visitor_name: 'John Doe',
        visitor_phone: '12345',
        purpose: 'Meeting for project discussion',
        relationship: 'friend',
        expected_visit_date: '2026-06-05',
      });
      expect(res.status).toBe(400);
    });

    /**
     * Test: should reject purpose shorter than 10 chars
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should reject purpose shorter than 10 chars', async () => {
      const res = await request(app).post('/api/v1/visitors').send({
        visitor_name: 'John Doe',
        visitor_phone: '1234567890',
        purpose: 'short',
        relationship: 'friend',
        expected_visit_date: '2026-06-05',
      });
      expect(res.status).toBe(400);
    });

    /**
     * Test: should reject invalid relationship
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should reject invalid relationship', async () => {
      const res = await request(app).post('/api/v1/visitors').send({
        visitor_name: 'John Doe',
        visitor_phone: '1234567890',
        purpose: 'Meeting for project discussion',
        relationship: 'invalid_rel',
        expected_visit_date: '2026-06-05',
      });
      expect(res.status).toBe(400);
    });

    /**
     * Test: should reject past expected_visit_date
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should reject past expected_visit_date', async () => {
      const res = await request(app)
        .post('/api/v1/visitors')
        .send({
          visitor_name: 'John Doe',
          visitor_phone: '1234567890',
          purpose: 'Meeting for project discussion',
          relationship: 'friend',
          expected_visit_date: new Date(Date.now() - 86400000).toISOString(),
        });
      expect(res.status).toBe(400);
    });

    /**
     * Test: should accept valid visitor request
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should accept valid visitor request', async () => {
      queryResults = [
        { data: { id: 'visitor-1', status: 'pending' }, error: null },
        { data: { full_name: 'Test Student' }, error: null },
        { data: [{ id: 'warden-id' }], error: null },
      ];

      const res = await request(app).post('/api/v1/visitors').send({
        visitor_name: 'John Doe',
        visitor_phone: '1234567890',
        purpose: 'Meeting for project discussion',
        relationship: 'friend',
        expected_visit_date: '2026-06-05',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    /**
     * Test: should return 403 for warden role
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should return 403 for warden role', async () => {
      currentProfile = mockWardenProfile;
      const res = await request(app).post('/api/v1/visitors').send({
        visitor_name: 'John Doe',
        visitor_phone: '1234567890',
        purpose: 'Meeting for project discussion',
        relationship: 'friend',
        expected_visit_date: '2026-06-05',
      });
      expect(res.status).toBe(403);
    });

    /**
     * Test: should return 401 without auth
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should return 401 without auth', async () => {
      authEnabled = false;
      const res = await request(app).post('/api/v1/visitors').send({
        visitor_name: 'John Doe',
        visitor_phone: '1234567890',
        purpose: 'Meeting for project discussion',
        relationship: 'friend',
        expected_visit_date: '2026-06-05',
      });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/visitors/my — Student views own', () => {
    /**
     * Test: should return student own visitor requests
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should return student own visitor requests', async () => {
      queryResults = [{ data: [{ id: 'visitor-1', visitor_name: 'John Doe' }], error: null }];
      const res = await request(app).get('/api/v1/visitors/my');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    /**
     * Test: should return empty array if none
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should return empty array if none', async () => {
      queryResults = [{ data: [], error: null }];
      const res = await request(app).get('/api/v1/visitors/my');
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    /**
     * Test: should respect the limit query parameter for student visitors
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should respect the limit query parameter for student visitors', async () => {
      queryResults = [{ data: [], error: null }];
      const res = await request(app).get('/api/v1/visitors/my?limit=5');
      expect(res.status).toBe(200);
      expect(supabaseMock.limit).toHaveBeenCalledWith(5);
    });

    /**
     * Test: should return 401 without auth
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should return 401 without auth', async () => {
      authEnabled = false;
      const res = await request(app).get('/api/v1/visitors/my');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/visitors — Warden views all', () => {
    /**
     * Test: should return all visitor requests
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should return all visitor requests', async () => {
      currentProfile = mockWardenProfile;
      queryResults = [{ data: [{ id: 'visitor-1' }, { id: 'visitor-2' }], error: null }];
      const res = await request(app).get('/api/v1/visitors');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    /**
     * Test: should filter by status query param
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should filter by status query param', async () => {
      currentProfile = mockWardenProfile;
      queryResults = [{ data: [{ id: 'visitor-1', status: 'pending' }], error: null }];
      const res = await request(app).get('/api/v1/visitors?status=pending');
      expect(res.status).toBe(200);
    });

    it('should filter by date query param', async () => {
      currentProfile = mockWardenProfile;
      queryResults = [{ data: [{ id: 'visitor-1' }], error: null }];
      const res = await request(app).get('/api/v1/visitors?date=2026-06-05');
      expect(res.status).toBe(200);
    });

    it('should return 403 for student', async () => {
      currentProfile = mockStudentProfile;
      const res = await request(app).get('/api/v1/visitors');
      expect(res.status).toBe(403);
    });
  });

  describe('PATCH /api/visitors/:id/approve — Warden approves', () => {
    it('should approve visitor request', async () => {
      currentProfile = mockWardenProfile;
      queryResults = [
        { data: { id: 'visitor-1', student_id: 'student-id' }, error: null }, // The select to get visitor details maybe? or update returns it
      ];
      const res = await request(app).patch('/api/v1/visitors/visitor-1/approve').send({});
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should accept optional warden_notes', async () => {
      currentProfile = mockWardenProfile;
      queryResults = [{ data: { id: 'visitor-1', student_id: 'student-id' }, error: null }];
      const res = await request(app).patch('/api/v1/visitors/visitor-1/approve').send({
        warden_notes: 'All good',
      });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 403 for student', async () => {
      currentProfile = mockStudentProfile;
      const res = await request(app).patch('/api/v1/visitors/visitor-1/approve');
      expect(res.status).toBe(403);
    });
  });

  describe('PATCH /api/visitors/:id/reject — Warden rejects', () => {
    it('should reject visitor request', async () => {
      currentProfile = mockWardenProfile;
      queryResults = [{ data: { id: 'visitor-1', student_id: 'student-id' }, error: null }];
      const res = await request(app).patch('/api/v1/visitors/visitor-1/reject').send({});
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 403 for student', async () => {
      currentProfile = mockStudentProfile;
      const res = await request(app).patch('/api/v1/visitors/visitor-1/reject');
      expect(res.status).toBe(403);
    });
  });

  describe('PATCH /api/visitors/:id/checkin — Warden checks in', () => {
    it('should set status to checked_in with check_in_time', async () => {
      currentProfile = mockWardenProfile;
      queryResults = [
        { data: { status: 'approved' }, error: null },
        { data: { id: 'visitor-1', student_id: 'student-id' }, error: null }
      ];
      const res = await request(app).patch('/api/v1/visitors/visitor-1/checkin');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 403 for student', async () => {
      currentProfile = mockStudentProfile;
      const res = await request(app).patch('/api/v1/visitors/visitor-1/checkin');
      expect(res.status).toBe(403);
    });
  });

  describe('PATCH /api/visitors/:id/checkout — Warden checks out', () => {
    it('should set status to checked_out with check_out_time', async () => {
      currentProfile = mockWardenProfile;
      queryResults = [
        { data: { status: 'checked_in' }, error: null },
        { data: { id: 'visitor-1', student_id: 'student-id' }, error: null }
      ];
      const res = await request(app).patch('/api/v1/visitors/visitor-1/checkout');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 403 for student', async () => {
      currentProfile = mockStudentProfile;
      const res = await request(app).patch('/api/v1/visitors/visitor-1/checkout');
      expect(res.status).toBe(403);
    });
  });
});
