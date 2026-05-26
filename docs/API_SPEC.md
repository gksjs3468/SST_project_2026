# API 명세 (API Specification)

## 1. Socket.IO 이벤트 API

### 1.1 Audio Stream Events

#### `audio:stream:start`
음성 스트림 시작 신호

**발신**: Client (Admin) → Server
**방향**: Emit
```javascript
socket.emit('audio:stream:start', {
  mode: 'admin',                    // 'admin' | 'user'
  sessionId?: 'socket_id_xyz',      // 선택사항
  metadata?: {
    timestamp: 1716723600000,
    userAgent: 'Mozilla/5.0...',
    clientVersion: '1.0.0'
  }
});
```

**응답**: 없음 (이벤트만 발송)

**에러**: 
- 연결되지 않은 상태에서 호출 시 경고

---

#### `audio:stream:data`
음성 바이너리 데이터 전송

**발신**: Client → Server
**방향**: Emit (반복)
```javascript
socket.emit('audio:stream:data', {
  audioBuffer: ArrayBuffer,         // Float32Array → Binary
  timestamp?: 1716723600100,        // 선택사항
  sequence?: 1                      // 청크 순서
});
```

**주의사항**:
- 최대 청크 크기: 65,536 bytes (64KB)
- 권장 청크 크기: 4,096 bytes (4KB)
- 포맷: Float32Array (Web Audio API)
- 샘플레이트: 16,000 Hz
- 채널: Mono (1)

---

#### `audio:stream:end`
음성 스트림 종료

**발신**: Client → Server
**방향**: Emit
```javascript
socket.emit('audio:stream:end');
```

**응답**: 없음

---

### 1.2 Caption Events (Server → Admin Client)

#### `caption:interim`
중간 인식 결과 (실시간 임시 자막)

**발신**: Server → Client
**방향**: On (Listen)
```javascript
socket.on('caption:interim', (data) => {
  // data structure:
  {
    id: 'interim_1716723600000_abc123',
    text: '안녕하',
    confidence: 0.87,
    isFinal: false,
    timestamp: 1716723600150,
    tokens: [
      {
        text: '안녕',
        confidence: 0.95,
        startTime: 0,
        endTime: 400
      }
    ]
  }
});
```

**특징**:
- 매우 자주 발송됨 (100ms 간격 정도)
- 최종 완성도가 낮을 수 있음
- 수정 불가능 (읽기 전용)

---

#### `caption:final`
최종 인식 결과 (완성된 자막)

**발신**: Server → Client
**방향**: On (Listen)
```javascript
socket.on('caption:final', (data) => {
  // data structure:
  {
    id: 'final_1716723600000_xyz789',
    text: '안녕하세요 여기는 예배당입니다',
    confidence: 0.95,
    isFinal: true,
    timestamp: 1716723600500,
    tokens: [
      {
        text: '안녕하세요',
        confidence: 0.98,
        startTime: 0,
        endTime: 800
      },
      {
        text: '여기는',
        confidence: 0.92,
        startTime: 800,
        endTime: 1200
      },
      {
        text: '예배당입니다',
        confidence: 0.91,
        startTime: 1200,
        endTime: 2000
      }
    ]
  }
});
```

**특징**:
- 한 번의 문장/구절 완성 시 발송
- 완전한 문법 구조
- Admin에서 수정 가능

---

### 1.3 Caption Correction Events

#### `caption:correction`
자막 수정 요청

**발신**: Admin Client → Server
**방향**: Emit
```javascript
socket.emit('caption:correction', {
  captionId: 'final_1716723600000_xyz789',
  correctedText: '안녕하세요. 여기는 예배당입니다.',
  timestamp?: 1716723605000              // 선택사항
});
```

**응답**: 
- 성공 시: `caption:corrected` 이벤트 수신
- 실패 시: `error` 이벤트 수신

**유효성 검증**:
- captionId: 필수, 존재하는 caption ID여야 함
- correctedText: 필수, 빈 문자열 불가
- 텍스트 길이: 1 ~ 1000 글자

**에러 코드**:
```javascript
{
  code: 'CAPTION_NOT_FOUND',
  message: 'Caption ID를 찾을 수 없습니다'
}

{
  code: 'INVALID_CAPTION_STATE',
  message: '이미 수정된 자막입니다'
}

{
  code: 'INVALID_TEXT',
  message: '유효하지 않은 텍스트입니다'
}
```

---

#### `caption:corrected`
자막 수정 완료 확인

