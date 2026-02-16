import springboard from 'springboard';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/app/App';
import '@/app/modules/counter_module';

// Register the RN webview module
springboard.registerModule('RNWebviewInit', {}, async (moduleAPI) => {
  console.log('[RNWebviewInit] Initializing React Native webview platform');
  console.log('[RNWebviewInit] Running in RN WebView component');

  // Render the app
  const root = document.getElementById('root');
  if (root) {
    createRoot(root).render(React.createElement(App, { platform: 'rn_webview' }));
  }

  return {};
});
