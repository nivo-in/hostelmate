import OpenAI from 'openai';
import logger from './logger.js';

const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
});

export async function classifyComplaint(description) {
  try {
    const response = await openai.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: `You are a hostel maintenance assistant. Analyze student complaints and return JSON only.
          
Categories: electrical, plumbing, furniture, cleaning, other
Urgency: true if safety risk or major disruption, false otherwise

Return ONLY this JSON format, nothing else:
{
  "category": "electrical|plumbing|furniture|cleaning|other",
  "is_urgent": true|false,
  "summary": "Brief 1-line summary of the issue",
  "suggested_action": "Specific action warden should take",
  "confidence": 0.0-1.0
}`,
        },
        {
          role: 'user',
          content: `Classify this hostel complaint: "${description}"`,
        },
      ],
      temperature: 0.1,
      max_tokens: 200,
      response_format: { type: 'json_object' },
    });

    const result = JSON.parse(response.choices[0].message.content);
    logger.info(
      `AI classified complaint — category: ${result.category}, urgent: ${result.is_urgent}, confidence: ${result.confidence}`
    );
    return result;
  } catch (err) {
    logger.error('AI classification failed', { error: err.message });
    return null;
  }
}

export async function generateMaintenanceSuggestion(complaintHistory) {
  try {
    const summary = complaintHistory.map((c) => `${c.category}: ${c.description}`).join('\n');

    const response = await openai.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: `You are a hostel maintenance analyst. Analyze complaint patterns and identify recurring issues that need preventive maintenance. Return JSON only.
          
Return ONLY this JSON format:
{
  "patterns": [
    {
      "issue": "description of pattern",
      "frequency": "how often it occurs",
      "recommendation": "preventive action",
      "priority": "high|medium|low"
    }
  ],
  "summary": "Overall maintenance health summary in 1-2 sentences"
}`,
        },
        {
          role: 'user',
          content: `Analyze these hostel complaints from the last 30 days:\n${summary}`,
        },
      ],
      temperature: 0.2,
      max_tokens: 500,
      response_format: { type: 'json_object' },
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (err) {
    logger.error('Maintenance analysis failed', { error: err.message });
    return null;
  }
}

export default openai;

export async function processWardenChat(messages, context, wardenId) {
  try {
    const systemPrompt = `You are an AI assistant for a hostel warden at HostelMate. You have access to real-time hostel data.
Current hostel context:
- Total students: ${context.totalStudents}
- Attendance today: ${context.attendanceToday} students marked
- Pending leave requests: ${context.pendingLeaves?.length || 0}
- Open complaints: ${context.openComplaints?.length || 0}
- Pending visitors: ${context.pendingVisitors?.length || 0}
- Average mess rating: ${context.averageMessRating}/5

Be concise, professional, and helpful. If asked about specific data, refer to the context above. Help the warden manage the hostel effectively.`;

    const response = await openai.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.slice(-10),
      ],
      temperature: 0.3,
      max_tokens: 400,
    });

    return { response: response.choices[0].message.content };
  } catch (err) {
    logger.error('Warden chat failed', { error: err.message });
    return { error: 'AI assistant is temporarily unavailable.' };
  }
}

export async function processStudentChat(messages, context, studentId) {
  try {
    const systemPrompt = `You are a helpful AI assistant for a student living in a hostel managed by HostelMate.
Your student's context:
- Recent leave requests: ${context.myLeaves?.length || 0} requests
- Recent complaints: ${context.myComplaints?.length || 0} complaints
- Upcoming visitors: ${context.myVisitors?.length || 0} pending

Help the student with questions about hostel life, how to file leaves, complaints, visitor requests, mess menu, fees, etc. Be friendly and concise.`;

    const response = await openai.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.slice(-10),
      ],
      temperature: 0.4,
      max_tokens: 400,
    });

    return { response: response.choices[0].message.content };
  } catch (err) {
    logger.error('Student chat failed', { error: err.message });
    return { error: 'AI assistant is temporarily unavailable.' };
  }
}

export async function analyzeGeneric(data, type, role) {
  try {
    const response = await openai.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: `You are a hostel data analyst. Analyze the provided ${type} data for a ${role} and return JSON only.
Return ONLY this JSON format:
{
  "summary": "2-3 sentence summary of the data",
  "insights": ["key insight 1", "key insight 2", "key insight 3"],
  "recommendation": "main actionable recommendation"
}`,
        },
        {
          role: 'user',
          content: `Analyze this ${type} data: ${JSON.stringify(data)}`,
        },
      ],
      temperature: 0.2,
      max_tokens: 300,
      response_format: { type: 'json_object' },
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (err) {
    logger.error('Generic analysis failed', { error: err.message });
    return { summary: 'Analysis unavailable.', insights: [], recommendation: '' };
  }
}

