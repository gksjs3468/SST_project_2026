import React, { useState } from 'react';
import Admin from './components/Admin.jsx';
import Viewer from './components/Viewer.jsx';
import './styles/app.css';

function App() {
  const [mode, setMode] = useState(
    new URLSearchParams(window.location.search).get('mode') || 'admin'
  );

  return (
    <div className="app">
      {mode === 'viewer' ? <Viewer /> : <Admin />}
    </div>
  );
}

export default App;
