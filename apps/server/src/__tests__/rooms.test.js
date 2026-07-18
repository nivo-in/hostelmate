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

describe('Rooms API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    currentProfile = mockStudentProfile;
    queryResults = [];
  });

  describe('GET /api/rooms/my - Student views room', () => {
    /**
     * Test: should return student room details and roommates
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should return student room details and roommates', async () => {
      queryResults = [
        // Mock student query
        {
          data: {
            room_id: 'room-1',
            rooms: { room_number: '101', capacity: 2, blocks: { name: 'A' } },
          },
          error: null,
        },
        // Mock roommates query
        { data: [{ id: 'other', profiles: { full_name: 'Other Student' } }], error: null },
      ];

      const res = await request(app).get('/api/v1/rooms/my');
      expect(res.status).toBe(200);
      expect(res.body.data.student.rooms.room_number).toBe('101');
      expect(res.body.data.roommates).toContain('Other Student');
    });
  });

  describe('GET /api/rooms/available - Student views available rooms', () => {
    /**
     * Test: should return rooms with occupancy < capacity
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should return rooms with occupancy < capacity', async () => {
      queryResults = [
        {
          data: [{ id: 'room-1', room_number: '101', capacity: 2, blocks: { name: 'A' } }],
          error: null,
        },
        { data: [{ room_id: 'room-1' }], error: null },
      ];

      const res = await request(app).get('/api/v1/rooms/available');
      expect(res.status).toBe(200);
      expect(res.body.data[0].room_number).toBe('101');
      expect(res.body.data[0].occupancy).toBe(1);
    });
    /**
     * Test: should filter available rooms by capacity if specified
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should filter available rooms by capacity if specified', async () => {
      queryResults = [
        {
          data: [
            { id: 'room-1', room_number: '101', capacity: 2, blocks: { name: 'A' } },
            { id: 'room-2', room_number: '102', capacity: 3, blocks: { name: 'A' } }
          ],
          error: null,
        },
        { data: [], error: null }, // no occupants
      ];

      const res = await request(app).get('/api/v1/rooms/available?capacity=3');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].capacity).toBe(3);
    });
  });

  describe('GET /api/rooms - Warden views all rooms', () => {
    /**
     * Test: should return all rooms with current occupants
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should return all rooms with current occupants', async () => {
      currentProfile = mockWardenProfile;
      queryResults = [
        {
          data: [{ id: 'room-1', room_number: '101', capacity: 2, blocks: { name: 'A' } }],
          error: null,
        },
        {
          data: [{ id: 'student-1', room_id: 'room-1', profiles: { full_name: 'Test' } }],
          error: null,
        },
      ];

      const res = await request(app).get('/api/v1/rooms');
      expect(res.status).toBe(200);
      expect(res.body.data.rooms[0].current_occupants).toHaveLength(1);
    });
  });

  describe('POST /api/rooms - Warden creates room', () => {
    /**
     * Test: should create room in existing block
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should create room in existing block', async () => {
      currentProfile = mockWardenProfile;
      queryResults = [
        { data: [{ id: 'block-1' }], error: null },
        { data: { id: 'room-new' }, error: null },
      ];

      const res = await request(app).post('/api/v1/rooms').send({
        room_number: '102',
        block_name: 'A',
        capacity: 2,
      });
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('room-new');
    });

    /**
     * Test: should return 403 for student
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should return 403 for student', async () => {
      const res = await request(app).post('/api/v1/rooms').send({
        room_number: '102',
        block_name: 'A',
        capacity: 2,
      });
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/rooms/unassigned - Warden views unassigned students', () => {
    /**
     * Test: should return unassigned students
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should return unassigned students', async () => {
      currentProfile = mockWardenProfile;
      queryResults = [
        { data: [{ id: 'student-2', profiles: { full_name: 'No Room' } }], error: null },
      ];
      const res = await request(app).get('/api/v1/rooms/unassigned');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });
  });

  describe('POST /api/rooms/assign - Warden assigns room', () => {
    /**
     * Test: should assign room if capacity allows
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should assign room if capacity allows', async () => {
      currentProfile = mockWardenProfile;
      queryResults = [
        { data: { capacity: 2, room_number: '101' }, error: null },
        { count: 1, error: null },
        { error: null },
      ];

      const res = await request(app).post('/api/v1/rooms/assign').send({
        student_id: 'student-2',
        room_id: 'room-1',
      });
      expect(res.status).toBe(200);
    });

    /**
     * Test: should return 400 if room is full
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should return 400 if room is full', async () => {
      currentProfile = mockWardenProfile;
      queryResults = [
        { data: { capacity: 2, room_number: '101' }, error: null },
        { count: 2, error: null },
      ];

      const res = await request(app).post('/api/v1/rooms/assign').send({
        student_id: 'student-2',
        room_id: 'room-1',
      });
      expect(res.status).toBe(400);
    });
  });

  describe('Room Transfer Requests', () => {
    /**
     * Test: POST /transfer-request - should submit request
     * Verifies behaviour under correct inputs and constraints.
     */
    it('POST /transfer-request - should submit request', async () => {
      queryResults = [{ data: { room_id: 'room-1' }, error: null }, { error: null }];

      const res = await request(app).post('/api/v1/rooms/transfer-request').send({
        requested_room_id: 'room-2',
        reason: 'Too noisy',
      });
      expect(res.status).toBe(200);
    });

    /**
     * Test: GET /transfer-requests - should return requests for warden
     * Verifies behaviour under correct inputs and constraints.
     */
    it('GET /transfer-requests - should return requests for warden', async () => {
      currentProfile = mockWardenProfile;
      queryResults = [{ data: [{ id: 'req-1' }], error: null }];
      const res = await request(app).get('/api/v1/rooms/transfer-requests');
      expect(res.status).toBe(200);
    });

    /**
     * Test: PATCH /transfer-requests/:id/approve - should approve
     * Verifies behaviour under correct inputs and constraints.
     */
    it('PATCH /transfer-requests/:id/approve - should approve', async () => {
      currentProfile = mockWardenProfile;
      queryResults = [
        {
          data: { id: 'req-1', requested_room_id: 'room-2', student_id: 'student-1' },
          error: null,
        },
        { error: null },
        { error: null },
      ];

      const res = await request(app).patch('/api/v1/rooms/transfer-requests/1/approve');
      expect(res.status).toBe(200);
    });

    /**
     * Test: PATCH /transfer-requests/:id/reject - should reject
     * Verifies behaviour under correct inputs and constraints.
     */
    it('PATCH /transfer-requests/:id/reject - should reject', async () => {
      currentProfile = mockWardenProfile;
      queryResults = [{ data: { id: 'req-1', student_id: 'student-1' }, error: null }];

      const res = await request(app).patch('/api/v1/rooms/transfer-requests/1/reject');
      expect(res.status).toBe(200);
    });
  });
});
