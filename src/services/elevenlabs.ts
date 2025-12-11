/**
 * 11Labs Conversational AI Integration
 * Handles WebSocket connection to 11Labs for real-time conversational AI
 */

import type { Bindings, ElevenLabsConversationConfig } from '../types'
import { 
  getElevenLabsWebSocketUrl, 
  VOICE_SETTINGS, 
  IVANNA_VOICE_CONFIG,
  ELEVENLABS_AUDIO_CONFIG,
  WEBSOCKET_CONFIG,
  LOGGING_CONFIG
} from '../utils/config'
import { base64ToUint8Array, uint8ArrayToBase64 } from '../utils/audio'

/**
 * Initialize 11Labs Conversational AI WebSocket connection
 * Returns WebSocket instance ready for bidirectional audio streaming
 */
export async function initializeElevenLabsConversation(
  env: Bindings,
  conversationContext: string
): Promise<WebSocket | null> {
  const apiKey = env.ELEVENLABS_API_KEY
  
  // Check for dummy credentials - return null for demo mode
  if (apiKey.startsWith('dummy_')) {
    console.log('[DEMO MODE] Using dummy 11Labs API key')
    return null
  }
  
  try {
    // Get WebSocket URL
    const wsUrl = getElevenLabsWebSocketUrl('us-east')
    
    // Build connection URL with API key
    const connectionUrl = `${wsUrl}?api_key=${apiKey}`
    
    // Create WebSocket connection
    const ws = new WebSocket(connectionUrl)
    
    // Set up event handlers
    ws.addEventListener('open', () => {
      if (LOGGING_CONFIG.logWebSocketEvents) {
        console.log('[11Labs] WebSocket connected')
      }
      
      // Send initial configuration
      const config = createConversationConfig(env, conversationContext)
      ws.send(JSON.stringify({
        type: 'conversation_initiation',
        conversation_config: config
      }))
    })
    
    ws.addEventListener('error', (event) => {
      if (LOGGING_CONFIG.logErrors) {
        console.error('[11Labs] WebSocket error:', event)
      }
    })
    
    ws.addEventListener('close', (event) => {
      if (LOGGING_CONFIG.logWebSocketEvents) {
        console.log('[11Labs] WebSocket closed:', event.code, event.reason)
      }
    })
    
    return ws
  } catch (error) {
    console.error('[11Labs] Failed to initialize conversation:', error)
    return null
  }
}

/**
 * Create conversation configuration with voice settings
 */
function createConversationConfig(
  env: Bindings,
  conversationContext: string
): ElevenLabsConversationConfig {
  return {
    agent_id: env.ELEVENLABS_AGENT_ID, // Optional: use specific agent
    voice_name: IVANNA_VOICE_CONFIG.voice_name,
    model_id: IVANNA_VOICE_CONFIG.model_id,
    voice_settings: VOICE_SETTINGS,
    language: 'en',
    conversation_context: conversationContext
  }
}

/**
 * Send audio chunk to 11Labs
 * Converts from Twilio μ-law to 11Labs PCM16
 */
export function sendAudioToElevenLabs(
  ws: WebSocket | null,
  audioPayload: string, // Base64 encoded audio from Twilio
  isLastChunk: boolean = false
): void {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return
  }
  
  try {
    // Note: Audio conversion happens in the streaming layer
    // This just forwards the converted PCM16 audio
    const message = {
      type: 'audio_input',
      audio: audioPayload, // Already converted to PCM16
      sample_rate: ELEVENLABS_AUDIO_CONFIG.sampleRate,
      is_final: isLastChunk
    }
    
    ws.send(JSON.stringify(message))
    
    if (LOGGING_CONFIG.logAudioChunks) {
      console.log('[11Labs] Sent audio chunk:', audioPayload.length, 'bytes')
    }
  } catch (error) {
    console.error('[11Labs] Error sending audio:', error)
  }
}

/**
 * Send text input to 11Labs (for testing or mixed input)
 */
export function sendTextToElevenLabs(
  ws: WebSocket | null,
  text: string
): void {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return
  }
  
  try {
    ws.send(JSON.stringify({
      type: 'text_input',
      text: text
    }))
    
    console.log('[11Labs] Sent text input:', text)
  } catch (error) {
    console.error('[11Labs] Error sending text:', error)
  }
}

/**
 * Handle incoming message from 11Labs
 * Returns parsed message with type
 */
