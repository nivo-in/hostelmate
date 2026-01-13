import 'dotenv/config'
import { classifyComplaint, generateMaintenanceSuggestion } from './src/config/openai.js'

async function runTests() {
  console.log('--- Smoke Testing AI Features ---')
  console.log('Testing 1: Complaint Classification (Groq API)')
  console.log('Input: "The fan in room 203 is making a weird spark and smoking, it feels dangerous."\n')
  
  const classification = await classifyComplaint('The fan in room 203 is making a weird spark and smoking, it feels dangerous.')
  console.log('Result:', classification)

  console.log('\n-----------------------------------')
  console.log('Testing 2: Predictive Maintenance Analytics (Groq API)')
  console.log('Input: 3 sample complaints\n')

  const history = [
    { category: 'electrical', description: 'Fan is sparking' },
    { category: 'electrical', description: 'Lights are flickering in block A' },
    { category: 'plumbing', description: 'Sink is clogged' },
    { category: 'electrical', description: 'Power socket is burning' }
  ]
  
  const analytics = await generateMaintenanceSuggestion(history)
  console.log('Result:', JSON.stringify(analytics, null, 2))
}

runTests().catch(console.error)
