import React, { useState, useEffect, useRef } from 'react';
import SocketService from '../services/socketService.js';
import AudioService from '../services/audioService.js';
import { captionStore } from '../store/captionStore.js';
import '../styles/admin.css';

/**
 * Admin Component - Real-time caption editing interface
 */
function Admin() {
  const [captions, setCaptions] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [stats, setStats] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const socketServiceRef = useRef(null);
  const audioServiceRef = useRef(null);
  const audioBufferRef = useRef([]);

  // Initialize Socket and Audio services
  useEffect(() => {
    socketServiceRef.current = new SocketService(
      import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001'
    );
    audioServiceRef.current = new AudioService();

    // Connect to server
    socketServiceRef.current.connect()
      .then(() => setIsConnected(true))
      .catch(err => console.error('Connection failed:', err));

    // Listen for interim captions
    socketServiceRef.current.on('caption:interim', (data) => {
      captionStore.addInterimCaption(data);
    });

    // Listen for final captions
    socketServiceRef.current.on('caption:final', (data) => {
      captionStore.addFinalCaption(data);
    });

    // Subscribe to store changes
    const unsubscribe = captionStore.subscribe((state) => {
      setCaptions(state.captions);
      setStats(state.stats);
    });

    return () => {
      unsubscribe();
      socketServiceRef.current?.disconnect();
      audioServiceRef.current?.stopRecording();
    };
  }, []);

  /**
   * Toggle audio recording
   */
  const toggleRecording = async () => {
    try {
      if (!isRecording) {
        // Start recording
        await audioServiceRef.current.startRecording((audioData) => {
          const pcmData = AudioService.float32ToPCM(audioData);
          audioBufferRef.current.push(pcmData);

          // Send audio data to server
          socketServiceRef.current.emit('audio:stream:data', {
            audioBuffer: pcmData.buffer,
          });
        });

        // Notify server stream start
        socketServiceRef.current.emit('audio:stream:start', {
          mode: 'admin',
        });

        setIsRecording(true);
      } else {
        // Stop recording
        audioServiceRef.current.stopRecording();
        socketServiceRef.current.emit('audio:stream:end');
        setIsRecording(false);
        audioBufferRef.current = [];
      }
    } catch (error) {
      console.error('Recording error:', error);
      alert('마이크 사용 권한이 필요합니다.');
    }
  };

  /**
   * Handle caption correction
   */
  const handleCorrection = (captionId, correctedText) => {
    // Update store
    captionStore.correctCaption(captionId, correctedText);

    // Send correction to server
    socketServiceRef.current.emit('caption:correction', {
      captionId,
      correctedText,
    });

    setEditingId(null);
    setEditText('');
  };

  /**
   * Start editing a caption
   */
  const startEdit = (caption) => {
    setEditingId(caption.id);
    setEditText(caption.originalText);
  };

  /**
   * Handle enter key in edit field
   */
  const handleKeyDown = (e, captionId) => {
    if (e.key === 'Enter') {
      handleCorrection(captionId, editText);
    } else if (e.key === 'Escape') {
      setEditingId(null);
      setEditText('');
    }
  };

  return (
    <div className="admin-container">
      <header className="admin-header">
        <h1>📝 실시간 자막 편집기</h1>
        
        <div className="admin-controls">
          <button
            className={`btn-record ${isRecording ? 'recording' : ''}`}
            onClick={toggleRecording}
            disabled={!isConnected}
          >
            {isRecording ? '⏹ 녹음 중지' : '🎤 녹음 시작'}
          </button>

          <div className="connection-status">
            <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></span>
            {isConnected ? '✓ 연결됨' : '✗ 연결 대기 중'}
          </div>
        </div>
      </header>

      {stats && (
        <div className="admin-stats">
          <div className="stat-item">
            <span className="stat-label">총 자막</span>
            <span className="stat-value">{stats.total}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">완료된 문장</span>
            <span className="stat-value">{stats.final}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">수정됨</span>
            <span className="stat-value">{stats.corrected}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">수정율</span>
            <span className="stat-value">{stats.correctionRate.toFixed(1)}%</span>
          </div>
        </div>
      )}

      <div className="captions-list">
        <h2>자막 목록</h2>
        {captions.length === 0 ? (
          <div className="empty-state">
            <p>아직 자막이 없습니다. 녹음을 시작해주세요.</p>
          </div>
        ) : (
          captions.map((caption) => (
            <div
              key={caption.id}
              className={`caption-item ${caption.status} ${
                editingId === caption.id ? 'editing' : ''
              }`}
            >
              <div className="caption-meta">
                <span className={`badge status-${caption.status}`}>
                  {caption.status === 'interim' && '입력 중'}
                  {caption.status === 'final' && '완료'}
                  {caption.status === 'corrected' && '수정됨'}
                </span>
                <span className="confidence">
                  신뢰도: {(caption.confidence * 100).toFixed(0)}%
                </span>
              </div>

              {editingId === caption.id ? (
                <div className="caption-editor">
                  <input
                    autoFocus
                    type="text"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, caption.id)}
                    className="edit-input"
                    placeholder="수정된 텍스트 입력..."
                  />
                  <div className="edit-hint">
                    Enter: 저장 | Esc: 취소
                  </div>
                </div>
              ) : (
                <div
                  className="caption-text"
                  onClick={() => startEdit(caption)}
                >
                  <p className={caption.correctedText ? 'original' : ''}>
                    {caption.originalText}
                  </p>
                  {caption.correctedText && (
                    <p className="corrected">
                      ✓ {caption.correctedText}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default Admin;
