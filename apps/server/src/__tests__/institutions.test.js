import { jest } from '@jest/globals';
import request from 'supertest';

// Mock config/redis.js
jest.unstable_mockModule('../config/redis.js', () => ({
  getCache: jest.fn().mockResolvedValue(null),
  setCache: jest.fn().mockResolvedValue(true),
  deleteCache: jest.fn().mockResolvedValue(true),
  deleteCachePattern: jest.fn().mockResolvedValue(true),
  publishEvent: jest.fn().mockResolvedValue(true),
  redis: {},
}));

// Mock config/supabase.js
jest.unstable_mockModule('../config/supabase.js', () => ({
  supabaseAdmin: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
  },
}));

// Mock config/logger.js
jest.unstable_mockModule('../config/logger.js', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), http: jest.fn() },
}));

const { default: app } = await import('../index.js');
const { getCache, setCache } = await import('../config/redis.js');

describe('Institutions API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/institutions/search', () => {
    /**
     * Test: should return empty results for short query
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should return empty results for short query', async () => {
      const res = await request(app).get('/api/v1/institutions/search?q=a');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.results).toEqual([]);
    });

    /**
     * Test: should return empty results when query parameter is missing
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should return empty results when query parameter is missing', async () => {
      const res = await request(app).get('/api/v1/institutions/search');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.results).toEqual([]);
    });

    /**
     * Test: should return cached results if available
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should return cached results if available', async () => {
      const mockCached = [{ name: 'Cached Univ', city: 'Test' }];
      getCache.mockResolvedValueOnce(mockCached);

      const res = await request(app).get('/api/v1/institutions/search?q=Test');
      expect(res.status).toBe(200);
      expect(res.body.results).toEqual(mockCached);
      expect(res.body.metadata.cached).toBe(true);
    });

    it('should fetch and cache results if not in cache', async () => {
      getCache.mockResolvedValueOnce(null);
      
      // We will mock fetch to avoid actual network call
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ name: 'Hipo Univ', 'state-province': 'Delhi' }]
      });

      const res = await request(app).get('/api/v1/institutions/search?q=XYZ123Bizarre');
      expect(res.status).toBe(200);
      expect(res.body.results.length).toBeGreaterThan(0);
      expect(res.body.metadata.cached).toBe(false);
      expect(setCache).toHaveBeenCalled();
    });

    it('should handle hipolabs api failure gracefully', async () => {
      getCache.mockResolvedValueOnce(null);
      
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const res = await request(app).get('/api/v1/institutions/search?q=XYZ123Bizarre');
      expect(res.status).toBe(200); // Should still succeed, just without hipo supplements
    });

    it('should handle internal errors gracefully', async () => {
      getCache.mockRejectedValueOnce(new Error('Redis died'));

      const res = await request(app).get('/api/v1/institutions/search?q=XYZ123Bizarre');
      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });
});
