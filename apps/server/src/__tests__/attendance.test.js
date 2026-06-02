import { jest } from '@jest/globals';
import request from 'supertest';

process.env.GROQ_API_KEY = 'test_key';
process.env.HOSTEL_LAT = '28.6139';
process.env.HOSTEL_LNG = '77.2090';

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
    set: mockRedisSet
  }
}));

jest.unstable_mockModule('../config/socket.js', () => ({
  emitToAll: jest.fn(),
  emitToUser: jest.fn(),
  getIO: jest.fn(),
  initSocket: jest.fn()
}));

jest.unstable_mockModule('../config/geofence.js', () => ({
  isWithinGeofence: jest.fn(() => ({ allowed: true, distance: 0 }))
}));

const mockWardenProfile = { id: 'warden-id', role: 'warden', email: 'warden@test.com', full_name: 'Test Warden' };
const mockStudentProfile = { id: 'student-id', role: 'student', email: 'student@test.com', full_name: 'Test Student' };

let currentProfile = mockStudentProfile;

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

describe('Attendance API Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    currentProfile = mockStudentProfile;
    queryResults = [];
    mockRedisGet.mockResolvedValue(null);
    mockRedisSet.mockResolvedValue(true);
  });

  describe('POST /api/attendance/mark', () => {
    it('should mark attendance via face_only if not already marked', async () => {
      queryResults = [
        { data: null, error: null }, // existing check (not marked)
        { data: { id: 1, scan_time: '2026-05-31T00:00:00Z' }, error: null }, // insert record
        { data: { parent_id: 'parent1', profiles: { full_name: 'Student 1' } }, error: null }, // parent lookup
        { error: null }, // notify student
        { error: null } // notify parent
      ];
      
      const res = await request(app).post('/api/attendance/mark').send({
        face_only: true
      });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should mark attendance via valid QR', async () => {
      queryResults = [
        { data: null, error: null }, // existing check
        { data: { id: 2, scan_time: '2026-05-31T00:00:00Z' }, error: null }, // insert record
        { data: null, error: null }, // parent lookup (no parent)
        { error: null } // notify student
      ];

      const today = new Date().toISOString().split('T')[0];
      const validQR = {
        hostel: 'hostelmate',
        date: today,
        token: `${today}-secret123`,
        nonce: Date.now()
      };
      
      const res = await request(app).post('/api/attendance/mark').send({
        qr_data: JSON.stringify(validQR),
        lat: 28.6139,
        lng: 77.2090
      });
      expect(res.status).toBe(200);
    });

    it('should reject if already marked', async () => {
      queryResults = [
        { data: { id: 1 }, error: null } // existing check
      ];
      const res = await request(app).post('/api/attendance/mark').send({ face_only: true });
      expect(res.status).toBe(400);
    });

    it('should reject invalid QR data format', async () => {
      queryResults = [
        { data: null, error: null } // existing check
      ];
      const res = await request(app).post('/api/attendance/mark').send({ qr_data: "invalid json {" });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/attendance/today', () => {
    it('should return attendance for today for warden', async () => {
      currentProfile = mockWardenProfile;
      queryResults = [
        { data: [{ id: 1, status: 'present' }], error: null }
      ];
      const res = await request(app).get('/api/attendance/today');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('should return from cache if available', async () => {
      currentProfile = mockWardenProfile;
      mockRedisGet.mockResolvedValueOnce([{ id: 2, status: 'present' }]);
      const res = await request(app).get('/api/attendance/today');
      expect(res.status).toBe(200);
      expect(res.body.data[0].id).toBe(2);
    });
  });

  describe('GET /api/attendance/student/:studentId', () => {
    it('should return attendance for specific student', async () => {
      queryResults = [
        { data: [{ id: 1, date: '2026-05-31' }], error: null }
      ];
      const res = await request(app).get('/api/attendance/student/student-id');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('should reject student accessing other student data', async () => {
      const res = await request(app).get('/api/attendance/student/other-id');
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/attendance/stats', () => {
    it('should return attendance stats for today', async () => {
      currentProfile = mockWardenProfile;
      queryResults = [
        { count: 100, error: null }, // total students
        { count: 80, error: null } // present today
      ];
      const res = await request(app).get('/api/attendance/stats');
      expect(res.status).toBe(200);
      expect(res.body.data.total_students).toBe(100);
      expect(res.body.data.present_today).toBe(80);
      expect(res.body.data.percentage).toBe(80);
    });
  });
});