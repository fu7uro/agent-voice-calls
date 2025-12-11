import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import type { Bindings } from './types'

// Import route handlers
import restaurantRoutes from './routes/restaurant'
import genericCallRoutes from './routes/generic-call'
import callStatusRoutes from './routes/call-status'

// Create main Hono app
const app = new Hono<{ Bindings: Bindings }>()

// Middleware
app.use('*', logger())
app.use('/api/*', cors({
  origin: '*', // In production, restrict this to your domains
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

// Health check endpoint
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'agent-voice-calls',
    version: '1.0.0',
    environment: c.env.ENVIRONMENT || 'production',
    timestamp: new Date().toISOString()
  })
})

// API documentation endpoint
app.get('/api/docs', (c) => {
  return c.json({
    service: 'Agent Voice Calls API',
    version: '1.0.0',
    description: 'AI agent outbound calling platform for restaurant bookings and generic voice calls',
    endpoints: {
      health: {
        method: 'GET',
        path: '/api/health',
        description: 'Health check endpoint'
      },
      bookRestaurant: {
        method: 'POST',
        path: '/api/call/book-restaurant',
        description: 'Initiate a restaurant booking call',
        body_example: {
          caller_phone_number: '{{agent.phone_number}}',
          restaurant_name: 'Carbone',
          location: 'New York, NY',
          reservation: {
            date: '2025-12-14',
            time: '20:00',
            party_size: 2,
            special_requests: 'Window seat if possible'
          },
          client: {
            name: 'John Smith',
            callback_number: '+15555551234'
          }
        }
      },
      getRestaurantBookingStatus: {
        method: 'GET',
        path: '/api/call/book-restaurant/:call_sid',
        description: 'Get status of a restaurant booking call'
      },
      makeGenericCall: {
        method: 'POST',
        path: '/api/call/make-call',
        description: 'Make a generic outbound call',
        body_example: {
          caller_phone_number: '{{agent.phone_number}}',
          recipient: {
            name: 'Jane Doe',
            phone_number: '+15555555678'
          },
          call_purpose: 'notify_client',
          conversation_context: {
            caller_name: 'John Smith',
            company: 'Futuro Corporation',
            message: 'Calling to confirm tomorrow meeting at 2pm',
            callback_number: '+15555551234'
          }
        }
      },
      getCallStatus: {
        method: 'GET',
        path: '/api/call/status/:call_sid',
        description: 'Get status of any call'
      },
      getCallHistory: {
        method: 'GET',
        path: '/api/calls/history',
        description: 'Get call history with pagination',
        query_params: {
          limit: 'Number of results (default: 50)',
          offset: 'Offset for pagination (default: 0)',
          call_purpose: 'Filter by call purpose (optional)'
        }
      },
      getAnalytics: {
        method: 'GET',
        path: '/api/calls/analytics',
        description: 'Get call analytics and success rates'
      }
    },
    webhooks: {
      callStatus: {
        path: '/webhook/call-status',
        description: 'Twilio webhook for call status updates (internal use)',
        method: 'POST'
      },
      recordingStatus: {
        path: '/webhook/recording-status',
        description: 'Twilio webhook for recording status (internal use)',
        method: 'POST'
      }
    }
  })
})

// Mount route handlers
app.route('/', restaurantRoutes)
app.route('/', genericCallRoutes)
app.route('/', callStatusRoutes)

// Root endpoint
app.get('/', (c) => {
  return c.json({
    service: 'Agent Voice Calls API',
    status: 'operational',
    message: 'Welcome to the Agent Voice Calls API. Visit /api/docs for documentation.',
    docs_url: '/api/docs',
    health_check: '/api/health'
  })
})

// 404 handler
app.notFound((c) => {
  return c.json({
    success: false,
    error: 'Endpoint not found',
    message: 'The requested endpoint does not exist. Visit /api/docs for available endpoints.'
  }, 404)
})

// Error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err)
  return c.json({
    success: false,
    error: 'Internal server error',
    message: err.message
  }, 500)
})

export default app
