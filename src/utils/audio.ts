/**
 * Audio Processing Utilities for WebSocket Streaming
 * Handles conversion between Twilio μ-law and 11Labs PCM16 formats
 */

// μ-law to linear PCM conversion table
const MULAW_TO_LINEAR = new Int16Array(256)

// Initialize μ-law lookup table
function initMuLawTable() {
  for (let i = 0; i < 256; i++) {
    const mulaw = i ^ 0xff
    let t = ((mulaw & 0x0f) << 3) + 0x84
    t <<= (mulaw & 0x70) >> 4
    MULAW_TO_LINEAR[i] = mulaw & 0x80 ? 0x84 - t : t - 0x84
  }
}

initMuLawTable()

/**
 * Convert μ-law audio (Twilio) to PCM16 (11Labs)
 * @param mulawData Base64 encoded μ-law audio from Twilio
 * @returns Base64 encoded PCM16 audio for 11Labs
 */
export function mulawToPcm16(mulawData: string): string {
  // Decode base64 to Uint8Array
  const mulawBytes = base64ToUint8Array(mulawData)
  
  // Convert μ-law to PCM16 (linear)
  const pcm16Buffer = new Int16Array(mulawBytes.length)
  for (let i = 0; i < mulawBytes.length; i++) {
    pcm16Buffer[i] = MULAW_TO_LINEAR[mulawBytes[i]]
  }
  
  // Convert Int16Array to Uint8Array (little-endian)
  const pcm16Bytes = new Uint8Array(pcm16Buffer.buffer)
  
  // Encode to base64
  return uint8ArrayToBase64(pcm16Bytes)
}

/**
 * Convert PCM16 audio (11Labs) to μ-law (Twilio)
 * @param pcm16Data Base64 encoded PCM16 audio from 11Labs
 * @returns Base64 encoded μ-law audio for Twilio
 */
export function pcm16ToMulaw(pcm16Data: string): string {
  // Decode base64 to Uint8Array
  const pcm16Bytes = base64ToUint8Array(pcm16Data)
  
  // Convert to Int16Array (little-endian)
  const pcm16Buffer = new Int16Array(pcm16Bytes.buffer)
  
  // Convert PCM16 to μ-law
  const mulawBytes = new Uint8Array(pcm16Buffer.length)
  for (let i = 0; i < pcm16Buffer.length; i++) {
    mulawBytes[i] = linearToMulaw(pcm16Buffer[i])
  }
  
  // Encode to base64
  return uint8ArrayToBase64(mulawBytes)
}

/**
 * Convert linear PCM sample to μ-law
 */
function linearToMulaw(sample: number): number {
  const BIAS = 0x84
  const CLIP = 32635
  
  let sign = 0
  let position = 0
  let magnitude = 0
  
  // Get the sign and magnitude
  if (sample < 0) {
    sample = -sample
    sign = 0x80
  }
  
  // Clip the magnitude
  sample = Math.min(sample, CLIP)
  
  // Add bias
  sample = sample + BIAS
  magnitude = sample
  
  // Find position
  if (magnitude >= 256) {
    position = 0
    let mask = 0x4000
    while ((magnitude & mask) === 0 && position < 7) {
      position++
      mask >>= 1
    }
  }
  
  const lsb = (magnitude >> (position + 3)) & 0x0f
  return (sign | (position << 4) | lsb) ^ 0xff
}

/**
 * Resample audio from one sample rate to another
 * Simple linear interpolation resampling
 */
export function resampleAudio(
  audioData: Int16Array,
  fromRate: number,
  toRate: number
): Int16Array {
  if (fromRate === toRate) {
    return audioData
  }
  
  const ratio = fromRate / toRate
  const outputLength = Math.floor(audioData.length / ratio)
  const output = new Int16Array(outputLength)
  
  for (let i = 0; i < outputLength; i++) {
    const srcIndex = i * ratio
    const srcIndexFloor = Math.floor(srcIndex)
    const srcIndexCeil = Math.min(srcIndexFloor + 1, audioData.length - 1)
    const t = srcIndex - srcIndexFloor
    
    // Linear interpolation
    output[i] = Math.round(
      audioData[srcIndexFloor] * (1 - t) + audioData[srcIndexCeil] * t
    )
  }
  
  return output
}

