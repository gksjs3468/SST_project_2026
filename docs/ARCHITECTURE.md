# 시스템 아키텍처

## 1. 전체 시스템 구조

```
┌─────────────────────────────────────────────────────────────────┐
│                        Web Browser                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────┐         ┌──────────────────────┐      │
│  │  Admin Interface     │         │  Viewer Interface    │      │
│  │  (React Component)   │         │  (React Component)   │      │
│  │                      │         │                      │      │
│  │ - 자막 편집          │         │ - 최종 자막 표시     │      │
│  │ - 실시간 수정        │         │ - 방송용 디스플레이  │      │
│  │ - 오류 정정          │         │ - 과거 자막 표시     │      │
│  └──────────────────────┘         └──────────────────────┘      │
│           │                                ▲                     │
│           │ Socket.IO (WebSocket)          │ Socket.IO           │
│           └────────────┬────────────────────┘                    │
│                        │                                         │
└────────────────────────┼─────────────────────────────────────────┘
                         │
                    Backend Server
                         │
┌────────────────────────┼─────────────────────────────────────────┐
│  Node.js + Express + Socket.IO                                   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Socket Manager                              │   │
│  │  - 클라이언트 연결 관리                                  │   │
│  │  - 음성 스트림 라우팅                                    │   │
│  │  - 자막 브로드캐스팅                                     │   │
│  └──────────────────────────────────────────────────────────┘   │
│           │                         ▲                            │
│           │                         │                            │
│           ▼                         │                            │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Clova Service (gRPC)                         │   │
│  │  - gRPC 클라이언트                                        │   │
│  │  - 양방향 스트림 관리                                     │   │
│  │  - 중간/최종 결과 처리                                    │   │
│  └──────────────────────────────────────────────────────────┘   │
│           │                                                      │
│  ┌────────▼──────────────────────────────────────────────────┐  │
│  │          Audio Processor                                  │  │
│  │  - PCM 포맷 변환 (16kHz, Mono)                            │  │
│  │  - 오디오 검증                                            │  │
│  │  - 버퍼 관리                                              │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                   │
└───────────────────────────┬─────────────────────────────────────┘
                            │ gRPC
                            ▼
        ┌───────────────────────────────────┐
        │  Naver Clova Speech API           │
        │  (gRPC Streaming)                 │
        │                                   │
        │ - 실시간 음성 인식                │
        │ - 중간 결과 반환 (isFinal: false)│
        │ - 최종 결과 반환 (isFinal: true) │
        └───────────────────────────────────┘
```

## 2. 모듈 구조

### Backend (`/backend`)

```
backend/
├── src/
│   ├── server.js           # Express + Socket.IO 메인 서버
│   ├── clovaService.js     # gRPC 클라이언트 (Clova API)
│   ├── socketManager.js    # Socket.IO 이벤트 관리
│   └── utils/
│       └── audioProcessor.js  # 오디오 처리 유틸
├── config/
│   ├── clova.config.js     # Clova API 설정
│   └── socket.config.js    # Socket.IO 설정
├── package.json
└── .env.example
```

### Frontend (`/frontend`)

```
frontend/
├── src/
│   ├── components/
│   │   ├── Admin.jsx          # 관리자 인터페이스
│   │   ├── Viewer.jsx         # 최종 시청자 인터페이스
│   │   └── AudioInput.jsx     # 오디오 입력
│   ├── services/
│   │   ├── socketService.js   # Socket.IO 클라이언트
│   │   └── audioService.js    # Web Audio API
│   ├── hooks/
│   │   ├── useAudioRecorder.js   # 음성 녹음 훅
│   │   └── useSyncState.js       # 동기화 상태 훅
│   ├── store/
│   │   └── captionStore.js    # 중앙 상태 관리
│   ├── styles/
│   │   ├── index.css
│   │   ├── app.css
│   │   ├── admin.css
│   │   └── viewer.css
│   ├── App.jsx
│   └── main.jsx
├── index.html
├── vite.config.js
├── package.json
└── .env.example
```

## 3. 데이터 흐름

### 음성 입력 → 자막 생성 흐름

