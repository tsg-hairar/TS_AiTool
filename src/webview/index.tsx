// ===================================================
// React Entry Point — נקודת הכניסה של ה-Webview
// ===================================================

import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { AppProvider } from './state/AppContext';
import './i18n'; // אתחול i18next — חייב להיות לפני רינדור
import './styles/globals.css';

// מציאת אלמנט השורש
const rootElement = document.getElementById('root');

if (rootElement) {
  // יצירת React root ורינדור האפליקציה
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <AppProvider>
        <App />
      </AppProvider>
    </React.StrictMode>,
  );
}
