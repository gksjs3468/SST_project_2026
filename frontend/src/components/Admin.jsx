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
  const [editText, setEditText] = useState('');
  const [quickEditMode, setQuickEditMode] = useState(false);
  const [expandedCorrected, setExpandedCorrected] = useState(true);
  const [selectedCardId, setSelectedCardId] = useState(null);
  const [situationText, setSituationText] = useState('');
  const [testMode] = useState(true);
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
      .then(() => {
        setIsConnected(true);
        if (testMode) {
          setTimeout(() => {
            handleTestModeStart();
          }, 500);
        }
      })
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
  }, [testMode]);

  /**
   * Get pending captions (미수정)
   */
  const getPendingCaptions = () => {
    return captions.filter(c => c.isFinal && c.status !== 'corrected').slice().reverse();
  };

  /**
   * Get corrected captions (수정됨)
   */
  const getCorrectedCaptions = () => {
    return captions.filter(c => c.status === 'corrected').slice().reverse();
  };

  /**
   * Get the most recent pending caption (for quick edit mode)
   */
  const getMostRecentPending = () => {
    const pending = getPendingCaptions();
    return pending[0] || null;
  };

  /**
   * Get selected caption object
   */
  const getSelectedCaption = () => {
    return captions.find(c => c.id === selectedCardId) || null;
  };

  const handleTestModeStart = async () => {
    socketServiceRef.current.emit('audio:stream:start', { mode: 'admin' });
    setIsRecording(true);
  };

  const handleTestModeStop = () => {
    socketServiceRef.current.emit('audio:stream:end');
    setIsRecording(false);
  };

  const toggleRecording = async () => {
    if (testMode) {
      if (isRecording) {
        handleTestModeStop();
      } else {
        handleTestModeStart();
      }
      return;
    }

    try {
      if (!isRecording) {
        await audioServiceRef.current.startRecording((audioData) => {
          const pcmData = AudioService.float32ToPCM(audioData);
          audioBufferRef.current.push(pcmData);
          socketServiceRef.current.emit('audio:stream:data', {
            audioBuffer: pcmData.buffer,
          });
        });

        socketServiceRef.current.emit('audio:stream:start', { mode: 'admin' });
        setIsRecording(true);
      } else {
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
    captionStore.correctCaption(captionId, correctedText);
    socketServiceRef.current.emit('caption:correction', {
      captionId,
      correctedText,
    });

    setEditText('');
    setSelectedCardId(null);
  };

  /**
   * Start editing a caption
   */
  const startEdit = (caption) => {
    setSelectedCardId(caption.id);
    setEditText(caption.correctedText || caption.originalText);
  };

  /**
   * Handle key down in edit field
   */
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      const selected = getSelectedCaption();
      if (selected) {
        handleCorrection(selected.id, editText);
      }
    } else if (e.key === 'Escape') {
      setSelectedCardId(null);
      setEditText('');
    }
  };

  const handleClearHistory = () => {
    if (captions.length === 0) {
      alert('초기화할 기록이 없습니다.');
      return;
    }

    if (window.confirm(`현재 기록 ${captions.length}개를 모두 초기화하시겠습니까?\n(웹소켓은 유지됩니다)`)) {
      captionStore.clearAllCaptions();
      socketServiceRef.current.emit('caption:clearAll');
    }
  };

  /**
   * Add situation caption (상황 묘사 자막)
   */
  const addSituationCaption = (text) => {
    if (!text.trim()) return;
    
    const situationCaption = {
      id: `situation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      text: text,
      originalText: text,
      correctedText: null,
      isFinal: true,
      status: 'final',
      confidence: 1.0,
      isCorrection: false,
      isSituation: true,
    };
    
    captionStore.addFinalCaption(situationCaption);
    socketServiceRef.current.emit('caption:final', situationCaption);
    setSituationText('');
  };

  // Situation presets
  const situationPresets = [
    { emoji: '👏', label: '박수 소리', text: '[성도들이 기쁨으로 박수 치며 찬양하는 중]' },
    { emoji: '🙏', label: '경건한 기도', text: '[경건한 기도의 시간]' },
    { emoji: '🎵', label: '음악 연주', text: '[오르간 음악이 울려 퍼지는 중]' },
    { emoji: '🎤', label: '찬양곡', text: '[성도들이 함께 찬양곡을 부르는 중]' },
    { emoji: '💃', label: '찬양 춤', text: '[신도들이 찬양 춤을 추는 중]' },
    { emoji: '😭', label: '감사의 눈물', text: '[감사와 기쁨의 눈물]' },
    { emoji: '🤫', label: '경건한 침묵', text: '[경건한 침묵]' },
    { emoji: '🎼', label: '악기 연주', text: '[현악기 앙상블 연주]' },
  ];

  const pendingCaptions = getPendingCaptions();
  const correctedCaptions = getCorrectedCaptions();
  const selectedCaption = getSelectedCaption();

  // Auto-select first pending when quick edit mode enabled
  useEffect(() => {
    if (quickEditMode) {
      const first = getMostRecentPending();
      if (first) {
        setSelectedCardId(first.id);
        setEditText(first.originalText);
      }
    }
  }, [quickEditMode]);

  return (
    <div className="admin-container">
      <header className="admin-header">
        <div>
          <h1>📝 실시간 자막 편집기</h1>
          {testMode && <p className="test-mode-badge">🧪 테스트 모드 (Mock 데이터)</p>}
        </div>

        <div className="admin-controls">
          <button
            className={`btn-record ${isRecording ? 'recording' : ''}`}
            onClick={toggleRecording}
            disabled={!isConnected}
          >
            {isRecording ? '⏹ 중지' : '▶ 시작'}
          </button>

          <button
            className={`btn-mode ${quickEditMode ? 'active' : ''}`}
            onClick={() => setQuickEditMode(!quickEditMode)}
            title="신속 편집 모드: 최근 미수정 자막을 크게 표시"
          >
            ⚡ 신속 모드
          </button>

          <button
            className="btn-clear"
            onClick={handleClearHistory}
            title="현재 기록을 모두 초기화합니다 (웹소켓 유지)"
          >
            🔄 기록 초기화
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
            <span className="stat-label">총</span>
            <span className="stat-value">{stats.total}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">완료</span>
            <span className="stat-value">{stats.final}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">수정</span>
            <span className="stat-value">{stats.corrected}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">율</span>
            <span className="stat-value">{stats.correctionRate.toFixed(0)}%</span>
          </div>
        </div>
      )}

      {quickEditMode && selectedCaption ? (
        <div className="quick-edit-panel">
          <div className="quick-edit-title">⚡ 신속 편집 모드</div>
          <div className="quick-edit-item">
            <p>{selectedCaption.originalText}</p>
            {selectedCaption.correctedText && (
              <p className="corrected">✓ {selectedCaption.correctedText}</p>
            )}
          </div>
        </div>
      ) : null}

      {/* 상황 묘사 자막 섹션 */}
      <div className="situation-section">
        <div className="situation-header">
          <h3>🎬 상황 묘사 자막</h3>
        </div>
        <div className="situation-content">
          <div className="preset-buttons">
            {situationPresets.map((preset, idx) => (
              <button
                key={idx}
                className="preset-btn"
                onClick={() => addSituationCaption(preset.text)}
                title={preset.text}
              >
                <span className="preset-emoji">{preset.emoji}</span>
                <span className="preset-label">{preset.label}</span>
              </button>
            ))}
          </div>
          <div className="custom-situation">
            <input
              type="text"
              value={situationText}
              onChange={(e) => setSituationText(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  addSituationCaption(situationText);
                }
              }}
              className="situation-input"
              placeholder="직접 입력: [예배 시간의 모습을...]"
            />
            <button
              className="btn-add-situation"
              onClick={() => addSituationCaption(situationText)}
              disabled={!situationText.trim()}
            >
              추가
            </button>
          </div>
        </div>
      </div>

      <div className="admin-layout">
        {/* 왼쪽 패널: 자막 리스트 */}
        <div className="captions-container">
          {/* 미수정 섹션 */}
          <section className="captions-section pending-section">
            <div className="section-header">
              <h2>📋 대기 중인 자막 ({pendingCaptions.length})</h2>
              {pendingCaptions.length === 0 && <span className="section-status">✓ 모두 수정됨</span>}
            </div>
            <div className="section-content">
              {pendingCaptions.length === 0 ? (
                <div className="empty-section">
                  <p>✓ 모든 자막이 수정되었습니다!</p>
                </div>
              ) : (
                pendingCaptions.map((caption) => (
                  <div
                    key={caption.id}
                    className={`caption-card ${selectedCardId === caption.id ? 'selected' : ''}`}
                    onClick={() => startEdit(caption)}
                  >
                    <div className="caption-card-content">
                      <div className="card-text-section">
                        <p className="original-text">{caption.originalText}</p>
                      </div>
                      <div className="card-footer">
                        <span className="confidence">{(caption.confidence * 100).toFixed(0)}%</span>
                        <span className="edit-hint-icon">클릭으로 수정</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* 수정됨 섹션 */}
          {correctedCaptions.length > 0 && (
            <section className="captions-section corrected-section">
              <div
                className="section-header collapsible"
                onClick={() => setExpandedCorrected(!expandedCorrected)}
              >
                <h2>✓ 완료된 자막 ({correctedCaptions.length})</h2>
                <span className="collapse-icon">{expandedCorrected ? '▼' : '▶'}</span>
              </div>
              {expandedCorrected && (
                <div className="section-content">
                  {correctedCaptions.map((caption) => (
                    <div key={caption.id} className="caption-card completed">
                      <div className="caption-card-content">
                        <div className="card-text-section">
                          <p className="original-text">{caption.originalText}</p>
                          {caption.correctedText && (
                            <p className="corrected-text">→ {caption.correctedText}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>

        {/* 오른쪽 패널: 수정 에디터 */}
        {selectedCaption && (
          <div className="edit-panel">
            <div className="edit-panel-header">
              <h3>수정</h3>
              <button
                className="btn-close-panel"
                onClick={() => {
                  setSelectedCardId(null);
                  setEditText('');
                }}
              >
                ✕
              </button>
            </div>
            <div className="edit-panel-content">
              <div className="edit-field">
                <label>원본</label>
                <div className="original-display">{selectedCaption.originalText}</div>
              </div>
              <div className="edit-field">
                <label>수정 내용</label>
                <input
                  autoFocus
                  type="text"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="edit-panel-input"
                  placeholder="수정 내용 입력..."
                />
              </div>
              <div className="edit-panel-actions">
                <button
                  className="btn-save"
                  onClick={() => handleCorrection(selectedCaption.id, editText)}
                >
                  💾 저장
                </button>
                <button
                  className="btn-cancel"
                  onClick={() => {
                    setSelectedCardId(null);
                    setEditText('');
                  }}
                >
                  취소
                </button>
              </div>
              <div className="edit-panel-hint">Enter 또는 저장 버튼 클릭</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Admin;
