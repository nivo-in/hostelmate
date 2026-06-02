import { jest } from '@jest/globals';
import request from 'supertest';

const supabaseMock = {
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnThis(),
  head: jest.fn().mockReturnThis(),
  then: jest.fn((resolve) => resolve({ data: [], count: 100, error: null })),
};

jest.unstable_mockModule('../config/supabase.js', () => ({
  supabaseAdmin: {
    from: jest.fn(() => supabaseMock),
  },
}));

jest.unstable_mockModule('../config/openai.js', () => ({
  processWardenChat: jest.fn().mockResolvedValue({ response: 'Warden AI response' }),
  processStudentChat: jest.fn().mockResolvedValue({ response: 'Student AI response' }),
  analyzeGeneric: jest.fn().mockResolvedValue({ summary: 'AI summary', insights: [], recommendation: '' }),
  classifyComplaint: jest.fn().mockResolvedValue({}),
  generateMaintenanceSuggestion: jest.fn().mockResolvedValue({}),
  default: {},
}));

const mockWardenProfile = { id: 'warden-id', role: 'warden' };
const mockStudentProfile = { id: 'student-id', role: 'student' };
const mockUnknownProfile = { id: 'unknown-id', role: 'guest' };

let currentProfile = mockStudentProfile;

jest.unstable_mockModule('../middleware/auth.js', () => ({
  authenticate: (req, res, next) => {
    req.user = { id: currentProfile.id };
    req.profile = currentProfile;
    next();
  },
}));

const { default: app } = await import('../index.js');
const { processWardenChat, processStudentChat, analyzeGeneric } = await import('../config/openai.js');

describe('AI Assistant API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    currentProfile = mockStudentProfile;
  });

  describe('POST /api/v1/ai/chat', () => {
    /**
     * Test: should reject if messages array is missing
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should reject if messages array is missing', async () => {
      const res = await request(app).post('/api/v1/ai/chat').send({});
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Messages array is required');
    });

    /**
     * Test: should reject if conversation is too long (MAX_MESSAGES)
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should reject if conversation is too long (MAX_MESSAGES)', async () => {
      const messages = Array(35).fill({ role: 'user', content: 'test' });
      const res = await request(app).post('/api/v1/ai/chat').send({ messages });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/too long/i);
    });

    it('should return success for warden role', async () => {
      currentProfile = mockWardenProfile;
      supabaseMock.then.mockImplementation((resolve) => resolve({ data: [], count: 100, error: null }));
      
      const res = await request(app).post('/api/v1/ai/chat').send({
        messages: [{ role: 'user', content: 'Hello' }],
      });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(processWardenChat).toHaveBeenCalled();
    });

    it('should return success for student role', async () => {
      currentProfile = mockStudentProfile;
      supabaseMock.then.mockImplementation((resolve) => resolve({ data: [], count: 0, error: null }));
      
      const res = await request(app).post('/api/v1/ai/chat').send({
        messages: [{ role: 'user', content: 'Hello' }],
      });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(processStudentChat).toHaveBeenCalled();
    });

    it('should return 403 for unsupported role', async () => {
      currentProfile = mockUnknownProfile;
      const res = await request(app).post('/api/v1/ai/chat').send({
        messages: [{ role: 'user', content: 'Hello' }],
      });
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/not supported/i);
    });
  });

  describe('GET /api/v1/ai/analysis/:type', () => {
    it('should return 400 for invalid type', async () => {
      const res = await request(app).get('/api/v1/ai/analysis/invalid_type');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid analysis type');
    });

    it('should return success for warden analyzing complaints', async () => {
      currentProfile = mockWardenProfile;
      supabaseMock.then.mockImplementationOnce((resolve) => resolve({ data: [{ id: 1 }], error: null }));
      
      const res = await request(app).get('/api/v1/ai/analysis/complaints');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(analyzeGeneric).toHaveBeenCalled();
    });

    it('should return success for student analyzing leaves', async () => {
      currentProfile = mockStudentProfile;
      supabaseMock.then.mockImplementationOnce((resolve) => resolve({ data: [{ id: 1 }], error: null }));
      
      const res = await request(app).get('/api/v1/ai/analysis/leaves');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(analyzeGeneric).toHaveBeenCalled();
    });

    it('should return empty summary when no data is found', async () => {
      currentProfile = mockStudentProfile;
      supabaseMock.then.mockImplementationOnce((resolve) => resolve({ data: [], error: null }));
      
      const res = await request(app).get('/api/v1/ai/analysis/mess');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.summary).toMatch(/No recent mess found/i);
      expect(analyzeGeneric).not.toHaveBeenCalled();
    });
  });
});
