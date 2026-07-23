import { describe, it, expect } from '@jest/globals';
import {
  attendanceSchema,
  leaveSchema,
  complaintSchema,
  noticeSchema,
  messMenuSchema,
  messReviewSchema,
  lostFoundSchema,
} from '../config/validation.js';

describe('Zod Validation Schemas', () => {
  describe('Leave Schema', () => {
    /**
     * Test: should reject reason shorter than 20 chars
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should reject reason shorter than 20 chars', () => {
      const result = leaveSchema.safeParse({
        start_date: '2026-05-10',
        end_date: '2026-05-12',
        reason: 'Too short',
      });
      expect(result.success).toBe(false);
    });

    /**
     * Test: should accept valid leave request
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should accept valid leave request', () => {
      const result = leaveSchema.safeParse({
        start_date: '2026-05-10',
        end_date: '2026-05-12',
        reason: 'Going home for family function this weekend',
      });
      expect(result.success).toBe(true);
    });

    /**
     * Test: should reject invalid date format
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should reject invalid date format', () => {
      const result = leaveSchema.safeParse({
        start_date: '10-05-2026',
        end_date: '12-05-2026',
        reason: 'Going home for family function this weekend',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Complaint Schema', () => {
    /**
     * Test: should reject invalid category
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should reject invalid category', () => {
      const result = complaintSchema.safeParse({
        category: 'invalid_category',
        description: 'Something is broken here',
        is_urgent: false,
      });
      expect(result.success).toBe(false);
    });

    /**
     * Test: should accept valid complaint
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should accept valid complaint', () => {
      const result = complaintSchema.safeParse({
        category: 'electrical',
        description: 'Light not working in room',
        is_urgent: true,
      });
      expect(result.success).toBe(true);
    });

    /**
     * Test: should default is_urgent to false
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should default is_urgent to false', () => {
      const result = complaintSchema.safeParse({
        category: 'plumbing',
        description: 'Tap is leaking in bathroom',
      });
      expect(result.success).toBe(true);
      expect(result.data?.is_urgent).toBe(false);
    });
  });

  describe('Notice Schema', () => {
    /**
     * Test: should reject notice with short title
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should reject notice with short title', () => {
      const result = noticeSchema.safeParse({
        title: 'Hi',
        content: 'This is a notice content for students',
        target_audience: 'all',
      });
      expect(result.success).toBe(false);
    });

    /**
     * Test: should reject invalid target audience
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should reject invalid target audience', () => {
      const result = noticeSchema.safeParse({
        title: 'Important Notice',
        content: 'This is a notice content for students',
        target_audience: 'everyone',
      });
      expect(result.success).toBe(false);
    });

    /**
     * Test: should accept valid notice
     * Verifies behaviour under correct inputs and constraints.
     */
    it('should accept valid notice', () => {
      const result = noticeSchema.safeParse({
        title: 'Important Notice',
        content: 'This is a notice content for students',
        target_audience: 'students',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('Attendance Schema', () => {
    it('should accept attendance with location', () => {
      const result = attendanceSchema.safeParse({
        qr_data: '{"date":"2026-05-10","token":"2026-05-10-secret123"}',
        lat: 12.9394941,
        lng: 77.5669014,
      });
      expect(result.success).toBe(true);
    });

    it('should accept attendance without location', () => {
      const result = attendanceSchema.safeParse({
        qr_data: '{"date":"2026-05-10","token":"2026-05-10-secret123"}',
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty qr_data', () => {
      const result = attendanceSchema.safeParse({
        qr_data: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Mess Menu Schema', () => {
    it('should accept valid mess menu', () => {
      const result = messMenuSchema.safeParse({ day_of_week: 'monday', meal_type: 'breakfast', items: ['Poha', 'Tea'] });
      expect(result.success).toBe(true);
    });
    
    it('should reject missing items', () => {
      const result = messMenuSchema.safeParse({ day_of_week: 'monday', meal_type: 'breakfast', items: [] });
      expect(result.success).toBe(false);
    });
    
    it('should reject invalid day', () => {
      const result = messMenuSchema.safeParse({ day_of_week: 'funday', meal_type: 'breakfast', items: ['Poha'] });
      expect(result.success).toBe(false);
    });
    
    it('should accept all valid days', () => {
      ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].forEach(day => {
        expect(messMenuSchema.safeParse({ day_of_week: day, meal_type: 'lunch', items: ['Rice'] }).success).toBe(true);
      });
    });
    
    it('should reject invalid meal type', () => {
      expect(messMenuSchema.safeParse({ day_of_week: 'monday', meal_type: 'brunch', items: ['Food'] }).success).toBe(false);
    });
  });

  describe('Mess Review Schema', () => {
    it('should accept valid review', () => {
      expect(messReviewSchema.safeParse({ meal_type: 'dinner', date: '2026-05-10', rating: 4, comments: 'Good' }).success).toBe(true);
    });
    
    it('should reject rating > 5', () => {
      expect(messReviewSchema.safeParse({ meal_type: 'dinner', date: '2026-05-10', rating: 6 }).success).toBe(false);
    });
    
    it('should reject rating < 1', () => {
      expect(messReviewSchema.safeParse({ meal_type: 'dinner', date: '2026-05-10', rating: 0 }).success).toBe(false);
    });
    
    it('should accept review without comments', () => {
      expect(messReviewSchema.safeParse({ meal_type: 'dinner', date: '2026-05-10', rating: 3 }).success).toBe(true);
    });
    
    it('should reject invalid date format', () => {
      expect(messReviewSchema.safeParse({ meal_type: 'dinner', date: '26-05-10', rating: 3 }).success).toBe(false);
    });
  });

  describe('Lost Found Schema', () => {
    it('should accept valid lost item', () => {
      expect(lostFoundSchema.safeParse({ item_name: 'Keys', status: 'lost' }).success).toBe(true);
    });
    
    it('should accept valid found item with location', () => {
      expect(lostFoundSchema.safeParse({ item_name: 'Wallet', status: 'found', location_found: 'Library' }).success).toBe(true);
    });
    
    it('should reject short item name', () => {
      expect(lostFoundSchema.safeParse({ item_name: 'K', status: 'lost' }).success).toBe(false);
    });
    
    it('should reject invalid status', () => {
      expect(lostFoundSchema.safeParse({ item_name: 'Keys', status: 'missing' }).success).toBe(false);
    });
  });
});
