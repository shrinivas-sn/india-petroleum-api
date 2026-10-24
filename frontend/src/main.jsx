import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { OriginProvider } from './lib/site';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <OriginProvider value={window.location.origin}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </OriginProvider>
  </React.StrictMode>,
);
