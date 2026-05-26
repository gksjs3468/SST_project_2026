import { useState, useCallback } from 'react';
import AudioService from '../services/audioService.js';

/**
 * Hook for managing audio recording
 */
export function useAudioRecorder(onAudioData) {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState(null);
  const [audioService] = useState(() => new AudioService());

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      await audioService.startRecording((audioData) => {
        const pcmData = AudioService.float32ToPCM(audioData);
        onAudioData?.(pcmData);
      });
      setIsRecording(true);
    } catch (err) {
      setError(err.message);
      setIsRecording(false);
    }
  }, [audioService, onAudioData]);

  const stopRecording = useCallback(() => {
    audioService.stopRecording();
    setIsRecording(false);
  }, [audioService]);

  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      stopRecording();
    } else {
      await startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  return {
    isRecording,
    error,
    startRecording,
    stopRecording,
    toggleRecording,
  };
}

export default useAudioRecorder;
