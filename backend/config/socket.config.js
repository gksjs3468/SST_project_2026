// Socket.IO Configuration
export const socketConfig = {
  cors: {
    origin: process.env.SOCKET_CORS || 'http://localhost:5174',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5,
};

// Socket Events
export const SOCKET_EVENTS = {
  // Client to Server
  AUDIO_STREAM_START: 'audio:stream:start',
  AUDIO_STREAM_DATA: 'audio:stream:data',
  AUDIO_STREAM_END: 'audio:stream:end',
  CAPTION_CORRECTION: 'caption:correction',
  
  // Server to Client (Admin)
  CAPTION_INTERIM: 'caption:interim',
  CAPTION_FINAL: 'caption:final',
  CAPTION_CORRECTED: 'caption:corrected',
  
  // Server to Client (Viewer)
  CAPTION_DISPLAY: 'caption:display',
  CAPTION_CLEAR: 'caption:clear',
};
