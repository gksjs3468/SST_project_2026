import { SOCKET_EVENTS } from '../config/socket.config.js';
import ClovaService from './clovaService.js';
import AudioProcessor from './utils/audioProcessor.js';
import { startMockStream } from './mockDataGenerator.js';

/**
 * SocketManager handles real-time communication with clients
 */
export class SocketManager {
  constructor(io) {
    this.io = io;
    this.clovaService = new ClovaService();
    this.audioProcessor = new AudioProcessor();
    this.activeSessions = new Map(); // sessionId -> sessionData
    this.testMode = process.env.NODE_ENV !== 'production' || process.env.TEST_MODE === 'true';
    this.mockStreamStops = new Map(); // sessionId -> stopFunction
    this.initializeEventHandlers();
  }

  async initialize() {
    if (this.testMode) {
      console.log('✓ Test mode enabled - Using mock data');
    } else {
      await this.clovaService.initialize();
    }
  }

  initializeEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`✓ Client connected: ${socket.id}`);

      // Audio streaming events
      socket.on(SOCKET_EVENTS.AUDIO_STREAM_START, (data) => {
        this.handleAudioStreamStart(socket, data);
      });

      socket.on(SOCKET_EVENTS.AUDIO_STREAM_DATA, (data) => {
        this.handleAudioStreamData(socket, data);
      });

      socket.on(SOCKET_EVENTS.AUDIO_STREAM_END, () => {
        this.handleAudioStreamEnd(socket);
      });

      // Caption correction events
      socket.on(SOCKET_EVENTS.CAPTION_CORRECTION, (data) => {
        this.handleCaptionCorrection(socket, data);
      });

      // Caption final events (from admin - situation captions)
      socket.on('caption:final', (data) => {
        console.log(`📋 Final caption received:`, data);
        // Broadcast to all clients
        this.io.emit('caption:final', data);
      });

      // Caption clear all event
      socket.on('caption:clearAll', () => {
        this.handleClearAllCaptions(socket);
      });

      // Disconnection
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }

  /**
   * Handle audio stream start
   */
  handleAudioStreamStart(socket, data) {
    const sessionId = socket.id;
    const { mode } = data; // 'admin' or 'user'

    console.log(`Audio stream started: ${sessionId} (${mode})`);

    if (this.testMode) {
      // Test mode: Use mock data
      console.log(`  → Using mock data for testing`);

      const stopMockStream = startMockStream(
        (interim) => this.handleInterimResult(socket, interim),
        (final) => this.handleFinalResult(socket, final)
      );

      this.mockStreamStops.set(sessionId, stopMockStream);

      this.activeSessions.set(sessionId, {
        stream: null,
        mode,
        captions: [],
        corrections: {},
        startTime: Date.now(),
        isMockMode: true,
      });
    } else {
      // Production mode: Use Clova gRPC
      const stream = this.clovaService.createSpeechStream(
        (interim) => this.handleInterimResult(socket, interim),
        (final) => this.handleFinalResult(socket, final),
        (error) => this.handleStreamError(socket, error)
      );

      this.activeSessions.set(sessionId, {
        stream,
        mode,
        captions: [],
        corrections: {},
        startTime: Date.now(),
        isMockMode: false,
      });
    }
  }

  /**
   * Handle incoming audio data
   */
  handleAudioStreamData(socket, data) {
    const sessionId = socket.id;
    const session = this.activeSessions.get(sessionId);

    if (!session) {
      console.warn(`No active session for: ${sessionId}`);
      return;
    }

    try {
      const { audioBuffer } = data;
      const pcmBuffer = this.audioProcessor.processToPCM(audioBuffer);
      session.stream.write(pcmBuffer);
    } catch (error) {
      console.error('Error processing audio data:', error);
      socket.emit('error', { message: 'Audio processing error' });
    }
  }

  /**
   * Handle stream end
   */
  handleAudioStreamEnd(socket) {
    const sessionId = socket.id;
    const session = this.activeSessions.get(sessionId);

    if (session) {
      if (session.isMockMode) {
        const stopFn = this.mockStreamStops.get(sessionId);
        if (stopFn) {
          stopFn();
          this.mockStreamStops.delete(sessionId);
        }
      } else {
        session.stream.end();
      }
      console.log(`Audio stream ended: ${sessionId}`);
    }
  }

  /**
   * Handle interim (intermediate) recognition results
   */
  handleInterimResult(socket, result) {
    // Generate unique ID for this caption
    const captionId = `caption_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const captionData = {
      id: captionId,
      text: result.text,
      confidence: result.confidence,
      isFinal: false,
      timestamp: Date.now(),
      tokens: result.tokens || [],
    };

    // Emit to admin interface
    socket.emit(SOCKET_EVENTS.CAPTION_INTERIM, captionData);

    // Store caption for tracking
    const session = this.activeSessions.get(socket.id);
    if (session) {
      session.captions.push(captionData);
    }
  }

  /**
   * Handle final recognition results
   */
  handleFinalResult(socket, result) {
    // Generate unique ID for this final caption
    const captionId = `final_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const captionData = {
      id: captionId,
      text: result.text,
      confidence: result.confidence,
      isFinal: true,
      timestamp: Date.now(),
      tokens: result.tokens || [],
    };

    // Emit to admin interface
    socket.emit(SOCKET_EVENTS.CAPTION_FINAL, captionData);

    // Broadcast to all viewers immediately
    this.io.emit(SOCKET_EVENTS.CAPTION_DISPLAY, {
      id: captionId,
      text: result.text,
      isFinal: true,
    });

    // Store caption
    const session = this.activeSessions.get(socket.id);
    if (session) {
      session.captions.push(captionData);
    }
  }

  /**
   * Handle stream errors
   */
  handleStreamError(socket, error) {
    console.error('Stream error:', error);
    socket.emit('error', { message: 'Stream processing error' });
  }

  /**
   * Handle caption correction from admin
   */
  handleCaptionCorrection(socket, data) {
    const { captionId, correctedText } = data;

    console.log(`Caption corrected: ${captionId} -> "${correctedText}"`);

    const session = this.activeSessions.get(socket.id);
    if (session) {
      session.corrections[captionId] = correctedText;
    }

    // Broadcast corrected caption to all viewers
    this.io.emit(SOCKET_EVENTS.CAPTION_CORRECTED, {
      id: captionId,
      text: correctedText,
      timestamp: Date.now(),
    });
  }

  /**
   * Handle caption clear all request
   */
  handleClearAllCaptions(socket) {
    console.log(`Clearing all captions for session: ${socket.id}`);

    const session = this.activeSessions.get(socket.id);
    if (session) {
      session.captions = [];
      session.corrections = {};
    }

    // Broadcast clear event to all viewers
    this.io.emit('caption:clear');
  }

  /**
   * Handle client disconnect
   */
  handleDisconnect(socket) {
    const sessionId = socket.id;
    const session = this.activeSessions.get(sessionId);

    if (session) {
      if (session.isMockMode) {
        const stopFn = this.mockStreamStops.get(sessionId);
        if (stopFn) {
          stopFn();
          this.mockStreamStops.delete(sessionId);
        }
      } else {
        session.stream.end();
      }
      this.activeSessions.delete(sessionId);
    }

    console.log(`✗ Client disconnected: ${sessionId}`);
  }

  /**
   * Get active sessions count
   */
  getActiveSessionsCount() {
    return this.activeSessions.size;
  }
}

export default SocketManager;
