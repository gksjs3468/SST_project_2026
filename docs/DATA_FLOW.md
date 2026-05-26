# 데이터 흐름 상세 분석

## 1. JSON 데이터 구조 설계

### 1.1 Caption Data Structure (자막 데이터)

```json
{
  "id": "final_1716723600000_abc123xyz",
  "text": "안녕하세요 여기는 예배당입니다",
  "originalText": "안녕하세요 여기는 예배당입니다",
  "correctedText": "안녕하세요. 여기는 예배당입니다",
  "confidence": 0.95,
  "isFinal": true,
  "status": "corrected",
  "timestamp": 1716723600000,
  "correctedAt": 1716723605000,
  "tokens": [
    {
      "text": "안녕하세요",
      "confidence": 0.98,
      "startTime": 0,
      "endTime": 800
    },
    {
      "text": "여기는",
      "confidence": 0.92,
      "startTime": 800,
      "endTime": 1200
    }
  ]
}
```

**필드 설명**:
- `id`: 고유 식별자 (UUID 형식, `{type}_{timestamp}_{random}`)
- `text`: 현재 표시된 텍스트
- `originalText`: 원본 AI 인식 텍스트 (수정 전)
- `correctedText`: 관리자가 수정한 텍스트 (null = 미수정)
- `confidence`: AI 신뢰도 (0.0 ~ 1.0)
- `isFinal`: 최종 여부
- `status`: 상태 (interim | final | corrected)
- `timestamp`: 생성 시간 (ms)
- `correctedAt`: 수정 시간 (ms)
- `tokens`: 개별 단어 정보

---

### 1.2 Socket.IO 이벤트 페이로드

#### `audio:stream:start` (Client → Server)
```json
{
  "mode": "admin",
  "sessionId": "socket_id_xyz",
  "metadata": {
    "timestamp": 1716723600000,
    "userAgent": "Mozilla/5.0..."
  }
}
```

#### `audio:stream:data` (Client → Server)
```json
{
  "audioBuffer": "ArrayBuffer (binary data)",
  "timestamp": 1716723600100,
  "sequence": 1
}
```

#### `caption:interim` (Server → Admin Client)
```json
{
  "id": "interim_1716723600000_def456uvw",
  "text": "안녕하",
  "confidence": 0.87,
  "isFinal": false,
  "timestamp": 1716723600150,
  "tokens": [
    {
      "text": "안녕",
      "confidence": 0.95,
      "startTime": 0,
      "endTime": 400
    }
  ]
}
```

#### `caption:final` (Server → Admin Client)
```json
{
  "id": "final_1716723600000_abc123xyz",
  "text": "안녕하세요 여기는 예배당입니다",
  "confidence": 0.95,
  "isFinal": true,
  "timestamp": 1716723600500,
  "tokens": [
    {
      "text": "안녕하세요",
      "confidence": 0.98,
      "startTime": 0,
      "endTime": 800
    },
    {
      "text": "여기는",
      "confidence": 0.92,
      "startTime": 800,
      "endTime": 1200
    },
    {
      "text": "예배당입니다",
      "confidence": 0.91,
      "startTime": 1200,
      "endTime": 2000
    }
  ]
}
```

#### `caption:correction` (Admin Client → Server)
```json
{
  "captionId": "final_1716723600000_abc123xyz",
  "correctedText": "안녕하세요. 여기는 예배당입니다",
  "timestamp": 1716723605000,
  "sessionId": "admin_session_id"
}
```

#### `caption:corrected` (Server → All Clients)
```json
{
  "id": "final_1716723600000_abc123xyz",
  "text": "안녕하세요. 여기는 예배당입니다",
  "timestamp": 1716723605000,
  "correctorId": "admin_session_id"
}
```

#### `caption:display` (Server → Viewer Client)
```json
{
  "id": "final_1716723600000_abc123xyz",
  "text": "안녕하세요. 여기는 예배당입니다",
  "isFinal": true,
  "timestamp": 1716723605000
}
```

---

## 2. 충돌 방지 전략 (Conflict Resolution)

### 문제: AI 신규 인식 결과 vs 사람의 수정

