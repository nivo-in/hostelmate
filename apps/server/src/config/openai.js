import OpenAI from 'openai'
import logger from './logger.js'

const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1'
})

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
}`
        },
        {
          role: 'user',
          content: `Classify this hostel complaint: "${description}"`
        }
      ],
      temperature: 0.1,
      max_tokens: 200,
      response_format: { type: 'json_object' }
    })

    const result = JSON.parse(response.choices[0].message.content)
    logger.info(`AI classified complaint — category: ${result.category}, urgent: ${result.is_urgent}, confidence: ${result.confidence}`)
    return result
  } catch (err) {
    logger.error('AI classification failed', { error: err.message })
    return null
  }
}

export async function generateMaintenanceSuggestion(complaintHistory) {
  try {
    const summary = complaintHistory
      .map(c => `${c.category}: ${c.description}`)
      .join('\n')

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
}`
        },
        {
          role: 'user',
          content: `Analyze these hostel complaints from the last 30 days:\n${summary}`
        }
      ],
      temperature: 0.2,
      max_tokens: 500,
      response_format: { type: 'json_object' }
    })

    return JSON.parse(response.choices[0].message.content)
  } catch (err) {
    logger.error('Maintenance analysis failed', { error: err.message })
    return null
  }
}

export default openai