**발신**: Server → All Clients
**방향**: On (Listen)
```javascript
socket.on('caption:corrected', (data) => {
  // data structure:
  {
    id: 'final_1716723600000_xyz789',
    text: '안녕하세요. 여기는 예배당입니다.',
    timestamp: 1716723605000,
    correctorId?: 'socket_id_admin'
  }
});
```

---

### 1.4 Display Events (Server → Viewer Client)

#### `caption:display`
시청자 화면에 표시할 자막

**발신**: Server → Viewer Client
**방향**: On (Listen)
```javascript
socket.on('caption:display', (data) => {
  // data structure:
  {
    id: 'final_1716723600000_xyz789',
    text: '안녕하세요. 여기는 예배당입니다.',
    isFinal: true,
    timestamp: 1716723605000
  }
});
```

**표시 규칙**:
- Admin이 수정한 텍스트 우선 표시
- 수정이 없으면 원본 AI 인식 텍스트 표시
- 이전 자막은 자동 숨김

---

#### `caption:clear`
시청자 화면 자막 초기화

**발신**: Server → Viewer Client
**방향**: On (Listen)
```javascript
socket.on('caption:clear', () => {
  // UI에서 자막 제거
});
```

---

## 2. REST API (Optional)

### 2.1 Health Check

#### GET `/health`
서버 상태 확인

**응답** (200 OK):
```json
{
  "status": "ok",
  "timestamp": "2026-05-26T12:34:56.789Z",
  "activeSessions": 3,
  "uptime": 3600000
}
```

---

## 3. Error Handling

### 3.1 일반 에러 포맷

```javascript
socket.on('error', (error) => {
  {
    code: 'ERROR_CODE',
    message: '사람이 읽을 수 있는 에러 메시지',
    details?: {
      expectedFormat: '...',
      receivedFormat: '...'
    },
    timestamp: 1716723600000
  }
});
```

### 3.2 일반적인 에러 코드

| 코드 | HTTP 상태 | 설명 |
|------|----------|------|
| `AUDIO_PROCESSING_ERROR` | 400 | 음성 처리 중 오류 |
| `CLOVA_API_ERROR` | 500 | Clova API 오류 |
| `INVALID_CAPTION_ID` | 400 | 유효하지 않은 caption ID |
| `SESSION_EXPIRED` | 401 | 세션 만료 |
| `NETWORK_ERROR` | 503 | 네트워크 오류 |
| `RATE_LIMIT_EXCEEDED` | 429 | 요청 제한 초과 |

---

## 4. Rate Limiting

```javascript
// 클라이언트별 제한
const LIMITS = {
  'audio:stream:data': 100,        // 100 events/sec
  'caption:correction': 10,        // 10 events/sec
};

// 초과 시 응답
{
  code: 'RATE_LIMIT_EXCEEDED',
  message: '요청 제한을 초과했습니다',
  retryAfter: 60  // seconds
}
```

---

## 5. 인증 및 보안

### 5.1 Socket.IO 연결 인증 (향후 구현)

```javascript
// Client side
const socket = io('http://localhost:3001', {
  auth: {
    token: 'jwt_token_here'
  }
});

// Server side
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (validateToken(token)) {
    next();
  } else {
    next(new Error('Invalid token'));
  }
});
```

---

## 6. 버전 관리

### 6.1 현재 버전
- API Version: `1.0.0`
- Socket.IO Version: `4.7.2`

### 6.2 향후 변경 예정
- [ ] WebRTC를 통한 음성 직접 전송 (gRPC 우회)
- [ ] 다중 언어 지원 (한국어 외)
- [ ] 자막 번역 기능
- [ ] AI 신뢰도 기반 자동 필터링

---

## 7. 테스트 예제

### 7.1 JavaScript 클라이언트

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3001');

// 1. 연결 확인
socket.on('connect', () => {
  console.log('Connected:', socket.id);
  
  // 2. 음성 스트림 시작
  socket.emit('audio:stream:start', { mode: 'admin' });
  
  // 3. 음성 데이터 전송 (예)
  const mockAudioBuffer = new Float32Array(4096);
  socket.emit('audio:stream:data', { audioBuffer: mockAudioBuffer });
});

// 4. 이벤트 리스너
socket.on('caption:interim', (data) => {
  console.log('Interim:', data.text);
});

socket.on('caption:final', (data) => {
  console.log('Final:', data.text);
  
  // 5. 자막 수정
  socket.emit('caption:correction', {
    captionId: data.id,
    correctedText: data.text + '.'
  });
});

socket.on('caption:corrected', (data) => {
  console.log('Corrected:', data.text);
});

socket.on('error', (error) => {
  console.error('Error:', error);
});
```

---

**최종 업데이트**: 2026-05-26
