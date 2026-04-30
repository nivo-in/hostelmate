/**
 * @file types/index.ts
 * Shared TypeScript types and interfaces for the HostelMate client.
 * These mirror the Supabase database schema and are used across all
 * dashboard pages (Student, Warden, Parent) to ensure type safety.
 */

/** The three user roles in the HostelMate system */
export type UserRole = 'student' | 'warden' | 'parent';

/** Whether a student was present, absent, or on approved leave */
export type AttendanceStatus = 'present' | 'absent' | 'leave';

/** Workflow states for leave requests */
export type LeaveStatus = 'pending' | 'approved' | 'rejected';

/** Workflow states for maintenance/hostel complaints */
export type ComplaintStatus = 'open' | 'in_progress' | 'resolved';

/** Meal slots served in the hostel mess */
export type MealType = 'breakfast' | 'lunch' | 'snacks' | 'dinner';

/** Days of the week — used in MessMenu scheduling */
export type DayOfWeek =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

/** Roles assigned to hostel staff members */
export type StaffRole = 'warden' | 'admin' | 'cleaner' | 'security';

/** Lost & Found item workflow states */
export type ItemStatus = 'lost' | 'found' | 'claimed';

/** Who a notice is published to */
export type TargetAudience = 'students' | 'parents' | 'all';

/** Family relationship between parent and student */
export type Relation = 'father' | 'mother' | 'guardian';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  role: UserRole;
  avatar_url: string;
  created_at: string;
}

export interface Student {
  id: string;
  roll_number: string;
  room_id: string;
  parent_id: string;
  created_at: string;
}

export interface Staff {
  id: string;
  staff_role: StaffRole;
  created_at: string;
}

export interface Parent {
  id: string;
  student_id: string;
  relation: Relation;
  created_at: string;
}

export interface Block {
  id: string;
  name: string;
  created_at: string;
}

export interface Room {
  id: string;
  room_number: string;
  block_id: string;
  capacity: number;
  created_at: string;
}

export interface Attendance {
  id: string;
  student_id: string;
  date: string;
  status: AttendanceStatus;
  scan_time: string;
  qr_data: string;
  created_at: string;
}

export interface LeaveRequest {
  id: string;
  student_id: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: LeaveStatus;
  approved_by: string;
  parent_notified: boolean;
  created_at: string;
}

export interface Complaint {
  id: string;
  student_id: string;
  category: string;
  description: string;
  is_urgent: boolean;
  status: ComplaintStatus;
  resolved_by: string;
  resolution_date: string;
  created_at: string;
  ai_summary?: string;
  ai_suggested_action?: string;
  ai_confidence?: number;
  ai_classified?: boolean;
}

export interface MessMenu {
  id: string;
  day_of_week: DayOfWeek;
  meal_type: MealType;
  items: string[];
  created_at: string;
}

export interface MessReview {
  id: string;
  student_id: string;
  date: string;
  meal_type: MealType;
  rating: number;
  comments: string;
  created_at: string;
}

export interface Notice {
  id: string;
  posted_by: string;
  title: string;
  content: string;
  target_audience: TargetAudience;
  created_at: string;
}

export interface LostAndFound {
  id: string;
  item_name: string;
  description: string;
  location_found: string;
  reported_by: string;
  status: ItemStatus;
  date_reported: string;
  created_at: string;
}

export type AttendanceWithStudent = Attendance & { students: Student & { profiles: Profile } };
export type LeaveWithStudent = LeaveRequest & { students: Student & { profiles: Profile } };
export type ComplaintWithStudent = Complaint & { students: Student & { profiles: Profile } };

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'leave' | 'complaint' | 'notice' | 'curfew' | 'emergency' | 'attendance' | 'lost_found';
  is_read: boolean;
  related_id?: string;
  created_at: string;
}
