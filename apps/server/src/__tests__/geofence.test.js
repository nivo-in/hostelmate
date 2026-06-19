import { describe, it, expect } from '@jest/globals';
import { calculateDistance, isWithinGeofence } from '../config/geofence.js';

/**
 * @file __tests__/geofence.test.js
 * Integration/unit tests for geolocation distance and geofence verification logic.
 * Asserts Haversine formula distance computations and custom geofence radius checks.
 */
describe('Geofence Utilities', () => {
  const HOSTEL_LAT = 12.9394941;
  const HOSTEL_LNG = 77.5669014;

  describe('calculateDistance', () => {
    /**
     * Test: should return 0 for same coordinates
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should return 0 for same coordinates', () => {
      const dist = calculateDistance(HOSTEL_LAT, HOSTEL_LNG, HOSTEL_LAT, HOSTEL_LNG);
      expect(dist).toBe(0);
    });

    /**
     * Test: should calculate correct distance between two points
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should calculate correct distance between two points', () => {
      // ~1.5km between these coordinates
      const dist = calculateDistance(12.9394941, 77.5669014, 12.9258, 77.5669);
      expect(dist).toBeGreaterThan(1000);
      expect(dist).toBeLessThan(2000);
    });

    /**
     * Test: should return same distance regardless of direction
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should return same distance regardless of direction', () => {
      const dist1 = calculateDistance(12.94, 77.57, 12.93, 77.56);
      const dist2 = calculateDistance(12.93, 77.56, 12.94, 77.57);
      expect(Math.abs(dist1 - dist2)).toBeLessThan(1);
    });
  });

  describe('isWithinGeofence', () => {
    it('should return allowed:true at exact hostel location', () => {
      const result = isWithinGeofence(HOSTEL_LAT, HOSTEL_LNG, HOSTEL_LAT, HOSTEL_LNG);
      expect(result.allowed).toBe(true);
      expect(result.distance).toBe(0);
    });

    it('should return allowed:false for location 500m away', () => {
      const result = isWithinGeofence(12.944, 77.5669, HOSTEL_LAT, HOSTEL_LNG);
      expect(result.allowed).toBe(false);
      expect(result.distance).toBeGreaterThan(100);
    });

    it('should include distance in response', () => {
      const result = isWithinGeofence(28.6139, 77.209, HOSTEL_LAT, HOSTEL_LNG);
      expect(result).toHaveProperty('distance');
      expect(result).toHaveProperty('allowed');
    });

    it('should use custom radius when provided', () => {
      // ~300m away — outside 100m but inside 500m
      const result500m = isWithinGeofence(12.9422, 77.5669, HOSTEL_LAT, HOSTEL_LNG, 500);
      expect(result500m.allowed).toBe(true);
    });
  });
});
