import { z } from 'zod'

export const attendanceSchema = z.object({
  qr_data: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  face_verified: z.boolean().optional().default(false),
  face_only: z.boolean().optional().default(false),
}).refine(
  (data) => data.face_only === true || (typeof data.qr_data === 'string' && data.qr_data.length > 0),
  { message: 'qr_data is required when face_only is false', path: ['qr_data'] }
)

export const leaveSchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().min(20, 'Reason must be at least 20 characters')
})

export const complaintSchema = z.object({
  category: z.enum(['electrical', 'plumbing', 'furniture', 'cleaning', 'other']),
  description: z.string().min(10),
  is_urgent: z.boolean().optional().default(false)
})

export const messMenuSchema = z.object({
  day_of_week: z.enum(['monday','tuesday','wednesday','thursday','friday','saturday','sunday']),
  meal_type: z.enum(['breakfast','lunch','snacks','dinner']),
  items: z.array(z.string()).min(1)
})

export const messReviewSchema = z.object({
  meal_type: z.enum(['breakfast','lunch','snacks','dinner']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rating: z.number().int().min(1).max(5),
  comments: z.string().optional()
})

export const noticeSchema = z.object({
  title: z.string().min(3),
  content: z.string().min(10),
  target_audience: z.enum(['students','parents','all'])
})

export const lostFoundSchema = z.object({
  item_name: z.string().min(2),
  description: z.string().optional(),
  status: z.enum(['lost','found']),
  location_found: z.string().optional()
})
