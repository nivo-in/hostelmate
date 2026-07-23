import { jest } from '@jest/globals';

const { extractKeywords, calculateSimilarity, findMatches } = await import('../config/matcher.js');

describe('Lost & Found Matcher', () => {
  describe('extractKeywords', () => {
    /**
     * Test: should remove stop words
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should remove stop words', () => {
      const res = extractKeywords('the quick brown fox and the dog');
      expect(res).not.toContain('the');
      expect(res).not.toContain('and');
    });

    /**
     * Test: should return lowercase keywords
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should return lowercase keywords', () => {
      const res = extractKeywords('KEYS WALLET');
      expect(res).toEqual(expect.arrayContaining(['key', 'wallet']));
    });

    /**
     * Test: should deduplicate keywords
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should deduplicate keywords', () => {
      const res = extractKeywords('wallet wallet key');
      expect(res.filter((k) => k === 'wallet').length).toBe(1);
    });

    /**
     * Test: should handle empty string
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should handle empty string', () => {
      expect(extractKeywords('')).toEqual([]);
    });
  });

  describe('calculateSimilarity', () => {
    /**
     * Test: should return 1.0 for identical keyword sets
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should return 1.0 for identical keyword sets', () => {
      const score = calculateSimilarity(['key', 'wallet'], ['key', 'wallet']);
      expect(score).toBe(1.0);
    });

    /**
     * Test: should return 0 for completely different sets
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should return 0 for completely different sets', () => {
      const score = calculateSimilarity(['key'], ['phone']);
      expect(score).toBe(0);
    });

    /**
     * Test: should return partial score for partial matches
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should return partial score for partial matches', () => {
      const score = calculateSimilarity(['key', 'wallet'], ['key', 'phone']);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(1);
    });
  });

  describe('findMatches', () => {
    const newItem = { status: 'lost', item_name: 'iPhone 13', description: 'black cover' };
    const candidates = [
      { id: 1, status: 'found', item_name: 'iPhone 13', description: 'black cover found in mess' },
      { id: 2, status: 'found', item_name: 'wallet', description: 'leather' },
      { id: 3, status: 'lost', item_name: 'iPhone 13', description: 'black cover' }, // same type
    ];

    /**
     * Test: should find matching lost/found items above threshold
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should find matching lost/found items above threshold', () => {
      const matches = findMatches(newItem, candidates, 0.3);
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].item.id).toBe(1);
    });

    it('should not match items with same status', () => {
      const matches = findMatches(newItem, candidates, 0.1);
      expect(matches.some((m) => m.item.id === 3)).toBe(false);
    });

    it('should return empty array if no matches', () => {
      const matches = findMatches(
        { status: 'lost', item_name: 'watch', description: 'gold' },
        candidates,
        0.5
      );
      expect(matches.length).toBe(0);
    });

    it('should sort by score descending', () => {
      const moreCandidates = [
        ...candidates,
        { id: 4, status: 'found', item_name: 'iPhone', description: 'phone' },
      ];
      const matches = findMatches(newItem, moreCandidates, 0.1);
      if (matches.length > 1) {
        expect(matches[0].score).toBeGreaterThanOrEqual(matches[1].score);
      }
    });
  });
});
