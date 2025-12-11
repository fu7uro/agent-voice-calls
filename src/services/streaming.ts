/**
 * Bidirectional Audio Streaming
 * Connects Twilio Media Streams with 11Labs Conversational AI
 * Handles real-time audio conversion and forwarding
 */

import type { Bindings, TwilioMediaStreamMessage } from '../types'
import { 
  mulawToPcm16, 
  pcm16ToMulaw,
  detectVoiceActivity,
  base64ToUint8Array,
  chunkAudio
} from '../utils/audio'
import {
  createConnectionState,
  getConnectionState,
  updateConnectionState,
  addTranscriptEntry,
  closeConnection,
  parseTwilioMessage
} from './websocket'
import {
  initializeElevenLabsConversation,
  sendAudioToElevenLabs,
  handleElevenLabsMessage,
  closeElevenLabsConnection,
  pingElevenLabs,
  isElevenLabsConnected
} from './elevenlabs'
import { 
  AUDIO_BUFFER_CONFIG,
  WEBSOCKET_CONFIG,
  LOGGING_CONFIG 
} from '../utils/config'

/**
 * Handle incoming WebSocket connection from Twilio Media Stream
 * This is called when Twilio connects to our WebSocket endpoint
 */
export async function handleTwilioMediaStream(
  server: any,
  env: Bindings,
  conversationContext: string
): Promise<void> {
  // Get WebSocket upgrade
  const upgradeHeader = server.request.headers.get('Upgrade')
  if (upgradeHeader !== 'websocket') {
    return server.text('Expected WebSocket', 426)
  }
  
  // Upgrade to WebSocket
  const webSocketPair = new WebSocketPair()
  const [client, server] = Object.values(webSocketPair)
  
  // Accept the WebSocket connection
  server.accept()
  
  let callSid = ''
  let streamSid = ''
  let elevenLabsWs: WebSocket | null = null
  let pingInterval: NodeJS.Timeout | null = null
  
  // Handle messages from Twilio
  server.addEventListener('message', async (event: MessageEvent) => {
    const message = parseTwilioMessage(event.data as string)
    if (!message) return
    
    try {
      switch (message.event) {
        case 'connected':
          console.log('[Twilio] Media Stream connected')
          break
        
        case 'start':
          // Stream started - initialize connection state
          callSid = message.start.callSid
          streamSid = message.streamSid
          
          console.log('[Twilio] Stream started:', { callSid, streamSid })
          
          // Create connection state
          const state = createConnectionState(callSid, streamSid)
          state.twilioWs = server as any
          state.conversationContext = conversationContext
          
          // Initialize 11Labs connection
          elevenLabsWs = await initializeElevenLabsConversation(env, conversationContext)
          
          if (elevenLabsWs) {
            updateConnectionState(callSid, { 
              elevenLabsWs: elevenLabsWs as any,
              conversationStarted: true
            })
            
            // Set up 11Labs message handler
            setupElevenLabsHandlers(elevenLabsWs, server as any, callSid)
            
            // Start ping interval to keep connections alive
            pingInterval = setInterval(() => {
              pingElevenLabs(elevenLabsWs)
            }, WEBSOCKET_CONFIG.pingIntervalMs)
          }
          break
        
        case 'media':
          // Audio data from Twilio
          await handleIncomingAudio(
            callSid,
            message.media.payload,
            elevenLabsWs
          )
          break
        
        case 'stop':
          // Stream stopped - cleanup
          console.log('[Twilio] Stream stopped:', callSid)
          
          // Close 11Labs connection
          closeElevenLabsConnection(elevenLabsWs)
          
          // Clear ping interval
          if (pingInterval) {
            clearInterval(pingInterval)
          }
          
          // Close and save conversation
          const metadata = closeConnection(callSid)
          if (metadata && LOGGING_CONFIG.logLatencyMetrics) {
            console.log('[Conversation] Metadata:', metadata)
          }
          break
      }
    } catch (error) {
      console.error('[Streaming] Error handling message:', error)
    }
  })
  
  // Handle WebSocket close
  server.addEventListener('close', () => {
    console.log('[Twilio] WebSocket closed:', callSid)
    
    // Cleanup
    if (pingInterval) {
      clearInterval(pingInterval)
    }
    closeElevenLabsConnection(elevenLabsWs)
    if (callSid) {
      closeConnection(callSid)
    }
  })
  
  // Handle WebSocket error
  server.addEventListener('error', (event: Event) => {
    console.error('[Twilio] WebSocket error:', event)
  })
  
  return new Response(null, {
    status: 101,
    webSocket: client
  })
}

