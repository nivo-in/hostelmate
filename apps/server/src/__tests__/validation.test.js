import { describe, it, expect } from '@jest/globals';
import {
  attendanceSchema,
  leaveSchema,
  complaintSchema,
  noticeSchema,
} from '../config/validation.js';

describe('Zod Validation Schemas', () => {
  describe('Leave Schema', () => {
    it('should reject reason shorter than 20 chars', () => {
      const result = leaveSchema.safeParse({
        start_date: '2026-05-10',
        end_date: '2026-05-12',
        reason: 'Too short',
      });
      expect(result.success).toBe(false);
    });

    it('should accept valid leave request', () => {
      const result = leaveSchema.safeParse({
        start_date: '2026-05-10',
        end_date: '2026-05-12',
        reason: 'Going home for family function this weekend',
      });
      expect(result.success).toBe(true);
    });

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
    it('should reject invalid category', () => {
      const result = complaintSchema.safeParse({
        category: 'invalid_category',
        description: 'Something is broken here',
        is_urgent: false,
      });
      expect(result.success).toBe(false);
    });

    it('should accept valid complaint', () => {
      const result = complaintSchema.safeParse({
        category: 'electrical',
        description: 'Light not working in room',
        is_urgent: true,
      });
      expect(result.success).toBe(true);
    });

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
    it('should reject notice with short title', () => {
      const result = noticeSchema.safeParse({
        title: 'Hi',
        content: 'This is a notice content for students',
        target_audience: 'all',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid target audience', () => {
      const result = noticeSchema.safeParse({
        title: 'Important Notice',
        content: 'This is a notice content for students',
        target_audience: 'everyone',
      });
      expect(result.success).toBe(false);
    });

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
});
