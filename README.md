# 실시간 자막 생성 및 실시간 교정 시스템

🎤 **교회 수어사역팀을 위한 실시간 자막 생성 및 수정 플랫폼**

---

## 📋 프로젝트 개요

이 프로젝트는 실시간으로 음성을 인식하여 텍스트로 변환(STT)하고, 생성된 텍스트를 관리자가 실시간으로 수정하여 최종 사용자에게 송출하는 웹 애플리케이션입니다.

### 주요 기능

✅ **실시간 음성 인식**: 네이버 클로바 스피치 API (gRPC 스트리밍)  
✅ **실시간 자막 편집**: 관리자 인터페이스에서 오타 및 오류 수정  
✅ **실시간 자막 송출**: 최종 사용자를 위한 전용 디스플레이  
✅ **충돌 방지**: ID 기반 격리로 AI 인식과 사람의 수정 안전 동기화  
✅ **통계 대시보드**: 자막 생성 및 수정 현황 모니터링  

---

## 🛠 기술 스택

| 계층 | 기술 | 버전 |
|------|------|------|
| **Frontend** | React | 18.2.0 |
| **Frontend Build** | Vite | 5.0.0 |
| **Real-time** | Socket.IO | 4.7.2 |
| **Backend** | Node.js + Express | - |
| **STT API** | gRPC (Naver Clova) | - |
| **Audio Processing** | Web Audio API | - |

---

## 📁 프로젝트 구조

```
SST_project_2026/
├── backend/
│   ├── src/
│   │   ├── server.js              # Express + Socket.IO 메인 서버
│   │   ├── clovaService.js        # gRPC 클라이언트 (Clova 연동)
│   │   ├── socketManager.js       # Socket.IO 이벤트 관리
│   │   └── utils/
│   │       └── audioProcessor.js  # 오디오 처리 유틸리티
│   ├── config/
│   │   ├── clova.config.js        # Clova API 설정
│   │   └── socket.config.js       # Socket.IO 설정
│   ├── package.json
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Admin.jsx          # 관리자 인터페이스
│   │   │   ├── Viewer.jsx         # 최종 사용자 화면
│   │   │   └── AudioInput.jsx     # 오디오 입력 컴포넌트
│   │   ├── services/
│   │   │   ├── socketService.js   # Socket.IO 클라이언트
│   │   │   └── audioService.js    # Web Audio API 래퍼
│   │   ├── hooks/
│   │   │   ├── useAudioRecorder.js   # 음성 녹음 훅
│   │   │   └── useSyncState.js       # 동기화 상태 훅
│   │   ├── store/
│   │   │   └── captionStore.js    # 중앙 상태 관리
│   │   ├── styles/
│   │   │   ├── index.css
│   │   │   ├── app.css
│   │   │   ├── admin.css
│   │   │   └── viewer.css
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   └── .env.example
│
├── docs/
│   ├── ARCHITECTURE.md    # 전체 시스템 아키텍처
│   ├── DATA_FLOW.md       # 데이터 흐름 및 충돌 해결 방안
│   └── API_SPEC.md        # Socket.IO API 명세
│
├── .gitignore
└── README.md
```

---

## 🚀 빠른 시작

### 1️⃣ 필수 요구사항

- Node.js 14+ (또는 16+ 권장)
- npm 또는 yarn
- 네이버 클로바 스피치 API 인증정보

### 2️⃣ 설치

#### Backend 설치
```bash
cd backend
cp .env.example .env
# .env 파일에 CLOVA_SECRET_KEY 입력
npm install
```

#### Frontend 설치
```bash
cd frontend
cp .env.example .env
npm install
```

### 3️⃣ 환경 설정

#### Backend (.env)
```env
PORT=3001
NODE_ENV=development
CLOVA_SECRET_KEY=your_secret_key_here
CLOVA_API_URL=grpc://clovaspeech-gw.naver.com:50051
SOCKET_CORS=http://localhost:5173
LOG_LEVEL=debug
```

#### Frontend (.env)
```env
VITE_API_URL=http://localhost:3001
VITE_SOCKET_URL=http://localhost:3001
```

### 4️⃣ 실행

#### Backend 서버 시작
```bash
cd backend
npm run dev
# 또는 npm start
```

#### Frontend 개발 서버 시작
```bash
cd frontend
npm run dev
```

브라우저에서 다음 URL로 접속:
- **관리자 화면**: http://localhost:5174/
- **시청자 화면**: http://localhost:5174/?mode=viewer

---

## 📖 핵심 개념

### 1. Caption Store (상태 관리)

모든 자막은 고유한 ID로 격리되어 관리됩니다:

```javascript
// Interim (임시) 자막
id = "interim_1716723600000_abc123"

// Final (완성) 자막
id = "final_1716723600000_xyz789"

// ✅ 다른 ID → 충돌 없음!
```

### 2. 데이터 동기화

```
Admin의 수정
    ↓
captionStore 업데이트
    ↓
Server에 전송
    ↓
모든 Viewer에 브로드캐스트
```

### 3. 음성 처리

- **포맷**: PCM (16-bit, 16kHz, Mono)
- **청크 크기**: 4KB 권장
- **버퍼링**: 자동 처리

---

## 🎯 주요 기능 설명

### Admin Interface (관리자 화면)

```
┌─────────────────────────────────────────┐
│ 📝 실시간 자막 편집기                    │
├─────────────────────────────────────────┤
│ [🎤 녹음 시작]  [✓ 연결됨]              │
├─────────────────────────────────────────┤
│ 총 자막: 42 | 완료: 40 | 수정됨: 38    │
├─────────────────────────────────────────┤
│                                         │
│ ✓ 수정됨 | 신뢰도 95%                   │
│ 원본: 안녕하세요 여기는 예배당입니다   │
│ → 수정: 안녕하세요. 여기는 예배당입니다│
│                                         │
│ 완료 | 신뢰도 92%                       │
│ ▶ 새로운 말씀 시간 입니다 (클릭 수정)  │
│                                         │
└─────────────────────────────────────────┘
```

### Viewer Display (시청자 화면)

```
┌─────────────────────────────────────────┐
│                                         │
│                                         │
│   안녕하세요. 여기는 예배당입니다       │
│                                         │
│                                         │
└─────────────────────────────────────────┘
```

---

## 📊 데이터 구조

### Caption Object

```json
{
  "id": "final_1716723600000_abc123",
  "text": "안녕하세요. 여기는 예배당입니다",
  "originalText": "안녕하세요 여기는 예배당입니다",
  "correctedText": "안녕하세요. 여기는 예배당입니다",
  "confidence": 0.95,
  "isFinal": true,
  "status": "corrected",
  "timestamp": 1716723600000,
  "tokens": [...]
}
```

자세한 내용은 [DATA_FLOW.md](docs/DATA_FLOW.md) 참조

---

## 🔧 API 명세

### Socket.IO 이벤트

| 이벤트 | 방향 | 설명 |
|--------|------|------|
| `audio:stream:start` | Client→Server | 음성 스트림 시작 |
| `audio:stream:data` | Client→Server | 음성 데이터 전송 |
| `audio:stream:end` | Client→Server | 음성 스트림 종료 |
| `caption:interim` | Server→Client | 중간 인식 결과 |
| `caption:final` | Server→Client | 최종 인식 결과 |
| `caption:correction` | Client→Server | 자막 수정 |
| `caption:display` | Server→Viewer | 시청자 표시 자막 |

자세한 내용은 [API_SPEC.md](docs/API_SPEC.md) 참조

---

## 🏗 시스템 아키텍처

![System Architecture](docs/ARCHITECTURE.md)

- **Frontend**: React + Vite (SPA)
- **Backend**: Express + Socket.IO (Real-time)
- **STT**: Naver Clova Speech API (gRPC)
- **Communication**: WebSocket (Socket.IO)

자세한 내용은 [ARCHITECTURE.md](docs/ARCHITECTURE.md) 참조

---

## 🔒 보안 고려사항

- [ ] gRPC TLS 암호화 적용 필수
- [ ] Socket.IO CORS 정책 설정
- [ ] API 인증 토큰 환경 변수 관리
- [ ] 오디오 데이터 로깅 금지
- [ ] 입력 검증 및 새니타이제이션

---

## 🐛 트러블슈팅

### "마이크 사용 권한이 필요합니다"
→ 브라우저 마이크 권한 확인 및 재설정

### "연결 대기 중..." 표시
→ Backend 서버 실행 확인 (`npm run dev`)

### "Clova API 오류"
→ `.env` 파일의 `CLOVA_SECRET_KEY` 확인

### 음성 인식이 자주 끊김
→ 네트워크 연결 확인 및 방화벽 설정 검토

---

## 📝 향후 개선 사항

- [ ] 다중 언어 지원 (한국어 외)
- [ ] 자막 번역 기능
- [ ] AI 신뢰도 기반 자동 필터링
- [ ] 녹화 및 재생 기능
- [ ] 자막 내보내기 (SRT, VTT 포맷)
- [ ] 다중 관리자 지원
- [ ] 자막 히스토리 검색

---

## 📞 지원

문제가 발생하거나 기능을 제안하고 싶으시면 Issue를 생성해주세요.

---

## 📄 라이선스

MIT License

---

## 👥 기여

Contributions are welcome! 

---

**마지막 업데이트**: 2026-05-26
