import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import { clovaConfig, getAuthHeaders } from '../config/clova.config.js';

/**
 * ClovaService handles gRPC streaming with Naver Clova Speech API
 */
export class ClovaService {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  /**
   * Initialize gRPC connection to Clova
   */
  async initialize() {
    try {
      // Note: In production, you need the actual .proto file from Naver
      // For now, this is a placeholder structure
      
      const packageDefinition = protoLoader.loadSync(
        './proto/clova_speech.proto',
        {
          keepCase: true,
          longs: String,
          enums: String,
          defaults: true,
          oneofs: true,
        }
      );

      const clovaProto = grpc.loadPackageDefinition(packageDefinition);
      
      // Create channel and client
      const credentials = grpc.credentials.createInsecure();
      this.client = new clovaProto.com.naver.speech.ClovaspeechService(
        clovaConfig.apiUrl,
        credentials
      );

      this.isConnected = true;
      console.log('✓ Clova gRPC connection initialized');
    } catch (error) {
      console.error('✗ Failed to initialize Clova service:', error);
      throw error;
    }
  }

  /**
   * Start streaming audio to Clova API
   * @param {Function} onInterim - Callback for interim results
   * @param {Function} onFinal - Callback for final results
   * @param {Function} onError - Callback for errors
   * @returns {Object} - Stream controller
   */
  createSpeechStream(onInterim, onFinal, onError) {
    if (!this.isConnected) {
      throw new Error('Clova service not connected');
    }

    let stream = null;
    let isActive = true;

    try {
      // Create bidirectional stream
      stream = this.client.Recognize((err, response) => {
        if (err) {
          console.error('Stream error:', err);
          onError?.(err);
          isActive = false;
        }
      });

      // Handle server responses
      stream.on('data', (response) => {
        if (!isActive) return;

        try {
          if (response.result) {
            const result = {
              text: response.result.message,
              confidence: response.result.confidence,
              isFinal: response.result.isFinal || false,
              tokens: response.result.tokens || [],
            };

            if (result.isFinal) {
              onFinal?.(result);
            } else {
              onInterim?.(result);
            }
          }
        } catch (e) {
          console.error('Error processing stream data:', e);
          onError?.(e);
        }
      });

      stream.on('end', () => {
        isActive = false;
        console.log('Stream ended');
      });

      stream.on('error', (error) => {
        console.error('Stream error event:', error);
        onError?.(error);
        isActive = false;
      });

    } catch (error) {
      console.error('Error creating speech stream:', error);
      onError?.(error);
    }

    return {
      write: (audioBuffer) => {
        if (isActive && stream) {
          try {
            const request = {
              audio: {
                content: audioBuffer,
              },
              config: {
                encoding: clovaConfig.audioConfig.encoding,
                sampleRateHertz: clovaConfig.audioConfig.sampleRate,
                languageCode: clovaConfig.language,
              },
            };
            stream.write(request);
          } catch (error) {
            console.error('Error writing to stream:', error);
            onError?.(error);
          }
        }
      },
      end: () => {
        if (stream) {
          isActive = false;
          stream.end();
        }
      },
      isActive: () => isActive,
    };
  }

  /**
   * Close gRPC connection
   */
  close() {
    if (this.client) {
      grpc.closeClient(this.client);
      this.isConnected = false;
      console.log('✓ Clova gRPC connection closed');
    }
  }
}

export default ClovaService;
