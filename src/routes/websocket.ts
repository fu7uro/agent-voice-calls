/**
 * WebSocket Routes for Twilio Media Streams
 * Handles real-time audio streaming for conversational AI
 */

import { Hono } from 'hono'
import type { Bindings } from '../types'
import { handleTwilioMediaStream } from '../services/streaming'
import { getConnectionStats, cleanupStaleConnections } from '../services/websocket'

const app = new Hono<{ Bindings: Bindings }>()

/**
 * WebSocket endpoint for Twilio Media Streams
 * This is where Twilio connects to stream audio in real-time
 */
app.get('/ws/media-stream', async (c) => {
  // Check for WebSocket upgrade
  const upgradeHeader = c.req.header('Upgrade')
  if (upgradeHeader !== 'websocket') {
    return c.text('Expected WebSocket upgrade', 426)
  }

  try {
    // Get conversation context from query parameters
    const conversationContext = c.req.query('context') || ''
    
    console.log('[WebSocket] New Media Stream connection requested')
    console.log('[WebSocket] Context:', conversationContext.substring(0, 100) + '...')
    
    // Handle the WebSocket connection with bidirectional streaming
    // This returns a Response with status 101 (Switching Protocols)
    return await handleTwilioMediaStream(c, c.env, conversationContext)
  } catch (error) {
    console.error('[WebSocket] Error handling Media Stream:', error)
    return c.text('Internal Server Error', 500)
  }
})

/**
 * Health check for WebSocket service
 */
app.get('/ws/health', (c) => {
  const stats = getConnectionStats()
  
  return c.json({
    status: 'ok',
    service: 'websocket-media-streams',
    active_connections: stats.activeConnections,
    oldest_connection_age_ms: stats.oldestConnectionAge,
    timestamp: new Date().toISOString()
  })
})

/**
 * Get statistics about active WebSocket connections
 */
app.get('/ws/stats', (c) => {
  const stats = getConnectionStats()
  
  return c.json({
    success: true,
    data: {
      active_connections: stats.activeConnections,
      call_sids: stats.callSids,
      oldest_connection_age_ms: stats.oldestConnectionAge
    }
  })
})

/**
 * Cleanup stale connections (can be called manually or via cron)
 */
app.post('/ws/cleanup', (c) => {
  const cleaned = cleanupStaleConnections()
  
  return c.json({
    success: true,
    message: `Cleaned up ${cleaned} stale connections`,
    cleaned_count: cleaned
  })
})

/**
 * Test endpoint to generate TwiML for Media Streams
 * Useful for testing the WebSocket endpoint URL
 */
app.get('/ws/test-twiml', (c) => {
  const baseUrl = new URL(c.req.url).origin
  const wsUrl = `${baseUrl.replace('http', 'ws')}/ws/media-stream`
  
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${wsUrl}">
      <Parameter name="context" value="Test conversation" />
    </Stream>
  </Connect>
</Response>`
  
  return c.text(twiml, 200, {
    'Content-Type': 'text/xml'
  })
})

export default app
