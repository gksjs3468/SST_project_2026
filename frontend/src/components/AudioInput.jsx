import React, { useState } from 'react';
import '../styles/app.css';

/**
 * AudioInput Component - Provides audio input interface
 */
function AudioInput() {
  const [isSupported] = useState(() => {
    return !!(
      navigator.mediaDevices &&
      navigator.mediaDevices.getUserMedia &&
      (window.AudioContext || window.webkitAudioContext)
    );
  });

  if (!isSupported) {
    return (
      <div className="audio-input-error">
        <h2>⚠️ 지원되지 않는 브라우저</h2>
        <p>이 애플리케이션은 다음 브라우저에서 작동합니다:</p>
        <ul>
          <li>Chrome / Edge (최신 버전)</li>
          <li>Firefox (최신 버전)</li>
          <li>Safari (iOS 14.5+)</li>
        </ul>
      </div>
    );
  }

  return null;
}

export default AudioInput;
