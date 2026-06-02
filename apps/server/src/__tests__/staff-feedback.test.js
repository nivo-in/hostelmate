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
  then: jest.fn(function(resolve) { resolve(queryResults.shift()); })
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

describe('Staff Feedback API Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    currentProfile = mockWardenProfile;
    queryResults = [];
  });

  describe('GET /api/staff-feedback', () => {
    it('should return aggregated staff feedback for warden', async () => {
      queryResults = [
        { data: [{ id: 'staff-1', name: 'John Doe' }], error: null }, // staff members
        { data: [{ id: 'fb-1', staff_id: 'staff-1', rating: 5, created_at: new Date().toISOString() }], error: null } // feedback
      ];
      
      const res = await request(app).get('/api/staff-feedback');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].average_rating).toBe(5);
      expect(res.body.data[0].total_reviews).toBe(1);
    });
  });

  describe('GET /api/staff-feedback/:staffId', () => {
    it('should return feedback for specific staff member', async () => {
      queryResults = [
        { data: [{ id: 'fb-1', rating: 4 }], error: null }
      ];
      
      const res = await request(app).get('/api/staff-feedback/staff-1');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.average_rating).toBe(4);
    });
  });

  describe('POST /api/staff-feedback', () => {
    beforeEach(() => {
      currentProfile = mockStudentProfile;
    });

    it('should accept valid feedback from student', async () => {
      queryResults = [
        { data: { id: 'staff-1' }, error: null }, // check staff exists
        { data: [], error: null }, // check existing feedback
        { data: { id: 'fb-new', staff_id: '123e4567-e89b-12d3-a456-426614174000', rating: 5 }, error: null } // insert
      ];
      
      const res = await request(app).post('/api/staff-feedback').send({
        staff_id: '123e4567-e89b-12d3-a456-426614174000',
        rating: 5,
        comment: 'Great job!'
      });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should reject if already reviewed today', async () => {
      queryResults = [
        { data: { id: 'staff-1' }, error: null }, // check staff exists
        { data: [{ id: 'fb-old' }], error: null } // check existing feedback
      ];
      
      const res = await request(app).post('/api/staff-feedback').send({
        staff_id: '123e4567-e89b-12d3-a456-426614174000',
        rating: 5
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/already reviewed/);
    });

    it('should reject invalid payload', async () => {
      const res = await request(app).post('/api/staff-feedback').send({
        staff_id: 'not-a-uuid',
        rating: 6 // invalid rating
      });
      expect(res.status).toBe(400);
    });
  });
});
