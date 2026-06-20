import { jest } from '@jest/globals';
import request from 'supertest';

// Mock Supabase
let supabaseError = null;
const supabaseMock = {
  select: jest.fn().mockReturnThis(),
  limit: jest.fn().mockImplementation(() => {
    return Promise.resolve({ error: supabaseError, data: [{ id: 1 }] });
  }),
};

jest.unstable_mockModule('../config/supabase.js', () => ({
  supabaseAdmin: {
    from: jest.fn(() => supabaseMock),
  },
}));

// Mock Redis
let redisPingThrows = false;
jest.unstable_mockModule('../config/redis.js', () => ({
  getCache: jest.fn(),
  setCache: jest.fn(),
  deleteCache: jest.fn(),
  deleteCachePattern: jest.fn(),
  publishEvent: jest.fn(),
  redis: {
    ping: jest.fn(async () => {
      if (redisPingThrows) {throw new Error('Redis down');}
      return 'PONG';
    }),
  },
}));

const { default: app } = await import('../index.js');

describe('Health API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    supabaseError = null;
    redisPingThrows = false;
  });

  /**
   * Test: should return ok when both DB and Redis are up
   * Verifies behaviour under correct inputs and constraints.
   */
  it('should return ok when both DB and Redis are up', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.services.database).toBe('ok');
    expect(res.body.services.redis).toBe('ok');
    expect(res.body.uptime).toBeDefined();
    expect(res.body.responseTime).toBeDefined();
    expect(res.body.nodeVersion).toBeDefined();
    expect(res.body.environment).toBeDefined();
    expect(res.body.version).toBeDefined();
  });

  /**
   * Test: should return degraded when DB is down
   * Verifies behaviour under correct inputs and constraints.
   */
  it('should return degraded when DB is down', async () => {
    supabaseError = new Error('DB down');
    const res = await request(app).get('/health');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
    expect(res.body.services.database).toBe('degraded');
    expect(res.body.services.redis).toBe('ok');
  });

  /**
   * Test: should return degraded when DB select throws
   * Verifies behaviour under correct inputs and constraints.
   */
  it('should return degraded when DB select throws', async () => {
    supabaseMock.limit.mockRejectedValueOnce(new Error('DB exception'));
    const res = await request(app).get('/health');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
    expect(res.body.services.database).toBe('degraded');
  });

  /**
   * Test: should return degraded when Redis is down
   * Verifies behaviour under correct inputs and constraints.
   */
  it('should return degraded when Redis is down', async () => {
    redisPingThrows = true;
    const res = await request(app).get('/health');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
    expect(res.body.services.database).toBe('ok');
    expect(res.body.services.redis).toBe('degraded');
  });
});
