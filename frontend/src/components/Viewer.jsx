import React, { useState, useEffect, useRef } from 'react';
import SocketService from '../services/socketService.js';
import '../styles/viewer.css';

/**
 * Viewer Component - Display final captions to audience
 */
function Viewer() {
  const [displayCaption, setDisplayCaption] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [captionHistory, setCaptionHistory] = useState([]);
  const socketServiceRef = useRef(null);

  useEffect(() => {
    socketServiceRef.current = new SocketService(
      import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001'
    );

    // Connect to server
    socketServiceRef.current.connect()
      .then(() => setIsConnected(true))
      .catch(err => console.error('Connection failed:', err));

    // Listen for corrected captions (final display)
    socketServiceRef.current.on('caption:display', (data) => {
      setDisplayCaption(data.text);
      setCaptionHistory(prev => [data, ...prev.slice(0, 9)]);
    });

    // Listen for caption clear
    socketServiceRef.current.on('caption:clear', () => {
      setDisplayCaption('');
    });

    return () => {
      socketServiceRef.current?.disconnect();
    };
  }, []);

  return (
    <div className="viewer-container">
      <div className="viewer-main">
        <div className={`caption-display ${displayCaption ? 'active' : 'empty'}`}>
          <p>{displayCaption || '대기 중...'}</p>
        </div>
      </div>

      {captionHistory.length > 0 && (
        <div className="caption-history">
          <h3>최근 자막</h3>
          <div className="history-list">
            {captionHistory.map((caption, idx) => (
              <div key={idx} className="history-item">
                {caption.text}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={`connection-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
        {isConnected ? '✓ 연결됨' : '✗ 연결 대기 중'}
      </div>
    </div>
  );
}

export default Viewer;
