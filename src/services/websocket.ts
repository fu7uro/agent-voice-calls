/**
 * WebSocket Connection Manager
 * Manages WebSocket connections for Twilio Media Streams and 11Labs Conversational AI
 */

import type { 
  WebSocketConnectionState, 
  TranscriptEntry,
  TwilioMediaStreamMessage,
  ConversationMetadata 
} from '../types'
import { WEBSOCKET_CONFIG, CONVERSATION_CONFIG } from '../utils/config'

/**
 * In-memory store for active WebSocket connections
 * Key: callSid, Value: connection state
 */
const activeConnections = new Map<string, WebSocketConnectionState>()

/**
 * Create new WebSocket connection state
 */
export function createConnectionState(callSid: string, streamSid: string): WebSocketConnectionState {
  const state: WebSocketConnectionState = {
    callSid,
    streamSid,
    conversationStarted: false,
    transcript: [],
    audioBufferTwilio: {
      chunks: [],
      sampleRate: 8000,
      encoding: 'mulaw'
    },
    audioBufferElevenLabs: {
      chunks: [],
      sampleRate: 16000,
      encoding: 'pcm16'
    },
    conversationContext: '',
    startTime: Date.now()
  }
  
  activeConnections.set(callSid, state)
  return state
}

/**
 * Get connection state by call SID
 */
export function getConnectionState(callSid: string): WebSocketConnectionState | undefined {
  return activeConnections.get(callSid)
}

/**
 * Update connection state
 */
export function updateConnectionState(callSid: string, updates: Partial<WebSocketConnectionState>): void {
  const state = activeConnections.get(callSid)
  if (state) {
    Object.assign(state, updates)
  }
}

/**
 * Add transcript entry
 */
export function addTranscriptEntry(
  callSid: string, 
  speaker: 'agent' | 'user' | 'system',
  text: string,
  isFinal: boolean = true
): void {
  const state = activeConnections.get(callSid)
  if (state) {
    const entry: TranscriptEntry = {
      timestamp: Date.now(),
      speaker,
      text,
      is_final: isFinal
    }
    state.transcript.push(entry)
  }
}

/**
 * Get full transcript as formatted string
 */
export function getFormattedTranscript(callSid: string): string {
  const state = activeConnections.get(callSid)
  if (!state) return ''
  
  return state.transcript
    .filter(entry => entry.is_final)
    .map(entry => {
      const speaker = entry.speaker === 'agent' ? 'Agent' : 
                     entry.speaker === 'user' ? 'User' : 'System'
      return `${speaker}: ${entry.text}`
    })
    .join('\n')
}

/**
 * Get conversation metadata and statistics
 */
export function getConversationMetadata(callSid: string): ConversationMetadata | null {
  const state = activeConnections.get(callSid)
  if (!state) return null
  
  const finalTranscript = state.transcript.filter(e => e.is_final)
  const agentUtterances = finalTranscript.filter(e => e.speaker === 'agent').length
  const userUtterances = finalTranscript.filter(e => e.speaker === 'user').length
  
  const metadata: ConversationMetadata = {
    callSid: state.callSid,
    startTime: state.startTime,
    endTime: undefined,
    totalDuration: undefined,
    utteranceCount: finalTranscript.length,
    agentUtterances,
    userUtterances,
    interruptions: 0, // TODO: Track interruptions
    averageLatency: undefined
  }
  
  return metadata
}

/**
 * Close and cleanup connection state
 */
export function closeConnection(callSid: string): ConversationMetadata | null {
  const state = activeConnections.get(callSid)
  if (!state) return null
  
  const metadata = getConversationMetadata(callSid)
  if (metadata) {
    metadata.endTime = Date.now()
    metadata.totalDuration = metadata.endTime - metadata.startTime
  }
  
  // Close WebSocket connections if they exist
  try {
    if (state.twilioWs && state.twilioWs.readyState === WebSocket.OPEN) {
      state.twilioWs.close()
    }
    if (state.elevenLabsWs && state.elevenLabsWs.readyState === WebSocket.OPEN) {
      state.elevenLabsWs.close()
    }
  } catch (error) {
    console.error('Error closing WebSocket connections:', error)
  }
  
  // Remove from active connections
  activeConnections.delete(callSid)
  
  return metadata
}

/**
 * Check if connection has timed out due to silence
 */
export function checkSilenceTimeout(callSid: string): boolean {
  const state = activeConnections.get(callSid)
  if (!state || state.transcript.length === 0) return false
  
  const lastEntry = state.transcript[state.transcript.length - 1]
  const timeSinceLastUtterance = Date.now() - lastEntry.timestamp
  
  return timeSinceLastUtterance > CONVERSATION_CONFIG.silenceTimeoutMs
}

/**
 * Check if conversation has exceeded max duration
 */
export function checkMaxDuration(callSid: string): boolean {
  const state = activeConnections.get(callSid)
  if (!state) return false
  
  const duration = Date.now() - state.startTime
  return duration > CONVERSATION_CONFIG.maxDurationMs
}

/**
 * Get all active connection call SIDs
 */
export function getActiveCallSids(): string[] {
  return Array.from(activeConnections.keys())
}

/**
 * Get active connection count
 */
export function getActiveConnectionCount(): number {
  return activeConnections.size
}

/**
 * Parse Twilio Media Stream message
 */
export function parseTwilioMessage(data: string): TwilioMediaStreamMessage | null {
  try {
    return JSON.parse(data) as TwilioMediaStreamMessage
  } catch (error) {
    console.error('Failed to parse Twilio message:', error)
    return null
  }
}

/**
 * Create TwiML for WebSocket Media Stream
 * This tells Twilio to stream audio to our WebSocket endpoint
 */
export function createMediaStreamTwiML(websocketUrl: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${websocketUrl}" />
  </Connect>
</Response>`
}

/**
 * Monitor and cleanup stale connections
 * Should be called periodically (e.g., every minute)
 */
export function cleanupStaleConnections(): number {
  let cleaned = 0
  const now = Date.now()
  
  for (const [callSid, state] of activeConnections.entries()) {
    const age = now - state.startTime
    
    // Clean up connections older than max duration + 1 minute
    if (age > CONVERSATION_CONFIG.maxDurationMs + 60000) {
      console.log(`Cleaning up stale connection: ${callSid} (age: ${age}ms)`)
      closeConnection(callSid)
      cleaned++
    }
  }
  
  return cleaned
}

/**
 * Get connection statistics
 */
export function getConnectionStats() {
  return {
    activeConnections: activeConnections.size,
    callSids: Array.from(activeConnections.keys()),
    oldestConnectionAge: Math.max(
      0,
      ...Array.from(activeConnections.values()).map(
        state => Date.now() - state.startTime
      )
    )
  }
}
