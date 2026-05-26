/**
 * Socket.IO Service
 * Handles real-time communication between client and server
 */
class SocketService {
  constructor(url) {
    this.url = url;
    this.socket = null;
    this.listeners = {};
  }

  connect() {
    return new Promise((resolve, reject) => {
      if (this.socket && this.socket.connected) {
        resolve(this.socket);
        return;
      }

      const { io } = window;
      this.socket = io(this.url, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
      });

      this.socket.on('connect', () => {
        console.log('✓ Socket connected:', this.socket.id);
        resolve(this.socket);
      });

      this.socket.on('connect_error', (error) => {
        console.error('✗ Socket connection error:', error);
        reject(error);
      });

      // Re-register listeners on reconnection
      this.socket.on('reconnect', () => {
        console.log('✓ Socket reconnected');
        this.reregisterListeners();
      });
    });
  }

  emit(event, data) {
    if (this.socket) {
      this.socket.emit(event, data);
    } else {
      console.warn('Socket not connected');
    }
  }

  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);

    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
  }

  reregisterListeners() {
    Object.entries(this.listeners).forEach(([event, callbacks]) => {
      callbacks.forEach(callback => {
        if (this.socket) {
          this.socket.on(event, callback);
        }
      });
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  isConnected() {
    return this.socket && this.socket.connected;
  }
}

export default SocketService;
