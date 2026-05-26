// Audio Processing Utilities
export class AudioProcessor {
  constructor(config = {}) {
    this.sampleRate = config.sampleRate || 16000;
    this.channels = config.channels || 1;
    this.encoding = config.encoding || 'PCM';
  }

  /**
   * Convert audio data to PCM format required by Clova
   * @param {ArrayBuffer} audioBuffer - Raw audio buffer
   * @returns {Buffer} - Processed audio buffer
   */
  processToPCM(audioBuffer) {
    // Convert Float32Array to Int16Array (PCM)
    const floatSamples = new Float32Array(audioBuffer);
    const pcmBuffer = new Int16Array(floatSamples.length);
    
    for (let i = 0; i < floatSamples.length; i++) {
      const s = Math.max(-1, Math.min(1, floatSamples[i]));
      pcmBuffer[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    
    return Buffer.from(pcmBuffer.buffer);
  }

  /**
   * Validate audio format compatibility with Clova
   * @param {Object} config - Audio configuration
   * @returns {boolean} - True if valid
   */
  validateAudioFormat(config) {
    const valid = 
      config.sampleRate === 16000 &&
      config.channels === 1 &&
      (config.encoding === 'PCM' || config.encoding === 'FLAC');
    
    return valid;
  }

  /**
   * Calculate audio buffer size
   * @param {number} durationMs - Duration in milliseconds
   * @returns {number} - Buffer size in bytes
   */
  calculateBufferSize(durationMs) {
    const durationSec = durationMs / 1000;
    const bytesPerSample = 2; // 16-bit PCM
    return Math.floor(this.sampleRate * this.channels * bytesPerSample * durationSec);
  }
}

export default AudioProcessor;
