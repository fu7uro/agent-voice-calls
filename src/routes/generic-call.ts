import { Hono } from 'hono'
import type { Bindings, GenericCallRequest, CallResponse, ApiResponse } from '../types'
import { initiateCall, validatePhoneNumber, formatPhoneNumber } from '../services/twilio'
import { generateGenericCallPrompt } from '../utils/prompts'

const app = new Hono<{ Bindings: Bindings }>()

/**
 * Make a generic outbound call for various purposes
 */
app.post('/api/call/make-call', async (c) => {
  try {
    const request: GenericCallRequest = await c.req.json()
    
    // Validate required fields
    if (!request.caller_phone_number || !request.recipient || !request.conversation_context) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Missing required fields: caller_phone_number, recipient, conversation_context'
      }, 400)
    }
    
    // Validate phone numbers
    const callerPhone = formatPhoneNumber(request.caller_phone_number)
    const recipientPhone = formatPhoneNumber(request.recipient.phone_number)
    
    if (!validatePhoneNumber(callerPhone)) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Invalid caller phone number format. Must be E.164 format (e.g., +15555551234)'
      }, 400)
    }
    
    if (!validatePhoneNumber(recipientPhone)) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Invalid recipient phone number format. Must be E.164 format (e.g., +15555551234)'
      }, 400)
    }
    
    console.log(`Making ${request.call_purpose} call to ${request.recipient.name} (${recipientPhone})`)
    
    // Generate conversation prompt
    const conversationPrompt = generateGenericCallPrompt(request)
    
    // Get base URL for webhooks
    const baseUrl = new URL(c.req.url).origin
    const webhookUrl = `${baseUrl}/webhook/call-status`
    
    // Initiate the call
    const callResult = await initiateCall(c.env, {
      to: recipientPhone,
      from: callerPhone,
      webhookUrl: webhookUrl,
      conversationPrompt: conversationPrompt
    })
    
    if (!callResult) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Failed to initiate call. Please check Twilio credentials.'
      }, 500)
    }
    
    // Log call in database
    await c.env.DB.prepare(`
      INSERT INTO call_logs (
        call_sid,
        caller_phone_number,
        recipient_phone_number,
        recipient_name,
        call_purpose,
        status,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      callResult.call_sid,
      callerPhone,
      recipientPhone,
      request.recipient.name,
      request.call_purpose,
      callResult.status
    ).run()
    
    // Return response
    const response: CallResponse = {
      call_sid: callResult.call_sid,
      status: callResult.status as any,
      estimated_completion: '2-5 minutes',
      webhook_url: webhookUrl
    }
    
    return c.json<ApiResponse<CallResponse>>({
      success: true,
      data: response,
      message: `Call initiated to ${request.recipient.name}. You will be notified when the call completes.`
    })
    
  } catch (error) {
    console.error('Error in generic call:', error)
    return c.json<ApiResponse>({
      success: false,
      error: 'Internal server error'
    }, 500)
  }
})

/**
 * Get status of a generic call
 */
app.get('/api/call/status/:call_sid', async (c) => {
  try {
    const callSid = c.req.param('call_sid')
    
    // Get call log from database
    const result = await c.env.DB.prepare(`
      SELECT * FROM call_logs WHERE call_sid = ?
    `).bind(callSid).first()
    
    if (!result) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Call not found'
      }, 404)
    }
    
    return c.json<ApiResponse>({
      success: true,
      data: {
        call_sid: result.call_sid,
        caller_phone_number: result.caller_phone_number,
        recipient_phone_number: result.recipient_phone_number,
        recipient_name: result.recipient_name,
        call_purpose: result.call_purpose,
        status: result.status,
        outcome: result.outcome_details ? JSON.parse(result.outcome_details as string) : null,
        duration: result.duration_seconds,
        transcript: result.transcript,
        cost: result.cost,
        created_at: result.created_at,
        completed_at: result.completed_at
      }
    })
    
  } catch (error) {
    console.error('Error fetching call status:', error)
    return c.json<ApiResponse>({
      success: false,
      error: 'Internal server error'
    }, 500)
  }
})

/**
 * Get all calls for analytics
 */
app.get('/api/calls/history', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '50')
    const offset = parseInt(c.req.query('offset') || '0')
    const callPurpose = c.req.query('call_purpose')
    
    let query = `
      SELECT * FROM call_logs 
      ${callPurpose ? 'WHERE call_purpose = ?' : ''}
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `
    
    const stmt = callPurpose 
      ? c.env.DB.prepare(query).bind(callPurpose, limit, offset)
      : c.env.DB.prepare(query).bind(limit, offset)
    
    const results = await stmt.all()
    
    return c.json<ApiResponse>({
      success: true,
      data: {
        calls: results.results,
        total: results.results?.length || 0,
        limit,
        offset
      }
    })
    
  } catch (error) {
    console.error('Error fetching call history:', error)
    return c.json<ApiResponse>({
      success: false,
      error: 'Internal server error'
    }, 500)
  }
})

/**
 * Get call analytics
 */
app.get('/api/calls/analytics', async (c) => {
  try {
    const results = await c.env.DB.prepare(`
      SELECT * FROM call_analytics
    `).all()
    
    return c.json<ApiResponse>({
      success: true,
      data: results.results
    })
    
  } catch (error) {
    console.error('Error fetching analytics:', error)
    return c.json<ApiResponse>({
      success: false,
      error: 'Internal server error'
    }, 500)
  }
})

export default app
