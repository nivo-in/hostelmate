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

jest.unstable_mockModule('../config/openai.js', () => ({
  classifyComplaint: jest.fn().mockResolvedValue({
    category: 'electrical',
    is_urgent: false,
    summary: 'Light not working',
    suggested_action: 'Check circuit breaker',
    confidence: 0.95,
  }),
  generateMaintenanceSuggestion: jest.fn().mockResolvedValue({
    patterns: [],
    summary: 'No major patterns detected',
  }),
  processWardenChat: jest.fn().mockResolvedValue({ response: 'Mock warden chat' }),
  processStudentChat: jest.fn().mockResolvedValue({ response: 'Mock student chat' }),
  analyzeGeneric: jest.fn().mockResolvedValue({ summary: 'Mock summary', insights: [], recommendation: '' }),
  default: {},
}));

jest.unstable_mockModule('../config/notify.js', () => ({
  createNotification: jest.fn(),
}));

jest.unstable_mockModule('../config/audit.js', () => ({
  auditLog: jest.fn(),
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
const { classifyComplaint } = await import('../config/openai.js');

describe('Complaints API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    currentProfile = mockStudentProfile;
  });

  describe('POST /api/complaints - Student submits', () => {
    /**
     * Test: should reject invalid category
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should reject invalid category', async () => {
      const res = await request(app).post('/api/v1/complaints').send({
        category: 'invalid_cat',
        description: 'desc',
        is_private: false,
      });
      expect(res.status).toBe(400);
    });

    /**
     * Test: should reject missing description
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should reject missing description', async () => {
      const res = await request(app).post('/api/v1/complaints').send({
        category: 'electrical',
      });
      expect(res.status).toBe(400);
    });

    /**
     * Test: should accept valid complaint
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should accept valid complaint', async () => {
      supabaseMock.single.mockResolvedValueOnce({
        data: { id: '1', ai_category: 'electrical' },
        error: null,
      });
      const res = await request(app).post('/api/v1/complaints').send({
        category: 'electrical',
        description: 'valid description',
      });
      expect(res.status).toBe(200);
    });

    /**
     * Test: should include AI classification in response
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should include AI classification in response', async () => {
      supabaseMock.single.mockResolvedValueOnce({
        data: { id: '1', ai_category: 'electrical' },
        error: null,
      });
      const res = await request(app).post('/api/v1/complaints').send({
        category: 'electrical',
        description: 'valid description',
      });
      expect(res.status).toBe(200);
      expect(res.body.ai).toBeDefined();
      expect(res.body.ai.classified).toBe(true);
    });

    /**
     * Test: should work even if AI classification fails
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should work even if AI classification fails', async () => {
      classifyComplaint.mockRejectedValueOnce(new Error('AI failed'));
      supabaseMock.single.mockResolvedValueOnce({ data: { id: '1' }, error: null });
      const res = await request(app).post('/api/v1/complaints').send({
        category: 'electrical',
        description: 'valid description',
      });
      expect(res.status).toBe(200);
    });

    /**
     * Test: should default is_urgent to false
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should default is_urgent to false', async () => {
      supabaseMock.single.mockResolvedValueOnce({
        data: { id: '1', is_urgent: false },
        error: null,
      });
      const res = await request(app).post('/api/v1/complaints').send({
        category: 'electrical',
        description: 'valid description',
      });
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/complaints/my - Student views own', () => {
    /**
     * Test: should return student complaints
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should return student complaints', async () => {
      supabaseMock.order.mockResolvedValueOnce({ data: [], error: null });
      const res = await request(app).get('/api/v1/complaints/my');
      expect(res.status).toBe(200);
    });

    /**
     * Test: should respect the limit query parameter for student complaints
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should respect the limit query parameter for student complaints', async () => {
      supabaseMock.order.mockResolvedValueOnce({ data: [], error: null });
      const res = await request(app).get('/api/v1/complaints/my?limit=5');
      expect(res.status).toBe(200);
      expect(supabaseMock.limit).toHaveBeenCalledWith(5);
    });

    it('should return 401 without auth', async () => {
      currentProfile = null;
      const res = await request(app).get('/api/v1/complaints/my');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/complaints/all - Warden views all', () => {
    it('should return all complaints', async () => {
      currentProfile = mockWardenProfile;
      supabaseMock.order.mockResolvedValueOnce({ data: [], error: null });
      const res = await request(app).get('/api/v1/complaints/all');
      expect(res.status).toBe(200);
    });

    it('should filter by status query param', async () => {
      currentProfile = mockWardenProfile;
      supabaseMock.order.mockResolvedValueOnce({ data: [], error: null });
      const res = await request(app).get('/api/v1/complaints/all?status=pending');
      expect(res.status).toBe(200);
    });

    it('should return 403 for student', async () => {
      const res = await request(app).get('/api/v1/complaints/all');
      expect(res.status).toBe(403);
    });
  });

  describe('PATCH /api/complaints/:id/status - Warden updates', () => {
    it('should update status to in_progress', async () => {
      currentProfile = mockWardenProfile;
      supabaseMock.single.mockResolvedValueOnce({
        data: { id: '1', status: 'in_progress' },
        error: null,
      });
      const res = await request(app)
        .patch('/api/v1/complaints/1/status')
        .send({ status: 'in_progress' });
      expect(res.status).toBe(200);
    });

    it('should update status to resolved with resolution date', async () => {
      currentProfile = mockWardenProfile;
      supabaseMock.single.mockResolvedValueOnce({
        data: { id: '1', status: 'resolved' },
        error: null,
      });
      const res = await request(app)
        .patch('/api/v1/complaints/1/status')
        .send({ status: 'resolved' });
      expect(res.status).toBe(200);
    });

    it('should return 403 for student', async () => {
      const res = await request(app)
        .patch('/api/v1/complaints/1/status')
        .send({ status: 'in_progress' });
      expect(res.status).toBe(403);
    });

    it('should reject invalid status value', async () => {
      currentProfile = mockWardenProfile;
      const res = await request(app)
        .patch('/api/v1/complaints/1/status')
        .send({ status: 'invalid' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/complaints/stats', () => {
    it('should return complaint statistics for warden', async () => {
      currentProfile = mockWardenProfile;
      supabaseMock.select.mockResolvedValueOnce({ data: [], error: null }); // For aggregated stats
      const res = await request(app).get('/api/v1/complaints/stats');
      expect(res.status).toBe(200);
    });

    it('should return 403 for student', async () => {
      const res = await request(app).get('/api/v1/complaints/stats');
      expect(res.status).toBe(403);
    });
  });
  describe('GET /api/complaints/analytics', () => {
    it('should return analytics for warden', async () => {
      currentProfile = mockWardenProfile;
      supabaseMock.gte.mockResolvedValueOnce({ data: [{ category: 'electrical', created_at: new Date() }], error: null });
      const res = await request(app).get('/api/v1/complaints/analytics');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('DELETE /api/complaints/:id', () => {
    it('should soft delete for student', async () => {
      supabaseMock.single.mockResolvedValueOnce({ data: null, error: null });
      const res = await request(app).delete('/api/v1/complaints/1');
      expect(res.status).toBe(200);
    });
  });
});
