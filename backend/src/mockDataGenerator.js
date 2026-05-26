/**
 * Mock Data Generator - 테스트 데이터 생성 (Clova API 없이 테스트)
 */

const MOCK_SENTENCES = [
  {
    interim: ['안', '안녕', '안녕하', '안녕하세', '안녕하세요'],
    final: '안녕하세요',
    confidence: 0.96,
  },
  {
    interim: ['여', '여기', '여기는', '여기는 예', '여기는 예배당'],
    final: '여기는 예배당',
    confidence: 0.94,
  },
  {
    interim: ['입', '입니다'],
    final: '입니다',
    confidence: 0.98,
  },
  {
    interim: ['오', '오늘', '오늘은', '오늘은 특', '오늘은 특별한 날'],
    final: '오늘은 특별한 날',
    confidence: 0.92,
  },
  {
    interim: ['함', '함께', '함께하', '함께하는'],
    final: '함께하는',
    confidence: 0.95,
  },
  {
    interim: ['예', '예수님', '예수님께서', '예수님께서 우'],
    final: '예수님께서 우리를 축복하십니다',
    confidence: 0.91,
  },
];

/**
 * 테스트 자막 스트림 생성
 * @param {Function} onInterim - interim 콜백
 * @param {Function} onFinal - final 콜백
 */
export function startMockStream(onInterim, onFinal) {
  let sentenceIndex = 0;
  let isRunning = true;

  const processNextSentence = async () => {
    if (!isRunning) return;

    const sentence = MOCK_SENTENCES[sentenceIndex];
    
    // Interim 결과들을 순차적으로 전송
    for (let i = 0; i < sentence.interim.length; i++) {
      if (!isRunning) break;

      const interimId = `interim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await new Promise(resolve => setTimeout(resolve, 300)); // 300ms 간격

      onInterim({
        id: interimId,
        text: sentence.interim[i],
        confidence: 0.7 + Math.random() * 0.2,
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
      
      await new Promise(resolve => setTimeout(resolve, 500));

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
      
      // 다음 문장까지 1초 대기
      await new Promise(resolve => setTimeout(resolve, 1000));
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
