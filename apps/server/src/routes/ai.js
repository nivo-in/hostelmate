import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { processWardenChat, processStudentChat, analyzeGeneric } from '../config/openai.js';
import { supabaseAdmin } from '../config/supabase.js';

const router = Router();

const MAX_MESSAGES = 30;
const MAX_TOTAL_CHARS = 12000;
const VALID_ROLES = new Set(['user', 'assistant', 'system']);

router.post('/chat', authenticate, async (req, res, next) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ success: false, error: 'Messages array is required' });
    }

    // Bound input to prevent prompt flooding / LLM cost abuse.
    if (messages.length > MAX_MESSAGES) {
      return res.status(400).json({ success: false, error: 'Conversation too long. Please start a new chat.' });
    }
    let totalChars = 0;
    for (const m of messages) {
      if (!m || typeof m.content !== 'string' || !VALID_ROLES.has(m.role)) {
        return res.status(400).json({ success: false, error: 'Invalid message format' });
      }
      totalChars += m.content.length;
    }
    if (totalChars > MAX_TOTAL_CHARS) {
      return res.status(400).json({ success: false, error: 'Message is too long.' });
    }

    if (req.profile.role === 'warden' || req.profile.role === 'admin') {
      const { count: totalStudents } = await supabaseAdmin.from('students').select('*', { count: 'exact', head: true });
      const { data: attendance } = await supabaseAdmin.from('attendance').select('status').eq('date', new Date().toISOString().split('T')[0]);
      const { data: leaves } = await supabaseAdmin.from('leave_requests').select('id, start_date, end_date, reason, students!leave_requests_student_id_fkey(profiles!students_id_fkey(full_name))').eq('status', 'pending').limit(10);
      const { data: complaints } = await supabaseAdmin.from('complaints').select('id, category, description, is_urgent, students!complaints_student_id_fkey(profiles!students_id_fkey(full_name))').in('status', ['open', 'in_progress']).limit(10);
      const { data: visitors } = await supabaseAdmin.from('visitors').select('id, visitor_name, purpose, students!visitors_student_id_fkey(profiles!students_id_fkey(full_name))').eq('status', 'pending').limit(10);
      const { data: messReviews } = await supabaseAdmin.from('mess_reviews').select('meal_type, rating, comments').order('created_at', { ascending: false }).limit(20);
      
      const { data: studentsList } = await supabaseAdmin.from('students').select('id, room_id, profiles!students_id_fkey(full_name)');
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const { data: recentAttendance } = await supabaseAdmin.from('attendance').select('student_id').gte('date', sevenDaysAgo.toISOString().split('T')[0]);
      
      let habitualAbsentees = [];
      if (studentsList && recentAttendance) {
        const attCount = {};
        recentAttendance.forEach(a => {
          attCount[a.student_id] = (attCount[a.student_id] || 0) + 1;
        });
        habitualAbsentees = studentsList
          .map(s => ({ name: s.profiles?.full_name, missed_days_last_7_days: 7 - (attCount[s.id] || 0), room: s.room_id }))
          .filter(s => s.missed_days_last_7_days > 2)
          .sort((a, b) => b.missed_days_last_7_days - a.missed_days_last_7_days)
          .slice(0, 10);
      }
      
      let averageMessRating = 0;
      if (messReviews && messReviews.length > 0) {
        const sum = messReviews.reduce((acc, review) => acc + review.rating, 0);
        averageMessRating = (sum / messReviews.length).toFixed(1);
      }
      
      const context = {
        totalStudents: totalStudents || 0,
        attendanceToday: attendance?.length || 0,
        pendingLeaves: leaves || [],
        openComplaints: complaints || [],
        pendingVisitors: visitors || [],
        recentMessReviews: messReviews || [],
        averageMessRating: averageMessRating,
        habitualAbsentees: habitualAbsentees,
        timestamp: new Date().toISOString()
      };

      const reply = await processWardenChat(messages, context, req.user.id);
      if (reply.error) return res.status(500).json({ success: false, error: reply.error });
      return res.json({ success: true, data: { message: reply.response } });

    } else if (req.profile.role === 'student') {
      const { data: myLeaves } = await supabaseAdmin.from('leave_requests').select('id, start_date, end_date, reason, status, created_at').eq('student_id', req.user.id).order('created_at', { ascending: false }).limit(10);
      const { data: myComplaints } = await supabaseAdmin.from('complaints').select('id, category, description, status, is_urgent, created_at').eq('student_id', req.user.id).order('created_at', { ascending: false }).limit(10);
      const { data: myVisitors } = await supabaseAdmin.from('visitors').select('id, visitor_name, expected_visit_date, purpose, status').eq('student_id', req.user.id).order('created_at', { ascending: false }).limit(10);
      const { data: messMenu } = await supabaseAdmin.from('mess_menu').select('*');
      // Fetch last 30 days attendance for this student
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data: myAttendance } = await supabaseAdmin.from('attendance').select('date, status').eq('student_id', req.user.id).gte('date', thirtyDaysAgo.toISOString().split('T')[0]).order('date', { ascending: false }).limit(30);
      const presentDays = (myAttendance || []).filter(a => a.status === 'present').length;
      const totalDays = (myAttendance || []).length;

      const context = {
        myLeaves: myLeaves || [],
        myComplaints: myComplaints || [],
        myVisitors: myVisitors || [],
        messMenu: messMenu || [],
        myAttendance: myAttendance || [],
        attendanceSummary: { presentDays, totalDays, absentDays: totalDays - presentDays, percentPresent: totalDays > 0 ? ((presentDays / totalDays) * 100).toFixed(1) : 'N/A' },
        timestamp: new Date().toISOString()
      };

      const reply = await processStudentChat(messages, context, req.user.id);
      if (reply.error) return res.status(500).json({ success: false, error: reply.error });
      return res.json({ success: true, data: { message: reply.response } });
      
    } else {
      return res.status(403).json({ success: false, error: 'Role not supported for AI assistant' });
    }
  } catch (error) {
    next(error);
  }
});

