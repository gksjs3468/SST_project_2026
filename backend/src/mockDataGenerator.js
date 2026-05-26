/**
 * Mock Data Generator - 테스트 데이터 생성 (Clova API 없이 테스트)
 * 약 1분 정도의 긴 스피치 테스트 데이터
 */

const MOCK_SENTENCES = [
  {
    interim: ['안', '안녕', '안녕하', '안녕하세', '안녕하세요', '안녕하세요 여', '안녕하세요 여러', '안녕하세요 여러분'],
    final: '안녕하세요 여러분',
    confidence: 0.96,
  },
  {
    interim: ['저', '저는', '저는 이', '저는 이곳', '저는 이곳의', '저는 이곳의 목', '저는 이곳의 목사', '저는 이곳의 목사입니다'],
    final: '저는 이곳의 목사입니다',
    confidence: 0.94,
  },
  {
    interim: ['오', '오늘', '오늘 이', '오늘 이렇', '오늘 이렇게', '오늘 이렇게 많', '오늘 이렇게 많은', '오늘 이렇게 많은 분', '오늘 이렇게 많은 분들'],
    final: '오늘 이렇게 많은 분들',
    confidence: 0.95,
  },
  {
    interim: ['모', '모여', '모여주', '모여주셔', '모여주셔서', '모여주셔서 감', '모여주셔서 감사', '모여주셔서 감사합니다'],
    final: '모여주셔서 감사합니다',
    confidence: 0.97,
  },
  {
    interim: ['우', '우리', '우리가', '우리가 함', '우리가 함께', '우리가 함께 예', '우리가 함께 예배', '우리가 함께 예배하'],
    final: '우리가 함께 예배하는',
    confidence: 0.93,
  },
  {
    interim: ['시', '시간', '시간이', '시간이 참', '시간이 참 소', '시간이 참 소중', '시간이 참 소중합', '시간이 참 소중합니다'],
    final: '시간이 참 소중합니다',
    confidence: 0.92,
  },
  {
    interim: ['오', '오늘', '오늘 함', '오늘 함께', '오늘 함께 읽', '오늘 함께 읽을', '오늘 함께 읽을 성', '오늘 함께 읽을 성경'],
    final: '오늘 함께 읽을 성경은',
    confidence: 0.94,
  },
  {
    interim: ['요', '요한', '요한복', '요한복음', '요한복음 삼', '요한복음 삼장', '요한복음 삼장 십', '요한복음 삼장 십육'],
    final: '요한복음 삼장 십육절입니다',
    confidence: 0.95,
  },
  {
    interim: ['주', '주님', '주님께서', '주님께서 우', '주님께서 우리', '주님께서 우리를', '주님께서 우리를 사', '주님께서 우리를 사랑'],
    final: '주님께서 우리를 사랑하십니다',
    confidence: 0.96,
  },
  {
    interim: ['우', '우리', '우리는', '우리는 이', '우리는 이 사', '우리는 이 사랑', '우리는 이 사랑으로', '우리는 이 사랑으로 인'],
    final: '우리는 이 사랑으로 인해',
    confidence: 0.91,
  },
  {
    interim: ['구', '구원', '구원을', '구원을 받', '구원을 받았', '구원을 받았습니다'],
    final: '구원을 받았습니다',
    confidence: 0.94,
  },
  {
    interim: ['모', '모든', '모든 사', '모든 사람', '모든 사람이', '모든 사람이 이', '모든 사람이 이 진', '모든 사람이 이 진리'],
    final: '모든 사람이 이 진리를',
    confidence: 0.93,
  },
  {
    interim: ['알', '알고', '알고 믿', '알고 믿음', '알고 믿음으로', '알고 믿음으로 구', '알고 믿음으로 구원'],
    final: '알고 믿음으로 구원을',
    confidence: 0.92,
  },
  {
    interim: ['받', '받기', '받기를', '받기를 원', '받기를 원합니다'],
    final: '받기를 원합니다',
    confidence: 0.95,
  },
  {
    interim: ['함', '함께', '함께 기', '함께 기도', '함께 기도하', '함께 기도하겠', '함께 기도하겠습니다'],
    final: '함께 기도하겠습니다',
    confidence: 0.94,
  },
];

/**
 * 테스트 자막 스트림 생성 (약 60초)
 * @param {Function} onInterim - interim 콜백
 * @param {Function} onFinal - final 콜백
 */
export function startMockStream(onInterim, onFinal) {
  let sentenceIndex = 0;
  let isRunning = true;

  const processNextSentence = async () => {
    if (!isRunning) return;

    const sentence = MOCK_SENTENCES[sentenceIndex];
    
    // Interim 결과들을 순차적으로 전송 (200ms 간격)
    for (let i = 0; i < sentence.interim.length; i++) {
      if (!isRunning) break;

      const interimId = `interim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await new Promise(resolve => setTimeout(resolve, 200));

      onInterim({
        id: interimId,
        text: sentence.interim[i],
        confidence: 0.7 + Math.random() * 0.25,
        isFinal: false,
        timestamp: Date.now(),
        tokens: sentence.interim[i].split('').map((char, idx) => ({
          text: char,
          confidence: 0.85 + Math.random() * 0.15,
          startTime: idx * 100,
          endTime: (idx + 1) * 100,
        })),
      });
    }

    // Final 결과 전송
    if (isRunning) {
      const finalId = `final_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await new Promise(resolve => setTimeout(resolve, 300));

      onFinal({
        id: finalId,
        text: sentence.final,
        confidence: sentence.confidence,
        isFinal: true,
        timestamp: Date.now(),
        tokens: sentence.final.split(' ').map((word, idx) => ({
          text: word,
          confidence: sentence.confidence,
          startTime: idx * 500,
          endTime: (idx + 1) * 500,
        })),
      });

      // 다음 문장으로
      sentenceIndex = (sentenceIndex + 1) % MOCK_SENTENCES.length;
      
      // 문장 사이에 500ms 대기
      if (sentenceIndex !== 0) {
        await new Promise(resolve => setTimeout(resolve, 500));
      } else {
        // 전체 루프가 끝나면 5초 대기 후 재시작
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
      
      processNextSentence();
    }
  };

  // 첫 문장 처리 시작
  processNextSentence();

  // Stop 함수 반환
  return () => {
    isRunning = false;
  };
}

export default { startMockStream };