export function handleElevenLabsMessage(data: string): {
  type: 'audio' | 'transcript' | 'interruption' | 'error' | 'unknown'
  payload: any
} {
  try {
    const message = JSON.parse(data)
    
    switch (message.type) {
      case 'audio':
        return {
          type: 'audio',
          payload: {
            audio: message.audio, // Base64 PCM16
            sample_rate: message.sample_rate || ELEVENLABS_AUDIO_CONFIG.sampleRate
          }
        }
      
      case 'transcript':
        if (LOGGING_CONFIG.logTranscripts) {
          console.log('[11Labs] Transcript:', message.text, `(${message.speaker})`)
        }
        return {
          type: 'transcript',
          payload: {
            text: message.text,
            is_final: message.is_final,
            speaker: message.speaker
          }
        }
      
      case 'interruption':
        console.log('[11Labs] Interruption detected:', message.reason)
        return {
          type: 'interruption',
          payload: { reason: message.reason }
        }
      
      case 'error':
        if (LOGGING_CONFIG.logErrors) {
          console.error('[11Labs] Error:', message.error, message.code)
        }
        return {
          type: 'error',
          payload: {
            error: message.error,
            code: message.code
          }
        }
      
      default:
        return {
          type: 'unknown',
          payload: message
        }
    }
  } catch (error) {
    console.error('[11Labs] Failed to parse message:', error)
    return {
      type: 'error',
      payload: { error: 'Failed to parse message' }
    }
  }
}

/**
 * Gracefully close 11Labs WebSocket connection
 */
export function closeElevenLabsConnection(ws: WebSocket | null): void {
  if (!ws) return
  
  try {
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      // Send conversation end signal
      ws.send(JSON.stringify({
        type: 'conversation_end'
      }))
      
      // Close connection
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close(1000, 'Conversation completed')
        }
      }, 100)
    }
  } catch (error) {
    console.error('[11Labs] Error closing connection:', error)
  }
}

/**
 * Ping 11Labs WebSocket to keep connection alive
 */
export function pingElevenLabs(ws: WebSocket | null): void {
  if (!ws || ws.readyState !== WebSocket.OPEN) return
  
  try {
    ws.send(JSON.stringify({
      type: 'ping'
    }))
  } catch (error) {
    console.error('[11Labs] Error sending ping:', error)
  }
}

/**
 * Check if 11Labs connection is healthy
 */
export function isElevenLabsConnected(ws: WebSocket | null): boolean {
  return ws !== null && ws.readyState === WebSocket.OPEN
}

/**
 * Create mock 11Labs response for demo mode
 */
export function createMockElevenLabsResponse(userText: string): {
  audio: string
  transcript: string
} {
  // Generate mock response based on context
  let responseText = ''
  
  if (userText.toLowerCase().includes('hello') || userText.toLowerCase().includes('hi')) {
    responseText = "Hi! I'm calling on behalf of a client to make a reservation. Do you have availability?"
  } else if (userText.toLowerCase().includes('what') && userText.toLowerCase().includes('date')) {
    responseText = "We're looking for a reservation this Friday evening at 8pm for a party of 2."
  } else if (userText.toLowerCase().includes('available') || userText.toLowerCase().includes('yes')) {
    responseText = "Perfect! The name is John Smith, and the callback number is 555-123-4567."
  } else if (userText.toLowerCase().includes('confirmed') || userText.toLowerCase().includes('set')) {
    responseText = "Thank you so much for your help! Have a great day!"
  } else {
    responseText = "I understand. Could you help me with that?"
  }
  
  // Mock audio (empty for now - would need actual synthesis in production)
  const mockAudio = uint8ArrayToBase64(new Uint8Array(1600)) // 100ms of silence at 16kHz
  
  return {
    audio: mockAudio,
    transcript: responseText
  }
}

/**
 * Estimate latency for 11Labs response
 */
export function estimateElevenLabsLatency(
  audioChunkSize: number,
  sampleRate: number = ELEVENLABS_AUDIO_CONFIG.sampleRate
): number {
  // Rough estimate: processing time + network latency
  const audioDurationMs = (audioChunkSize / (sampleRate * 2)) * 1000 // PCM16 = 2 bytes per sample
  const processingTimeMs = audioDurationMs * 0.5 // Assume 50% of audio duration for processing
  const networkLatencyMs = 50 // Assume 50ms network latency
  
  return processingTimeMs + networkLatencyMs
}