/**
 * Mix multiple audio streams together
 * Used for combining agent and user audio if needed
 */
export function mixAudioStreams(streams: Int16Array[]): Int16Array {
  if (streams.length === 0) return new Int16Array(0)
  if (streams.length === 1) return streams[0]
  
  const maxLength = Math.max(...streams.map(s => s.length))
  const mixed = new Int16Array(maxLength)
  
  for (let i = 0; i < maxLength; i++) {
    let sum = 0
    for (const stream of streams) {
      if (i < stream.length) {
        sum += stream[i]
      }
    }
    // Average and clip to prevent distortion
    mixed[i] = Math.max(-32768, Math.min(32767, sum / streams.length))
  }
  
  return mixed
}

/**
 * Calculate RMS (Root Mean Square) volume of audio buffer
 * Useful for voice activity detection
 */
export function calculateRMS(audioData: Int16Array): number {
  let sum = 0
  for (let i = 0; i < audioData.length; i++) {
    const normalized = audioData[i] / 32768.0
    sum += normalized * normalized
  }
  return Math.sqrt(sum / audioData.length)
}

/**
 * Detect if audio contains voice (simple energy-based VAD)
 */
export function detectVoiceActivity(audioData: Int16Array, threshold: number = 0.01): boolean {
  const rms = calculateRMS(audioData)
  return rms > threshold
}

/**
 * Create silence buffer
 */
export function createSilence(durationMs: number, sampleRate: number): Int16Array {
  const samples = Math.floor((durationMs / 1000) * sampleRate)
  return new Int16Array(samples)
}

// ============================================
// Base64 Utility Functions
// ============================================

/**
 * Convert base64 string to Uint8Array
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  // Remove data URL prefix if present
  const base64Data = base64.replace(/^data:.*?;base64,/, '')
  
  // Decode base64
  const binaryString = atob(base64Data)
  const bytes = new Uint8Array(binaryString.length)
  
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  
  return bytes
}

/**
 * Convert Uint8Array to base64 string
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = ''
  const len = bytes.byteLength
  
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  
  return btoa(binary)
}

/**
 * Convert ArrayBuffer to base64
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return uint8ArrayToBase64(new Uint8Array(buffer))
}

/**
 * Calculate audio duration from buffer size
 */
export function calculateDuration(
  bufferSize: number,
  sampleRate: number,
  bytesPerSample: number = 2
): number {
  const samples = bufferSize / bytesPerSample
  return (samples / sampleRate) * 1000 // Return in milliseconds
}

/**
 * Chunk audio into fixed-size segments
 * Useful for sending audio in consistent intervals
 */
export function chunkAudio(
  audioData: Int16Array,
  chunkSizeMs: number,
  sampleRate: number
): Int16Array[] {
  const samplesPerChunk = Math.floor((chunkSizeMs / 1000) * sampleRate)
  const chunks: Int16Array[] = []
  
  for (let i = 0; i < audioData.length; i += samplesPerChunk) {
    const chunk = audioData.slice(i, Math.min(i + samplesPerChunk, audioData.length))
    chunks.push(chunk)
  }
  
  return chunks
}

/**
 * Apply gain to audio buffer
 */
export function applyGain(audioData: Int16Array, gainDb: number): Int16Array {
  const gain = Math.pow(10, gainDb / 20)
  const output = new Int16Array(audioData.length)
  
  for (let i = 0; i < audioData.length; i++) {
    output[i] = Math.max(-32768, Math.min(32767, Math.round(audioData[i] * gain)))
  }
  
  return output
}
