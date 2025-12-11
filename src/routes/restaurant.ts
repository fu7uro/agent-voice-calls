import { Hono } from 'hono'
import type { Bindings, RestaurantBookingRequest, CallResponse, ApiResponse } from '../types'
import { searchRestaurant, extractPhoneNumber } from '../services/places'
import { initiateCall, validatePhoneNumber, formatPhoneNumber } from '../services/twilio'
import { generateRestaurantBookingPrompt } from '../utils/prompts'

const app = new Hono<{ Bindings: Bindings }>()

/**
 * Book a restaurant reservation via phone call
 */
app.post('/api/call/book-restaurant', async (c) => {
  try {
    const request: RestaurantBookingRequest = await c.req.json()
    
    // Validate required fields
    if (!request.caller_phone_number || !request.restaurant_name || !request.reservation || !request.client) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Missing required fields: caller_phone_number, restaurant_name, reservation, client'
      }, 400)
    }
    
    // Validate phone numbers
    const callerPhone = formatPhoneNumber(request.caller_phone_number)
    if (!validatePhoneNumber(callerPhone)) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Invalid caller phone number format. Must be E.164 format (e.g., +15555551234)'
      }, 400)
    }
    
    // Get restaurant phone number if not provided
    let restaurantPhone = request.phone_number
    let restaurantDetails = null
    
    if (!restaurantPhone) {
      // Search for restaurant via Google Places
      if (!request.location) {
        return c.json<ApiResponse>({
          success: false,
          error: 'Either phone_number or location must be provided to find the restaurant'
        }, 400)
      }
      
      console.log(`Searching for restaurant: ${request.restaurant_name} in ${request.location}`)
      restaurantDetails = await searchRestaurant(
        request.restaurant_name,
        request.location,
        c.env.GOOGLE_PLACES_API_KEY
      )
      
      if (!restaurantDetails) {
        return c.json<ApiResponse>({
          success: false,
          error: `Could not find phone number for ${request.restaurant_name} in ${request.location}`
        }, 404)
      }
      
      restaurantPhone = extractPhoneNumber(restaurantDetails)
      
      if (!restaurantPhone) {
        return c.json<ApiResponse>({
          success: false,
          error: `Found restaurant but no phone number available for ${request.restaurant_name}`
        }, 404)
      }
    } else {
      restaurantPhone = formatPhoneNumber(restaurantPhone)
      if (!validatePhoneNumber(restaurantPhone)) {
        return c.json<ApiResponse>({
          success: false,
          error: 'Invalid restaurant phone number format'
        }, 400)
      }
    }
    
    console.log(`Booking reservation at ${request.restaurant_name} (${restaurantPhone})`)
    
    // Generate conversation prompt
    const conversationPrompt = generateRestaurantBookingPrompt(request)
    
    // Get base URL for webhooks
    const baseUrl = new URL(c.req.url).origin
    const webhookUrl = `${baseUrl}/webhook/call-status`
    
    // Initiate the call
    const callResult = await initiateCall(c.env, {
      to: restaurantPhone,
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
      restaurantPhone,
      request.restaurant_name,
      'restaurant_booking',
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
      message: `Call initiated to ${request.restaurant_name}. You will be notified when the call completes.`
    })
    
  } catch (error) {
    console.error('Error in restaurant booking:', error)
    return c.json<ApiResponse>({
      success: false,
      error: 'Internal server error'
    }, 500)
  }
})

/**
 * Get status of a restaurant booking call
 */
app.get('/api/call/book-restaurant/:call_sid', async (c) => {
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
        status: result.status,
        duration: result.duration_seconds,
        transcript: result.transcript,
        outcome: result.outcome_details ? JSON.parse(result.outcome_details as string) : null,
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

export default app