/**
 * Handle incoming audio from Twilio
 * Converts μ-law to PCM16 and forwards to 11Labs
 */
async function handleIncomingAudio(
  callSid: string,
  audioPayload: string,
  elevenLabsWs: WebSocket | null
): Promise<void> {
  if (!elevenLabsWs || !isElevenLabsConnected(elevenLabsWs)) {
    return
  }
  
  try {
    // Convert μ-law (Twilio) to PCM16 (11Labs)
    const pcm16Audio = mulawToPcm16(audioPayload)
    
    // Check for voice activity (optional - reduces bandwidth)
    const audioBytes = base64ToUint8Array(pcm16Audio)
    const audioSamples = new Int16Array(audioBytes.buffer)
    const hasVoice = detectVoiceActivity(audioSamples, AUDIO_BUFFER_CONFIG.silenceThreshold)
    
    if (hasVoice || LOGGING_CONFIG.logAudioChunks) {
      // Forward to 11Labs
      sendAudioToElevenLabs(elevenLabsWs, pcm16Audio, false)
      
      if (LOGGING_CONFIG.logAudioChunks) {
        console.log('[Audio] Forwarded chunk to 11Labs:', pcm16Audio.length, 'bytes', 
                   hasVoice ? '[VOICE]' : '[SILENCE]')
      }
    }
  } catch (error) {
    console.error('[Audio] Error processing incoming audio:', error)
  }
}

/**
 * Set up handlers for 11Labs WebSocket messages
 * Forwards agent audio back to Twilio and captures transcripts
 */
function setupElevenLabsHandlers(
  elevenLabsWs: WebSocket,
  twilioWs: WebSocket,
  callSid: string
): void {
  elevenLabsWs.addEventListener('message', async (event: MessageEvent) => {
    const response = handleElevenLabsMessage(event.data as string)
    
    switch (response.type) {
      case 'audio':
        // Agent audio from 11Labs - convert and send to Twilio
        await sendAudioToTwilio(
          twilioWs,
          response.payload.audio,
          callSid
        )
        break
      
      case 'transcript':
        // Capture transcript
        addTranscriptEntry(
          callSid,
          response.payload.speaker,
          response.payload.text,
          response.payload.is_final
        )
        break
      
      case 'interruption':
        // User interrupted agent - handle gracefully
        console.log('[Conversation] Interruption:', response.payload.reason)
        break
      
      case 'error':
        console.error('[11Labs] Error:', response.payload.error)
        break
    }
  })
  
  elevenLabsWs.addEventListener('error', (event: Event) => {
    console.error('[11Labs] WebSocket error:', event)
  })
  
  elevenLabsWs.addEventListener('close', (event: CloseEvent) => {
    console.log('[11Labs] WebSocket closed:', event.code, event.reason)
  })
}

/**
 * Send audio from 11Labs back to Twilio
 * Converts PCM16 to μ-law and sends via Media Stream
 */
async function sendAudioToTwilio(
  twilioWs: WebSocket,
  pcm16Audio: string,
  callSid: string
): Promise<void> {
  if (!twilioWs || twilioWs.readyState !== WebSocket.OPEN) {
    return
  }
  
  try {
    // Convert PCM16 (11Labs) to μ-law (Twilio)
    const mulawAudio = pcm16ToMulaw(pcm16Audio)
    
    // Send to Twilio Media Stream
    const mediaMessage = {
      event: 'media',
      streamSid: callSid,
      media: {
        payload: mulawAudio
      }
    }
    
    twilioWs.send(JSON.stringify(mediaMessage))
    
    if (LOGGING_CONFIG.logAudioChunks) {
      console.log('[Audio] Sent agent audio to Twilio:', mulawAudio.length, 'bytes')
    }
  } catch (error) {
    console.error('[Audio] Error sending to Twilio:', error)
  }
}

/**
 * Measure end-to-end latency
 * Time from user audio received to agent audio sent
 */
export function measureLatency(
  userAudioTimestamp: number,
  agentAudioTimestamp: number
): number {
  return agentAudioTimestamp - userAudioTimestamp
}

/**
 * Get streaming statistics for a call
 */
export function getStreamingStats(callSid: string): any {
  const state = getConnectionState(callSid)
  if (!state) return null
  
  return {
    callSid: state.callSid,
    streamSid: state.streamSid,
    conversationStarted: state.conversationStarted,
    twilioConnected: state.twilioWs ? true : false,
    elevenLabsConnected: state.elevenLabsWs ? true : false,
    transcriptLength: state.transcript.length,
    duration: Date.now() - state.startTime
  }
}
