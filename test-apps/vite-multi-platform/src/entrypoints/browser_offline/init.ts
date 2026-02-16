import springboard from 'springboard';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/app/App';
import '@/app/modules/counter_module';

// Register the browser offline module
springboard.registerModule('BrowserOfflineInit', {}, async (moduleAPI) => {
  console.log('[BrowserOfflineInit] Initializing browser offline platform');
  console.log('[BrowserOfflineInit] This platform uses local SQLite for offline storage');

  // Render the app
  const root = document.getElementById('root');
  if (root) {
    createRoot(root).render(React.createElement(App, { platform: 'browser_offline' }));
  }

  return {};
});
