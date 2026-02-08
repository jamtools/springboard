import springboard from 'springboard';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/app/App';
import '@/app/modules/counter_module';

// Register the tauri module
springboard.registerModule('TauriInit', {}, async (moduleAPI) => {
  console.log('[TauriInit] Initializing Tauri desktop platform');
  console.log('[TauriInit] Running in Tauri webview');

  // Render the app
  const root = document.getElementById('root');
  if (root) {
    createRoot(root).render(React.createElement(App, { platform: 'tauri' }));
  }

  return {};
});

// Start springboard
springboard.start().catch(console.error);
