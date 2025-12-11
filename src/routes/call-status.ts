import { Hono } from 'hono'
import type { Bindings, TwilioWebhookPayload, CallStatus } from '../types'
import { getCallTranscript } from '../services/twilio'

const app = new Hono<{ Bindings: Bindings }>()

/**
 * Webhook endpoint for Twilio call status updates
 */
app.post('/webhook/call-status', async (c) => {
  try {
    const body = await c.req.parseBody() as unknown as TwilioWebhookPayload
    const { CallSid, CallStatus, Duration, RecordingUrl, TranscriptionText } = body
    
    console.log(`Call status update: ${CallSid} - ${CallStatus}`)
    
    // Map Twilio status to our CallStatus type
    const status: CallStatus = mapTwilioStatus(CallStatus)
    
    // Update call log in database
    if (status === 'completed' || status === 'no-answer' || status === 'busy' || status === 'failed') {
      // Get transcript if call completed
      let transcript = TranscriptionText || null
      if (status === 'completed' && !transcript) {
        transcript = await getCallTranscript(c.env, CallSid)
      }
      
      // Update database
      await c.env.DB.prepare(`
        UPDATE call_logs 
        SET status = ?,
            duration_seconds = ?,
            transcript = ?,
            completed_at = datetime('now')
        WHERE call_sid = ?
      `).bind(status, Duration ? parseInt(Duration) : null, transcript, CallSid).run()
      
      // TODO: In production, trigger outcome analysis here
      // This would use an LLM to analyze the transcript and extract structured data
      // For now, we'll leave outcome analysis to be done via API call
    } else {
      // Just update status for in-progress calls
      await c.env.DB.prepare(`
        UPDATE call_logs 
        SET status = ?
        WHERE call_sid = ?
      `).bind(status, CallSid).run()
    }
    
    return c.text('OK', 200)
  } catch (error) {
    console.error('Error processing call status webhook:', error)
    return c.text('Internal Server Error', 500)
  }
})

/**
 * Webhook endpoint for Twilio recording status
 */
app.post('/webhook/recording-status', async (c) => {
  try {
    const body = await c.req.parseBody()
    console.log('Recording status update:', body)
    
    // In production, you would:
    // 1. Download the recording
    // 2. Send to speech-to-text service
    // 3. Update call_logs with transcript
    // 4. Analyze with LLM to extract outcome
    
    return c.text('OK', 200)
  } catch (error) {
    console.error('Error processing recording webhook:', error)
    return c.text('Internal Server Error', 500)
  }
})

/**
 * Map Twilio call status to our CallStatus type
 */
function mapTwilioStatus(twilioStatus: string): CallStatus {
  const statusMap: Record<string, CallStatus> = {
    'queued': 'initiated',
    'initiated': 'initiated',
    'ringing': 'ringing',
    'in-progress': 'in-progress',
    'completed': 'completed',
    'busy': 'busy',
    'no-answer': 'no-answer',
    'failed': 'failed',
    'canceled': 'canceled'
  }
  
  return statusMap[twilioStatus] || 'failed'
}

export default app
