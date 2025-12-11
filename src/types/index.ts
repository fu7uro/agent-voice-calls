// Environment bindings for Cloudflare Workers
export type Bindings = {
  DB: D1Database
  TWILIO_ACCOUNT_SID: string
  TWILIO_AUTH_TOKEN: string
  TWILIO_PHONE_NUMBER: string
  GOOGLE_PLACES_API_KEY: string
  OPENAI_API_KEY?: string
  ELEVENLABS_API_KEY: string
  ELEVENLABS_AGENT_ID?: string
  ELEVENLABS_API_ENDPOINT?: string
  ENVIRONMENT: string
}

// Restaurant booking request
export type RestaurantBookingRequest = {
  caller_phone_number: string // From 11Labs dynamic variable
  restaurant_name: string
  location?: string
  phone_number?: string // Optional: if already known
  reservation: {
    date: string // ISO 8601 format
    time: string // HH:MM format
    party_size: number
    special_requests?: string
  }
  client: {
    name: string
    callback_number: string
    email?: string
  }
}

// Generic outbound call request
export type GenericCallRequest = {
  caller_phone_number: string // From 11Labs dynamic variable
  recipient: {
    name: string
    phone_number: string
    context?: string
  }
  call_purpose: 'notify_client' | 'notify_colleague' | 'follow_up' | 'reminder' | 'custom'
  message_template?: 'default' | 'custom'
  conversation_context: {
    caller_name: string
    company?: string
    message: string
    callback_number: string
    expected_responses?: string[]
  }
}

// Call status and outcome
export type CallStatus = 'initiated' | 'ringing' | 'in-progress' | 'completed' | 'busy' | 'no-answer' | 'failed' | 'canceled'

export type CallOutcome = {
  success: boolean
  type: 'reservation_confirmed' | 'voicemail' | 'no_answer' | 'busy' | 'message_delivered' | 'conversation_completed' | 'failed'
  details?: {
    confirmed?: boolean
    date?: string
    time?: string
    party_size?: number
    confirmation_number?: string
    notes?: string
    alternative_times_offered?: string[]
  }
}

// Call log database record
export type CallLog = {
  id: number
  call_sid: string
  caller_phone_number: string
  recipient_phone_number: string
  recipient_name: string
  call_purpose: string
  status: CallStatus
  outcome?: CallOutcome
  duration_seconds?: number
  transcript?: string
  cost?: number
  created_at: string
  completed_at?: string
}

// API responses
export type ApiResponse<T = any> = {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export type CallResponse = {
  call_sid: string
  status: CallStatus
  estimated_completion: string
  webhook_url?: string
}

export type CallStatusResponse = {
  call_sid: string
  status: CallStatus
  duration?: number
  transcript?: string
  outcome?: CallOutcome
  cost?: number
  created_at: string
  completed_at?: string
}

// Twilio webhook payload
export type TwilioWebhookPayload = {
  CallSid: string
  AccountSid: string
  From: string
  To: string
  CallStatus: string
  Direction: string
  CallerName?: string
  Duration?: string
  RecordingUrl?: string
  TranscriptionText?: string
}

// Google Places API types
export type PlaceSearchResult = {
  place_id: string
  name: string
  formatted_address: string
  formatted_phone_number?: string
  international_phone_number?: string
  rating?: number
  user_ratings_total?: number
}

// ============================================
// WebSocket & Real-Time Conversational AI Types
// ============================================

// Twilio Media Stream message types
export type TwilioMediaStreamMessage = 
  | TwilioMediaStreamConnected
  | TwilioMediaStreamStart
  | TwilioMediaStreamMedia
  | TwilioMediaStreamStop

export type TwilioMediaStreamConnected = {
  event: 'connected'
  protocol: string
  version: string
}

export type TwilioMediaStreamStart = {
  event: 'start'
  sequenceNumber: string
  start: {
    streamSid: string
    accountSid: string
    callSid: string
    tracks: string[]
    mediaFormat: {
      encoding: string
      sampleRate: number
      channels: number
    }
    customParameters: Record<string, string>
  }
  streamSid: string
}

export type TwilioMediaStreamMedia = {
  event: 'media'
  sequenceNumber: string
  media: {
    track: string
    chunk: string
    timestamp: string
    payload: string // Base64 encoded audio
  }
  streamSid: string
}

export type TwilioMediaStreamStop = {
  event: 'stop'
  sequenceNumber: string
  stop: {
    accountSid: string
    callSid: string
  }
  streamSid: string
}

// 11Labs Conversational AI types
export type ElevenLabsVoiceSettings = {
  stability: number // 0.0 - 1.0
  similarity_boost: number // 0.0 - 1.0
  style?: number // 0.0 - 1.0
  use_speaker_boost?: boolean
}

export type ElevenLabsConversationConfig = {
  agent_id?: string
  voice_id?: string
  voice_name?: string
  model_id: string // e.g., 'eleven_flash_v2'
  voice_settings: ElevenLabsVoiceSettings
  language?: string
  conversation_context?: string
}

export type ElevenLabsWebSocketMessage =
  | ElevenLabsAudioMessage
  | ElevenLabsTranscriptMessage
  | ElevenLabsInterruptionMessage
  | ElevenLabsErrorMessage

export type ElevenLabsAudioMessage = {
  type: 'audio'
  audio: string // Base64 encoded PCM16 audio
  sample_rate: number
}

export type ElevenLabsTranscriptMessage = {
  type: 'transcript'
  text: string
  is_final: boolean
  speaker: 'agent' | 'user'
}

export type ElevenLabsInterruptionMessage = {
  type: 'interruption'
  reason: string
}

export type ElevenLabsErrorMessage = {
  type: 'error'
  error: string
  code?: string
}

// WebSocket connection state
export type WebSocketConnectionState = {
  callSid: string
  streamSid: string
  twilioWs?: WebSocket
  elevenLabsWs?: WebSocket
  conversationStarted: boolean
  transcript: TranscriptEntry[]
  audioBufferTwilio: AudioBuffer
  audioBufferElevenLabs: AudioBuffer
  conversationContext: string
  startTime: number
}

export type TranscriptEntry = {
  timestamp: number
  speaker: 'agent' | 'user' | 'system'
  text: string
  is_final: boolean
}

export type AudioBuffer = {
  chunks: Uint8Array[]
  sampleRate: number
  encoding: 'mulaw' | 'pcm16'
}

// Audio conversion types
export type AudioFormat = 'mulaw' | 'pcm16' | 'opus'

export type AudioConversionParams = {
  inputFormat: AudioFormat
  outputFormat: AudioFormat
  inputSampleRate: number
  outputSampleRate: number
  channels: number
}

// Conversation metadata
export type ConversationMetadata = {
  callSid: string
  startTime: number
  endTime?: number
  totalDuration?: number
  utteranceCount: number
  agentUtterances: number
  userUtterances: number
  interruptions: number
  averageLatency?: number
}