router.get('/analysis/:type', authenticate, async (req, res, next) => {
  try {
    const { type } = req.params;
    const isStudent = req.profile.role === 'student';
    
    let query;
    if (type === 'complaints') {
      query = supabaseAdmin.from('complaints').select('category, description, status, is_urgent').order('created_at', { ascending: false }).limit(20);
      if (isStudent) query = query.eq('student_id', req.user.id);
    } else if (type === 'leaves') {
      query = supabaseAdmin.from('leave_requests').select('start_date, end_date, reason, status').order('created_at', { ascending: false }).limit(20);
      if (isStudent) query = query.eq('student_id', req.user.id);
    } else if (type === 'visitors') {
      query = supabaseAdmin.from('visitors').select('visitor_name, purpose, status').order('created_at', { ascending: false }).limit(20);
      if (isStudent) query = query.eq('student_id', req.user.id);
    } else if (type === 'mess') {
      if (isStudent) {
        query = supabaseAdmin.from('mess_reviews').select('meal_type, rating, comments').eq('student_id', req.user.id).order('created_at', { ascending: false }).limit(10);
      } else {
        query = supabaseAdmin.from('mess_reviews').select('meal_type, rating, comments').order('created_at', { ascending: false }).limit(30);
      }
    } else {
      return res.status(400).json({ success: false, error: 'Invalid analysis type' });
    }

    const { data } = await query;
    if (!data || data.length === 0) {
      return res.json({ success: true, data: { summary: `No recent ${type} found.`, insights: [] } });
    }

    const analysis = await analyzeGeneric(data, type, isStudent ? 'student' : 'warden');
    res.json({ success: true, data: analysis });
  } catch (error) {
    next(error);
  }
});

export default router;