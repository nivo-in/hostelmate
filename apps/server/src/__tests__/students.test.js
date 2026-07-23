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

describe('Students API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    currentProfile = mockWardenProfile;
    queryResults = [];
  });

  describe('GET /api/students', () => {
    /**
     * Test: should return all students formatted correctly
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should return all students formatted correctly', async () => {
      queryResults = [
        {
          data: [
            {
              id: 's1',
              roll_number: '123',
              profiles: { full_name: 'Student 1', email: 's1@test.com' },
              rooms: { room_number: '101', blocks: { name: 'A' } },
            },
          ],
          error: null,
        },
      ];

      const res = await request(app).get('/api/v1/students');
      expect(res.status).toBe(200);
      expect(res.body.data.students).toHaveLength(1);
      expect(res.body.data.students[0].full_name).toBe('Student 1');
      expect(res.body.data.students[0].room_number).toBe('101');
      expect(res.body.data.students[0].block_name).toBe('A');
    });

    /**
     * Test: should filter students by search query
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should filter students by search query', async () => {
      queryResults = [
        {
          data: [
            {
              id: 's1',
              roll_number: '123',
              profiles: { full_name: 'Student 1', email: 's1@test.com' },
            },
            {
              id: 's2',
              roll_number: '999',
              profiles: { full_name: 'Other', email: 'other@test.com' },
            },
          ],
          error: null,
        },
      ];

      const res = await request(app).get('/api/v1/students?search=student');
      expect(res.status).toBe(200);
      expect(res.body.data.students).toHaveLength(1);
      expect(res.body.data.students[0].id).toBe('s1');
    });

    /**
     * Test: should throw error on db failure
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should throw error on db failure', async () => {
      queryResults = [{ data: null, error: new Error('DB error') }];
      const res = await request(app).get('/api/v1/students');
      expect(res.status).toBe(500);
    });

    /**
     * Test: should reject non-warden access
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should reject non-warden access', async () => {
      currentProfile = mockStudentProfile;
      const res = await request(app).get('/api/v1/students');
      expect(res.status).toBe(403);
    });
  });
});