```
1. [Admin Browser] 마이크 → 음성 데이터 수집
       ↓
2. [Frontend] Web Audio API로 PCM (16kHz, Mono) 변환
       ↓
3. [Frontend] Socket.IO로 바이너리 데이터 전송
       ↓
4. [Backend] Audio Buffer 수신 및 검증
       ↓
5. [Backend] Clova gRPC 스트림으로 전달
       ↓
6. [Clova API] 실시간 음성 인식 처리
       ↓
7. [Clova API] 중간 결과 반환 (isFinal: false)
       ↓
8. [Backend] 중간 결과 → Admin에 Socket.IO 브로드캐스트
       ↓
9. [Admin UI] 임시 자막 표시
       ↓
10. [Clova API] 최종 결과 반환 (isFinal: true)
       ↓
11. [Backend] 최종 결과 저장 및 Admin에 전송
       ↓
12. [Admin] 최종 자막으로 전환 (수정 가능)
```

### 자막 수정 → 시청자 표시 흐름

```
1. [Admin] 최종 자막을 수정하고 Enter 입력
       ↓
2. [Frontend] `caption:correction` 이벤트 발송 (captionId, correctedText)
       ↓
3. [Backend] 수정 사항 저장 및 검증
       ↓
4. [Backend] `caption:corrected` 이벤트로 Admin 확인
       ↓
5. [Backend] `caption:display` 이벤트로 Viewer 업데이트
       ↓
6. [Viewer Browser] 수정된 자막 표시
```

## 4. 상태 관리 (State Management)

### Frontend Caption Store

```javascript
CaptionStore {
  captions: Map<captionId, CaptionData>
  corrections: Map<captionId, correctedText>
  captionHistory: Array<CaptionData>
  
  Methods:
  - addInterimCaption(data)      // 임시 자막 추가
  - addFinalCaption(data)        // 최종 자막 추가
  - correctCaption(id, text)     // 자막 수정
  - getAllCaptions()             // 모든 자막 반환
  - getFinalCaptions()           // 최종 자막만
  - getStats()                   // 통계 계산
  - subscribe(listener)          // 상태 변화 감시
}
```

## 5. 기술 스택

| 계층      | 기술                    | 버전    | 용도                     |
|-----------|-------------------------|---------|------------------------|
| Frontend  | React                   | 18.2.0  | UI 컴포넌트             |
| Frontend  | Vite                    | 5.0.0   | 번들러 & 개발 서버      |
| Frontend  | Socket.IO Client        | 4.7.2   | 실시간 통신             |
| Backend   | Node.js                 | -       | 런타임                  |
| Backend   | Express                 | 4.18.2  | 웹 프레임워크           |
| Backend   | Socket.IO               | 4.7.2   | 실시간 양방향 통신      |
| Backend   | gRPC                    | 1.9.0   | Clova API 통신          |
| Backend   | dotenv                  | 16.3.1  | 환경 변수 관리          |
| External  | Naver Clova Speech API  | -       | 실시간 STT 엔진        |

## 6. 통신 프로토콜

### Socket.IO 이벤트 정의

#### Client → Server
- `audio:stream:start` - 음성 스트림 시작
- `audio:stream:data` - 음성 데이터 전송
- `audio:stream:end` - 음성 스트림 종료
- `caption:correction` - 자막 수정

#### Server → Admin Client
- `caption:interim` - 중간 인식 결과
- `caption:final` - 최종 인식 결과

#### Server → Viewer Client
- `caption:display` - 최종 표시 자막
- `caption:clear` - 자막 초기화

### gRPC 통신

- **Protocol**: gRPC with bidirectional streaming
- **Endpoint**: clovaspeech-gw.naver.com:50051
- **Audio Format**:
  - Sample Rate: 16,000 Hz
  - Channels: 1 (Mono)
  - Encoding: PCM (16-bit)
  - Bit Rate: 256 kbps

## 7. 에러 처리 및 복구

- **자동 재연결**: 30초 간격으로 최대 5회 재시도
- **타임아웃**: 30초 이상 응답 없으면 연결 해제
- **오디오 검증**: 16kHz, Mono, PCM 형식만 허용
- **Grace Shutdown**: 종료 시 활성 세션 정상 종료

## 8. 보안 고려사항

- [ ] gRPC TLS 암호화 적용 필요
- [ ] Socket.IO CORS 정책 설정
- [ ] API 인증 토큰 환경 변수 관리
- [ ] 오디오 데이터 로깅 금지
- [ ] 입력 검증 및 새니타이제이션

---

**최종 업데이트**: 2026-05-26
