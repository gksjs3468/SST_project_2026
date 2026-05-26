import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import SocketManager from './socketManager.js';

// Load environment variables
dotenv.config();

const app = express();
const httpServer = createServer(app);

// Socket.IO configuration
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.SOCKET_CORS || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    activeSessions: socketManager?.getActiveSessionsCount() || 0,
  });
});

// Initialize Socket Manager
const socketManager = new SocketManager(io);

// Initialize services
async function initializeServices() {
  try {
    await socketManager.initialize();
    console.log('✓ All services initialized successfully');
  } catch (error) {
    console.error('✗ Failed to initialize services:', error);
    process.exit(1);
  }
}

// Error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start server
const PORT = process.env.PORT || 3001;

initializeServices().then(() => {
  httpServer.listen(PORT, () => {
    console.log(`\n╔════════════════════════════════════════════╗`);
    console.log(`║  STT Caption Server running on port ${PORT}    ║`);
    console.log(`║  Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`╚════════════════════════════════════════════╝\n`);
  });
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  httpServer.close(() => {
    console.log('✓ Server closed');
    socketManager.clovaService.close();
    process.exit(0);
  });
});

export { app, httpServer, io, socketManager };