```
Timeline:
├─ T=0ms   : User starts speaking
├─ T=500ms : Interim: "안녕"
├─ T=800ms : Admin corrects interim "안녕" → "안녕하세요"
├─ T=900ms : Clova sends Interim: "안녕하세요 여"  ⚠️ NEW TEXT ARRIVES
├─ T=1100ms: Clova sends Final: "안녕하세요 여기는"
└─ T=1200ms: ??? Should we preserve Admin's correction or update?
```

### 해결책: ID 기반 격리 (ID-Based Isolation)

```javascript
// 각 문장에 고유 ID 할당
Interim Caption:   id = "interim_1716723600000_def456"
Final Caption:     id = "final_1716723600000_abc123"  ← DIFFERENT ID!

// Admin이 수정하는 것은 항상 FINAL 자막
// Interim은 읽기 전용이므로 충돌 없음
```

### 상태 관리 로직

```javascript
class CaptionStore {
  captions = Map<captionId, CaptionData>
  corrections = Map<captionId, correctedText>
  
  addInterimCaption(data) {
    // 1. 이미 final 버전이 있는지 확인
    if (this.captions.has(data.id) && this.captions.get(data.id).isFinal) {
      return; // 무시 (final이 이미 있으면 interim 업데이트 안 함)
    }
    
    // 2. Interim 자막 저장 (읽기 전용)
    this.captions.set(data.id, {
      ...data,
      isFinal: false,
      status: 'interim',
      correctedText: null
    });
  }
  
  addFinalCaption(data) {
    // 3. Final 자막 저장
    const caption = {
      ...data,
      isFinal: true,
      status: 'final',
      correctedText: this.corrections.get(data.id) || null
    };
    this.captions.set(data.id, caption);
  }
  
  correctCaption(captionId, correctedText) {
    // 4. Admin이 수정할 때는 항상 FINAL 자막만 수정
    const caption = this.captions.get(captionId);
    if (!caption || !caption.isFinal) {
      throw new Error('Can only correct final captions');
    }
    
    // 5. Correction 저장 및 자막 업데이트
    this.corrections.set(captionId, correctedText);
    caption.correctedText = correctedText;
    caption.status = 'corrected';
  }
}
```

---

## 3. 실시간 동기화 흐름

### 3.1 Admin Interface 업데이트

```javascript
// Frontend: Admin.jsx
useEffect(() => {
  // 1. Store 구독
  const unsubscribe = captionStore.subscribe((state) => {
    setCaptions(state.captions);  // UI 업데이트
    setStats(state.stats);
  });
  
  // 2. Socket 이벤트 리스너
  socket.on('caption:interim', (data) => {
    captionStore.addInterimCaption(data);  // Store 업데이트 → UI 자동 업데이트
  });
  
  socket.on('caption:final', (data) => {
    captionStore.addFinalCaption(data);
  });
  
  return unsubscribe;
}, []);

// 3. Admin의 수정 작업
const handleCorrection = (captionId, correctedText) => {
  captionStore.correctCaption(captionId, correctedText);  // Local 업데이트
  
  socket.emit('caption:correction', {  // Server 전송
    captionId,
    correctedText
  });
};
```

### 3.2 Viewer Display 업데이트

```javascript
// Frontend: Viewer.jsx
useEffect(() => {
  socket.on('caption:display', (data) => {
    setDisplayCaption(data.text);  // 최종 자막 표시
    setCaptionHistory(prev => [data, ...prev.slice(0, 9)]);
  });
}, []);
```

---

## 4. gRPC 스트림 처리

### 4.1 Clova Speech API Response

```protobuf
// Clova에서 반환하는 응답 (예상 구조)
message RecognitionResult {
  string message = 1;           // 인식된 텍스트
  float confidence = 2;         // 신뢰도
  bool isFinal = 3;            // 최종 여부
  repeated Token tokens = 4;   // 개별 단어 정보
}

message Token {
  string text = 1;
  float confidence = 2;
  int32 startTime = 3;  // ms
  int32 endTime = 4;    // ms
}
```

### 4.2 Backend 처리 로직

