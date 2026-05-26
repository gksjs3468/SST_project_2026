// Naver Clova Speech API Configuration
export const clovaConfig = {
  secretKey: process.env.CLOVA_SECRET_KEY || '',
  apiUrl: process.env.CLOVA_API_URL || 'grpc://clovaspeech-gw.naver.com:50051',
  audioConfig: {
    sampleRate: 16000,
    channel: 1, // Mono
    encoding: 'PCM',
  },
  language: 'ko-KR',
};

export const getAuthHeaders = () => {
  return {
    'Authorization': `Bearer ${clovaConfig.secretKey}`,
  };
};
