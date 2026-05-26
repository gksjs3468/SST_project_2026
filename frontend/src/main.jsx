import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles/index.css';

// Include Socket.IO client from CDN
const script = document.createElement('script');
script.src = 'https://cdn.socket.io/4.7.2/socket.io.min.js';
document.head.appendChild(script);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
