/**
 * Browser Platform Entry Point
 *
 * This file tests that Vite can properly:
 * 1. Resolve springboard package exports
 * 2. Import browser-specific platform code
 * 3. Handle HMR for development
 * 4. Tree-shake server-only code
 */

import React from 'react';
import { createRoot } from 'react-dom/client';

// Test: Import from main springboard package
import springboard from 'springboard';

// Test: Import specific subpath exports
import { Springboard } from 'springboard/engine/engine';

// Test: Import browser platform
import '@springboardjs/platforms-browser';

// Test: Import types (should be tree-shaken in production)
import type { CoreDependencies } from 'springboard/types/module_types';

// Simple test component to verify everything loads
function App() {
  const [status, setStatus] = React.useState<string>('initializing');
  const [exports, setExports] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    // Test that springboard exports are available
    const exportTests: Record<string, string> = {
      'springboard default': typeof springboard === 'object' ? 'OK' : 'FAIL',
      'Springboard class': typeof Springboard === 'function' ? 'OK' : 'FAIL',
    };

    setExports(exportTests);

    // Check if all tests passed
    const allPassed = Object.values(exportTests).every(v => v === 'OK');
    setStatus(allPassed ? 'All exports resolved correctly!' : 'Some exports failed');
  }, []);

  return (
    <div style={{ fontFamily: 'system-ui', padding: '2rem' }}>
      <h1>Springboard Vite Test - Browser Platform</h1>

      <section>
        <h2>Export Resolution Tests</h2>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'left' }}>Export</th>
              <th style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'left' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(exports).map(([name, result]) => (
              <tr key={name}>
                <td style={{ border: '1px solid #ccc', padding: '8px' }}>{name}</td>
                <td style={{
                  border: '1px solid #ccc',
                  padding: '8px',
                  color: result === 'OK' ? 'green' : 'red',
                  fontWeight: 'bold'
                }}>
                  {result}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={{ marginTop: '2rem' }}>
        <h2>Status</h2>
        <p style={{
          padding: '1rem',
          backgroundColor: status.includes('correctly') ? '#d4edda' : '#f8d7da',
          borderRadius: '4px'
        }}>
          {status}
        </p>
      </section>

      <section style={{ marginTop: '2rem' }}>
        <h2>Environment</h2>
        <ul>
          <li>Platform: {process.env.PLATFORM || 'unknown'}</li>
          <li>Mode: {process.env.NODE_ENV || 'unknown'}</li>
          <li>Vite HMR: {import.meta.hot ? 'enabled' : 'disabled'}</li>
        </ul>
      </section>
    </div>
  );
}

// Mount the app
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}

// HMR support for development
if (import.meta.hot) {
  import.meta.hot.accept();
  console.log('[HMR] Browser module hot-reloaded');
}

export default App;