```javascript
// Backend: socketManager.js
handleInterimResult(socket, result) {
  // 1. 고유 ID 생성 (interim용)
  const captionId = `interim_${Date.now()}_${randomId()}`;
  
  // 2. 데이터 패킹
  const captionData = {
    id: captionId,
    text: result.text,
    confidence: result.confidence,
    isFinal: false,
    timestamp: Date.now(),
    tokens: result.tokens
  };
  
  // 3. Admin에만 전송 (Viewer는 Interim 보지 않음)
  socket.emit(SOCKET_EVENTS.CAPTION_INTERIM, captionData);
}

handleFinalResult(socket, result) {
  // 1. 고유 ID 생성 (final용)
  const captionId = `final_${Date.now()}_${randomId()}`;
  
  // 2. 데이터 패킹
  const captionData = {
    id: captionId,
    text: result.text,
    confidence: result.confidence,
    isFinal: true,
    timestamp: Date.now(),
    tokens: result.tokens
  };
  
  // 3. Admin에 전송 (수정 가능)
  socket.emit(SOCKET_EVENTS.CAPTION_FINAL, captionData);
  
  // 4. 자동 Viewer 표시 (관리자 수정 대기)
  io.emit(SOCKET_EVENTS.CAPTION_DISPLAY, {
    id: captionId,
    text: result.text,
    isFinal: true
  });
}

handleCaptionCorrection(socket, data) {
  const { captionId, correctedText } = data;
  
  // 1. 수정 정보 저장
  const session = this.activeSessions.get(socket.id);
  session.corrections[captionId] = correctedText;
  
  // 2. 모든 Viewer에 수정된 자막 전송
  io.emit(SOCKET_EVENTS.CAPTION_DISPLAY, {
    id: captionId,
    text: correctedText,  // 수정된 텍스트
    isFinal: true
  });
}
```

---

## 5. 에러 시나리오 및 처리

### Scenario 1: 네트워크 끊김 → 자동 재연결

```javascript
socket.on('disconnect', () => {
  console.warn('Socket disconnected');
  // Socket.IO 자동 재연결 (설정된 간격)
});

socket.on('reconnect', () => {
  console.log('Socket reconnected');
  // 상태 재동기화
  socket.emit('sync:state', { sessionId });
});
```

### Scenario 2: Clova API 시간초과

```javascript
stream.on('error', (error) => {
  console.error('Stream error:', error);
  socket.emit('error', {
    code: 'STREAM_ERROR',
    message: 'STT 처리 중 오류 발생'
  });
});
```

### Scenario 3: Admin 수정 중 신규 Final Caption 도착

```
Timeline:
├─ T=0: Final Caption 1 생성 (id = "final_001")
├─ T=100: Admin이 Caption 1 수정 시작
├─ T=200: Admin이 "안녕하세요"로 변경
├─ T=250: Clova에서 Final Caption 2 도착 (id = "final_002")
└─ T=300: Admin이 Caption 1 수정 완료 → 두 ID가 다르므로 충돌 없음 ✓
```

---

## 6. 성능 최적화

### 6.1 메모리 관리

```javascript
// Caption history 제한 (메모리 절약)
const MAX_CAPTIONS = 100;

if (this.captions.size > MAX_CAPTIONS) {
  const oldestId = Array.from(this.captions.keys())[0];
  this.captions.delete(oldestId);
}
```

### 6.2 네트워크 최적화

```javascript
// 음성 데이터 청킹 (큰 버퍼를 작은 청크로 분할)
const CHUNK_SIZE = 4096;  // 4KB chunks

function sendAudioInChunks(audioBuffer) {
  for (let i = 0; i < audioBuffer.length; i += CHUNK_SIZE) {
    const chunk = audioBuffer.slice(i, i + CHUNK_SIZE);
    socket.emit('audio:stream:data', { audioBuffer: chunk });
  }
}
```

---

## 7. 모니터링 및 로깅

```javascript
// Backend logging
class CaptionLogger {
  log(level, message, data) {
    console.log(`[${level}] ${new Date().toISOString()} - ${message}`, data);
  }
  
  logCaption(captionId, action, details) {
    this.log('INFO', `Caption ${action}`, {
      captionId,
      timestamp: Date.now(),
      ...details
    });
  }
}

// Usage
logger.logCaption('final_001', 'CREATED', {
  text: '안녕하세요',
  confidence: 0.95
});

logger.logCaption('final_001', 'CORRECTED', {
  originalText: '안녕하세요',
  correctedText: '안녕하세요.'
});
```

---

**최종 업데이트**: 2026-05-26
