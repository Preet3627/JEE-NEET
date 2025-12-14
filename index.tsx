import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { LocalizationProvider } from './context/LocalizationContext';
import { AuthProvider } from './context/AuthContext';
import { MusicPlayerProvider } from './context/MusicPlayerContext';
import { ServerStatusProvider } from './context/ServerStatusContext';
import ReloadPrompt from './components/ReloadPrompt';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <LocalizationProvider>
      <AuthProvider>
        <ServerStatusProvider>
          <MusicPlayerProvider>
            <App />
            <ReloadPrompt />
          </MusicPlayerProvider>
        </ServerStatusProvider>
      </AuthProvider>
    </LocalizationProvider>
  </React.StrictMode>
);