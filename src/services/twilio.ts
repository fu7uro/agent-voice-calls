import type { Bindings } from '../types'

/**
 * Initiate an outbound call via Twilio
 */
export async function initiateCall(
  env: Bindings,
  params: {
    to: string // Recipient phone number
    from: string // Caller phone number (from 11Labs)
    webhookUrl: string // URL for call status updates
    conversationPrompt: string // AI prompt for the conversation
  }
): Promise<{ call_sid: string; status: string } | null> {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = env
  
  // Check for dummy credentials - return mock response
  if (TWILIO_ACCOUNT_SID.startsWith('dummy_')) {
    console.log('[DEMO MODE] Using dummy Twilio credentials')
    const mockCallSid = `CA${Math.random().toString(36).substring(2, 15)}`
    return {
      call_sid: mockCallSid,
      status: 'initiated'
    }
  }
  
  try {
    // Twilio API endpoint
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json`
    
    // Create TwiML for the call
    // In production, this would connect to your 11Labs voice AI
    // For now, we'll use a simple webhook approach
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Connecting to AI assistant...</Say>
  <Pause length="1"/>
</Response>`
    
    // Prepare form data for Twilio API
    const formData = new URLSearchParams()
    formData.append('To', params.to)
    formData.append('From', params.from)
    formData.append('Twiml', twiml)
    formData.append('StatusCallback', params.webhookUrl)
    formData.append('StatusCallbackEvent', 'initiated,ringing,answered,completed')
    formData.append('StatusCallbackMethod', 'POST')
    formData.append('Record', 'true') // Record call for transcript
    formData.append('RecordingStatusCallback', params.webhookUrl)
    
    // Make request to Twilio
    const response = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData.toString()
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Twilio API error:', response.status, errorText)
      return null
    }
    
    const data = await response.json()
    
    return {
      call_sid: data.sid,
      status: data.status
    }
  } catch (error) {
    console.error('Error initiating Twilio call:', error)
    return null
  }
}

/**
 * Get call details from Twilio
 */
export async function getCallDetails(
  env: Bindings,
  callSid: string
): Promise<any | null> {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = env
  
  // Check for dummy credentials
  if (TWILIO_ACCOUNT_SID.startsWith('dummy_')) {
    console.log('[DEMO MODE] Using dummy Twilio credentials')
    return {
      sid: callSid,
      status: 'completed',
      duration: '123',
      from: '+15555550100',
      to: '+15555551234'
    }
  }
  
  try {
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls/${callSid}.json`
    
    const response = await fetch(twilioUrl, {
      method: 'GET',
      headers: {
        'Authorization': 'Basic ' + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)
      }
    })
    
    if (!response.ok) {
      console.error('Error fetching call details:', response.status)
      return null
    }
    
    return await response.json()
  } catch (error) {
    console.error('Error getting call details:', error)
    return null
  }
}

/**
 * Get call recording transcript
 */
export async function getCallTranscript(
  env: Bindings,
  callSid: string
): Promise<string | null> {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = env
  
  // Check for dummy credentials
  if (TWILIO_ACCOUNT_SID.startsWith('dummy_')) {
    return `[DEMO TRANSCRIPT]
Host: Hello, thank you for calling.
AI Assistant: Hi, I'm calling to make a reservation on behalf of John Smith.
Host: Okay, what date and time?
AI Assistant: I'd like to book a table for 2 on December 14th at 8pm.
Host: Let me check... yes, we have availability. Can I get a callback number?
AI Assistant: Sure, it's 555-123-4567.
Host: Perfect, you're all set for December 14th at 8pm, party of 2 under Smith.
AI Assistant: Thank you so much!`
  }
  
  try {
    // Get recordings for this call
    const recordingsUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls/${callSid}/Recordings.json`
    
    const response = await fetch(recordingsUrl, {
      method: 'GET',
      headers: {
        'Authorization': 'Basic ' + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)
      }
    })
    
    if (!response.ok) {
      return null
    }
    
    const data = await response.json()
    
    if (!data.recordings || data.recordings.length === 0) {
      return null
    }
    
    // In a real implementation, you would:
    // 1. Download the recording audio file
    // 2. Send it to a speech-to-text service (Whisper, Google STT, etc.)
    // 3. Return the transcript
    
    // For now, return a placeholder
    return '[Transcript would be generated from recording]'
  } catch (error) {
    console.error('Error getting call transcript:', error)
    return null
  }
}

/**
 * Validate phone number format (E.164)
 */
export function validatePhoneNumber(phoneNumber: string): boolean {
  // E.164 format: +[country code][number]
  const e164Regex = /^\+[1-9]\d{1,14}$/
  return e164Regex.test(phoneNumber)
}

/**
 * Format phone number to E.164
 */
export function formatPhoneNumber(phoneNumber: string): string {
  // Remove all non-digit characters
  const digits = phoneNumber.replace(/\D/g, '')
  
  // If it starts with 1 and has 11 digits, assume it's a US number
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`
  }
  
  // If it has 10 digits, assume it's a US number without country code
  if (digits.length === 10) {
    return `+1${digits}`
  }
  
  // Otherwise, just add + if not present
  return phoneNumber.startsWith('+') ? phoneNumber : `+${digits}`
}
