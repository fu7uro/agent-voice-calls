/**
 * Configuration constants for conversational AI
 */

import type { ElevenLabsVoiceSettings, ElevenLabsConversationConfig } from '../types'

// ============================================
// 11Labs Voice Configuration (Hardcoded)
// ============================================

/**
 * Ivanna - Young & Casual voice settings
 * Optimized for restaurant booking and professional assistant calls
 * 
 * Settings from client configuration:
 * - Stability: 0.4 (more expressive, natural variation)
 * - Similarity: 0.85 (high voice fidelity)
 * - Speed: 0.5 (balanced, natural pace)
 */
export const VOICE_SETTINGS: ElevenLabsVoiceSettings = {
  stability: 0.4,
  similarity_boost: 0.85,
  style: 0.5, // Speed/style parameter
  use_speaker_boost: true
}

/**
 * Voice configuration for Ivanna
 */
export const IVANNA_VOICE_CONFIG = {
  voice_name: 'Ivanna',
  voice_description: 'Young & Casual - Professional yet approachable',
  model_id: 'eleven_flash_v2', // Fastest model for real-time conversations
}

/**
 * Complete conversation configuration
 */
export function getConversationConfig(conversationContext: string): ElevenLabsConversationConfig {
  return {
    model_id: IVANNA_VOICE_CONFIG.model_id,
    voice_name: IVANNA_VOICE_CONFIG.voice_name,
    voice_settings: VOICE_SETTINGS,
    language: 'en',
    conversation_context: conversationContext
  }
}

// ============================================
// Audio Configuration
// ============================================

/**
 * Twilio Media Stream audio parameters
 */
export const TWILIO_AUDIO_CONFIG = {
  encoding: 'mulaw',
  sampleRate: 8000, // Twilio uses 8kHz for μ-law
  channels: 1,
  bytesPerSample: 1
} as const

/**
 * 11Labs audio parameters
 */
export const ELEVENLABS_AUDIO_CONFIG = {
  encoding: 'pcm16',
  sampleRate: 16000, // 11Labs uses 16kHz for PCM16
  channels: 1,
  bytesPerSample: 2
} as const

/**
 * Audio buffering configuration
 */
export const AUDIO_BUFFER_CONFIG = {
  chunkDurationMs: 20, // 20ms chunks for low latency
  maxBufferMs: 1000, // Max 1 second buffer
  minBufferMs: 100, // Min 100ms before processing
  silenceThreshold: 0.01, // RMS threshold for voice detection
} as const

/**
 * WebSocket configuration
 */
export const WEBSOCKET_CONFIG = {
  pingIntervalMs: 30000, // 30 seconds
  connectionTimeoutMs: 10000, // 10 seconds
  reconnectDelayMs: 1000, // 1 second
  maxReconnectAttempts: 3,
  messageQueueSize: 100
} as const

/**
 * Conversation timeouts
 */
export const CONVERSATION_CONFIG = {
  maxDurationMs: 300000, // 5 minutes max call duration
  silenceTimeoutMs: 30000, // 30 seconds of silence ends call
  responseTimeoutMs: 10000, // 10 seconds to wait for response
  interruptionCooldownMs: 500 // 500ms cooldown after interruption
} as const

// ============================================
// 11Labs API Endpoints
// ============================================

export const ELEVENLABS_ENDPOINTS = {
  'us-east': 'wss://api.elevenlabs.io/v1/convai/conversation',
  'eu-west': 'wss://api-eu.elevenlabs.io/v1/convai/conversation',
} as const

export type ElevenLabsRegion = keyof typeof ELEVENLABS_ENDPOINTS

export function getElevenLabsWebSocketUrl(region: ElevenLabsRegion = 'us-east'): string {
  return ELEVENLABS_ENDPOINTS[region]
}

// ============================================
// Logging Configuration
// ============================================

export const LOGGING_CONFIG = {
  logAudioChunks: false, // Don't log audio data (too verbose)
  logTranscripts: true,
  logWebSocketEvents: true,
  logLatencyMetrics: true,
  logErrors: true
} as const

/**
 * Get full configuration summary for debugging
 */
export function getConfigSummary() {
  return {
    voice: {
      name: IVANNA_VOICE_CONFIG.voice_name,
      model: IVANNA_VOICE_CONFIG.model_id,
      settings: VOICE_SETTINGS
    },
    audio: {
      twilio: TWILIO_AUDIO_CONFIG,
      elevenlabs: ELEVENLABS_AUDIO_CONFIG,
      buffer: AUDIO_BUFFER_CONFIG
    },
    websocket: WEBSOCKET_CONFIG,
    conversation: CONVERSATION_CONFIG
  }
}
