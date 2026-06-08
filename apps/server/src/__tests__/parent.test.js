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

const mockParentProfile = {
  id: 'parent-id',
  role: 'parent',
  email: 'parent@test.com',
  full_name: 'Test Parent',
};
const mockStudentProfile = {
  id: 'student-id',
  role: 'student',
  email: 'student@test.com',
  full_name: 'Test Student',
};

let currentProfile = mockParentProfile;

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

describe('Parent API Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    currentProfile = mockParentProfile;
    queryResults = [];
  });

  describe('GET /api/parent/my-student', () => {
    it('should return linked student profile and attendance', async () => {
      queryResults = [
        { data: { student_id: 'student-id', relation: 'Father' }, error: null }, // parent lookup
        { data: { id: 'student-id', full_name: 'Student Name' }, error: null }, // profile lookup
        { data: { roll_number: '123' }, error: null }, // student lookup
        { data: { id: 1, status: 'present' }, error: null }, // today's attendance
        { data: [{ id: 1, status: 'present' }], error: null }, // month's attendance
      ];

      const res = await request(app).get('/api/v1/parent/my-student');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.student.full_name).toBe('Student Name');
      expect(res.body.data.student.roll_number).toBe('123');
      expect(res.body.data.today_attendance.status).toBe('present');
    });

    it('should return 404 if no linked student', async () => {
      queryResults = [{ data: null, error: new Error('No rows') }];

      const res = await request(app).get('/api/v1/parent/my-student');
      expect(res.status).toBe(404);
    });

    it('should reject non-parent access', async () => {
      currentProfile = mockStudentProfile;
      const res = await request(app).get('/api/v1/parent/my-student');
      expect(res.status).toBe(403);
    });
  });
});
