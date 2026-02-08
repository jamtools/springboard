import React from 'react';

interface AppProps {
  platform: string;
}

export const App: React.FC<AppProps> = ({ platform }) => {
  const [count, setCount] = React.useState(0);

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <h1>Springboard Multi-Platform Test</h1>
      <p>Platform: <strong>{platform}</strong></p>
      <p>Count: {count}</p>
      <button onClick={() => setCount(c => c + 1)}>Increment</button>
    </div>
  );
};
