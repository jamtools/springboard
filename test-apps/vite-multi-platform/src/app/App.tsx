import React from 'react';

interface Props {
  increment: () => void;
  decrement: () => void;
  count: number;
}

export const App = (props: Props) => {
  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <p>Count: {props.count}</p>
      <button onClick={() => props.increment()}>Increment</button>
      <button onClick={() => props.decrement()}>Decrement</button>
    </div>
  );
};
