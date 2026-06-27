-- ==============================================================================
-- HOSTELMATE - PHASE 2: SUPABASE DATA SECURITY & RLS HARDENING
-- Copy and paste this script directly into your Supabase SQL Editor and run it.
-- ==============================================================================

-- 1. Helper Function to securely get the role from the JWT (Cryptographically unforgeable)
CREATE OR REPLACE FUNCTION auth.get_user_role()
RETURNS text
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'role';
$$;

-- 2. Force Enable Row Level Security (RLS) on all core tables
ALTER TABLE IF EXISTS profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS visitors ENABLE ROW LEVEL SECURITY;

-- 3. PROFILES POLICIES
-- Wardens have full system access
CREATE POLICY "Wardens have full access to profiles" 
ON profiles FOR ALL 
USING (auth.get_user_role() = 'warden');

-- Students can ONLY read their OWN profile
CREATE POLICY "Students can view own profile" 
ON profiles FOR SELECT 
USING (auth.uid() = id AND auth.get_user_role() = 'student');

-- Parents can ONLY read their OWN profile
CREATE POLICY "Parents can view own profile" 
ON profiles FOR SELECT 
USING (auth.uid() = id AND auth.get_user_role() = 'parent');

-- 4. LEAVE REQUESTS POLICIES
CREATE POLICY "Wardens can view and update all leaves" 
ON leave_requests FOR ALL 
USING (auth.get_user_role() = 'warden');

CREATE POLICY "Students can view own leaves" 
ON leave_requests FOR SELECT 
USING (student_id = auth.uid() AND auth.get_user_role() = 'student');

CREATE POLICY "Students can insert own leaves" 
ON leave_requests FOR INSERT 
WITH CHECK (student_id = auth.uid() AND auth.get_user_role() = 'student');

-- Notice: We do NOT create an UPDATE or DELETE policy for students here.
-- This creates an Implicit Deny. Even if a student bypasses the UI and sends an API
-- request to mark their own leave as 'approved', Supabase will block it at the DB level.

-- 5. COMPLAINTS POLICIES
CREATE POLICY "Wardens can view and update all complaints" 
ON complaints FOR ALL 
USING (auth.get_user_role() = 'warden');

CREATE POLICY "Students can view own complaints" 
ON complaints FOR SELECT 
USING (student_id = auth.uid() AND auth.get_user_role() = 'student');

CREATE POLICY "Students can insert own complaints" 
ON complaints FOR INSERT 
WITH CHECK (student_id = auth.uid() AND auth.get_user_role() = 'student');

-- 6. VISITOR POLICIES
CREATE POLICY "Wardens can manage visitors" 
ON visitors FOR ALL 
USING (auth.get_user_role() = 'warden');

CREATE POLICY "Students can view and insert own visitor requests" 
ON visitors FOR SELECT 
USING (student_id = auth.uid() AND auth.get_user_role() = 'student');

CREATE POLICY "Students can insert own visitor requests" 
ON visitors FOR INSERT 
WITH CHECK (student_id = auth.uid() AND auth.get_user_role() = 'student');

-- ==============================================================================
-- END OF HARDENING SCRIPT
-- ==============================================================================
