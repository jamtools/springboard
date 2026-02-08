import springboard from 'springboard';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/app/App';
import '@/app/modules/counter_module';

// Register the main browser online module
springboard.registerModule('BrowserOnlineInit', {}, async (moduleAPI) => {
  console.log('[BrowserOnlineInit] Initializing browser online platform');

  // Render the app
  const root = document.getElementById('root');
  if (root) {
    createRoot(root).render(React.createElement(App, { platform: 'browser_online' }));
  }

  return {};
});

// Start springboard
springboard.start().catch(console.error);
