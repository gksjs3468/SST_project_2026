/**
 * Audio Service
 * Handles microphone access and audio capture
 */
class AudioService {
  constructor() {
    this.mediaStream = null;
    this.audioContext = null;
    this.processor = null;
    this.isRecording = false;
  }

  /**
   * Request microphone permission and start recording
   */
  async startRecording(onAudioData) {
    try {
      // Request microphone permission
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      // Create audio context
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000,
      });

      const source = this.audioContext.createMediaStreamSource(this.mediaStream);

      // Create ScriptProcessorNode for audio processing
      // Note: ScriptProcessorNode is deprecated, but we'll use it for compatibility
      // In production, consider using AudioWorklet
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      this.processor.onaudioprocess = (event) => {
        if (this.isRecording) {
          const audioData = event.inputBuffer.getChannelData(0);
          onAudioData(new Float32Array(audioData));
        }
      };

      source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

      this.isRecording = true;
      console.log('✓ Audio recording started');
      return true;
    } catch (error) {
      console.error('✗ Failed to start recording:', error);
      throw error;
    }
  }

  /**
   * Stop recording
   */
  stopRecording() {
    this.isRecording = false;

    if (this.processor) {
      this.processor.disconnect();
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
    }

    if (this.audioContext) {
      this.audioContext.close();
    }

    console.log('✓ Audio recording stopped');
  }

  /**
   * Convert Float32Array to PCM (Int16Array)
   */
  static float32ToPCM(float32Array) {
    const pcmArray = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      pcmArray[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return pcmArray;
  }

  /**
   * Check if microphone permission is granted
   */
  static async checkPermission() {
    try {
      const permission = await navigator.permissions.query({ name: 'microphone' });
      return permission.state;
    } catch (error) {
      console.warn('Permission API not available');
      return 'unknown';
    }
  }

  /**
   * Check browser support for Web Audio API
   */
  static isSupported() {
    return !!(
      navigator.mediaDevices &&
      navigator.mediaDevices.getUserMedia &&
      (window.AudioContext || window.webkitAudioContext)
    );
  }
}

export default AudioService;
