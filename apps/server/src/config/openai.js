import OpenAI from 'openai';
import { supabaseAdmin } from './supabase.js';
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
- Pending leave requests: ${JSON.stringify(context.pendingLeaves || [])}
- Open complaints: ${JSON.stringify(context.openComplaints || [])}
- Pending visitors: ${JSON.stringify(context.pendingVisitors || [])}
- Average mess rating: ${context.averageMessRating}/5

Be concise, professional, and helpful. If asked about specific data, refer to the context above. Help the warden manage the hostel effectively.

STRICT CONSTRAINTS:
1. You are strictly a Hostel Warden Assistant. Do not answer any questions outside the scope of hostel management, administration, or HostelMate features.
2. Refuse to write code, generate scripts, or answer programming/technical questions (e.g., "generate a C++ code").
3. Refuse to act as a general-purpose AI. Do not write essays, solve math problems, or summarize unrelated articles.
4. If a user asks a student-related question that a warden shouldn't handle, politely inform them that you are the Warden AI.
5. If a request violates these constraints, reply politely: "I'm a HostelMate AI assistant, and my primary focus is strictly on helping you with hostel management and related queries. I cannot help with that."`;

    const tools = [
      {
        type: 'function',
        function: {
          name: 'approve_leave',
          description: 'Approve a pending leave request given its ID.',
          parameters: {
            type: 'object',
            properties: {
              leave_id: { type: 'integer', description: 'The ID of the leave request.' }
            },
            required: ['leave_id']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'reject_leave',
          description: 'Reject a pending leave request given its ID.',
          parameters: {
            type: 'object',
            properties: {
              leave_id: { type: 'integer', description: 'The ID of the leave request.' }
            },
            required: ['leave_id']
          }
        }
      }
    ];

    let response = await openai.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.slice(-10),
      ],
      temperature: 0.3,
      max_tokens: 400,
      tools: tools,
      tool_choice: 'auto',
    });

    const responseMessage = response.choices[0].message;

    if (responseMessage.tool_calls) {
      const toolCalls = responseMessage.tool_calls;
      const functionMessages = [...messages.slice(-10), responseMessage];

      for (const toolCall of toolCalls) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);
        let functionResult = '';

        if (functionName === 'approve_leave') {
          const { error } = await supabaseAdmin.from('leave_requests').update({ status: 'approved' }).eq('id', functionArgs.leave_id);
          functionResult = error ? `Error: ${error.message}` : `Successfully approved leave request ${functionArgs.leave_id}`;
        } else if (functionName === 'reject_leave') {
          const { error } = await supabaseAdmin.from('leave_requests').update({ status: 'rejected' }).eq('id', functionArgs.leave_id);
          functionResult = error ? `Error: ${error.message}` : `Successfully rejected leave request ${functionArgs.leave_id}`;
        }

        functionMessages.push({
          tool_call_id: toolCall.id,
          role: 'tool',
          name: functionName,
          content: functionResult,
        });
      }

      response = await openai.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          ...functionMessages,
        ],
        temperature: 0.3,
        max_tokens: 400,
      });

      return { response: response.choices[0].message.content };
    }

    return { response: responseMessage.content };
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

Help the student with questions about hostel life, how to file leaves, complaints, visitor requests, mess menu, fees, etc. Be friendly and concise.

STRICT CONSTRAINTS:
1. You are strictly a Student Hostel Assistant. Do not answer any questions outside the scope of hostel life, your profile data, or HostelMate features.
2. Refuse to write code, generate scripts, do homework, or answer programming/technical questions (e.g., "generate a C++ code").
3. Refuse to answer administrative or warden-related questions (e.g., "how do I approve a leave?", "show me all students' attendance"). You do not have administrative privileges.
4. Refuse to act as a general-purpose AI. Do not write essays, solve math problems, or summarize unrelated articles.
5. If a request violates these constraints, reply politely: "I'm a HostelMate AI assistant, and my primary focus is strictly on helping you with your hostel-related queries. I cannot help with that."`;

    const tools = [
      {
        type: 'function',
        function: {
          name: 'apply_for_leave',
          description: 'Apply for a leave on behalf of the student.',
          parameters: {
            type: 'object',
            properties: {
              start_date: { type: 'string', description: 'YYYY-MM-DD' },
              end_date: { type: 'string', description: 'YYYY-MM-DD' },
              reason: { type: 'string', description: 'Reason for leave' }
            },
            required: ['start_date', 'end_date', 'reason']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'file_complaint',
          description: 'File a maintenance complaint on behalf of the student.',
          parameters: {
            type: 'object',
            properties: {
              category: { type: 'string', enum: ['electrical', 'plumbing', 'furniture', 'cleaning', 'other'] },
              description: { type: 'string', description: 'Details of the issue' },
              is_urgent: { type: 'boolean', description: 'Whether the issue is urgent/dangerous' }
            },
            required: ['category', 'description', 'is_urgent']
          }
        }
      }
    ];

    let response = await openai.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.slice(-10),
      ],
      temperature: 0.4,
      max_tokens: 400,
      tools: tools,
      tool_choice: 'auto',
    });

    const responseMessage = response.choices[0].message;

    if (responseMessage.tool_calls) {
      const toolCalls = responseMessage.tool_calls;
      const functionMessages = [...messages.slice(-10), responseMessage];

      for (const toolCall of toolCalls) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);
        let functionResult = '';

        if (functionName === 'apply_for_leave') {
          const { error } = await supabaseAdmin.from('leave_requests').insert({
            student_id: studentId,
            start_date: functionArgs.start_date,
            end_date: functionArgs.end_date,
            reason: functionArgs.reason,
            status: 'pending'
          });
          functionResult = error ? `Error: ${error.message}` : `Successfully applied for leave from ${functionArgs.start_date} to ${functionArgs.end_date}`;
        } else if (functionName === 'file_complaint') {
          const { error } = await supabaseAdmin.from('complaints').insert({
            student_id: studentId,
            category: functionArgs.category,
            description: functionArgs.description,
            is_urgent: functionArgs.is_urgent,
            status: 'open'
          });
          functionResult = error ? `Error: ${error.message}` : `Successfully filed ${functionArgs.is_urgent ? 'urgent ' : ''}complaint for ${functionArgs.category}`;
        }

        functionMessages.push({
          tool_call_id: toolCall.id,
          role: 'tool',
          name: functionName,
          content: functionResult,
        });
      }

      response = await openai.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          ...functionMessages,
        ],
        temperature: 0.4,
        max_tokens: 400,
      });

      return { response: response.choices[0].message.content };
    }

    return { response: responseMessage.content };
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

