import React, { useState, useEffect, useRef } from 'react';
import SocketService from '../services/socketService.js';
import '../styles/viewer.css';

/**
 * Viewer Component - Display final captions to audience
 */
function Viewer() {
  const [captionHistory, setCaptionHistory] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const socketServiceRef = useRef(null);

  const MAX_CAPTIONS = 60; // 자동 초기화 기준

  useEffect(() => {
    socketServiceRef.current = new SocketService(
      import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001'
    );

    // Connect to server
    socketServiceRef.current.connect()
      .then(() => setIsConnected(true))
      .catch(err => console.error('Connection failed:', err));

    // Listen for final captions
    socketServiceRef.current.on('caption:final', (data) => {
      setCaptionHistory(prev => {
        const updated = [...prev, data];
        // 자동 초기화: MAX_CAPTIONS을 넘으면 가장 오래된 항목 제거
        if (updated.length > MAX_CAPTIONS) {
          return updated.slice(updated.length - MAX_CAPTIONS);
        }
        return updated;
      });
    });

    // Listen for corrected captions - update existing caption
    socketServiceRef.current.on('caption:corrected', (data) => {
      setCaptionHistory(prev => {
        // 기존 ID를 가진 항목을 찾아서 업데이트 (새로 추가하지 않음)
        const found = prev.findIndex(item => item.id === data.id);
        if (found !== -1) {
          // 기존 항목을 업데이트
          const updated = [...prev];
          updated[found] = {
            ...updated[found],
            text: data.text,
            isCorrection: true
          };
          return updated;
        }
        // ID를 못 찾으면 그냥 반환 (추가하지 않음)
        return prev;
      });
    });

    // Listen for caption clear
    socketServiceRef.current.on('caption:clear', () => {
      setCaptionHistory([]);
    });

    // Listen for display captions (final captions from backend)
    socketServiceRef.current.on('caption:display', (data) => {
      setCaptionHistory(prev => {
        const updated = [...prev, data];
        if (updated.length > MAX_CAPTIONS) {
          return updated.slice(updated.length - MAX_CAPTIONS);
        }
        return updated;
      });
    });

    return () => {
      socketServiceRef.current?.disconnect();
    };
  }, []);

  return (
    <div className="viewer-container">
      <div className="caption-flow-container">
        {captionHistory.length === 0 ? (
          <span className="empty-stream">대기 중...</span>
        ) : (
          <div className="caption-flow">
            {captionHistory.map((caption, idx) => {
              // 텍스트 필드 우선순위: text > correctedText > originalText
              const displayText = caption.text || caption.correctedText || caption.originalText || '';
              return (
                <span
                  key={idx}
                  className={`caption-word ${caption.isCorrection || caption.isSituation ? 'corrected' : ''}`}
                >
                  {displayText}
                </span>
              );
            })}
          </div>
        )}
      </div>

      <div className={`connection-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
        {isConnected ? '✓ 연결됨' : '✗ 연결 대기 중'}
      </div>
    </div>
  );
}

export default Viewer;
