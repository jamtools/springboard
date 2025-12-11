/**
 * Springboard Test App - Single Entrypoint
 *
 * This demonstrates the correct Springboard pattern:
 * - Single source file works on ALL platforms
 * - Framework handles platform differences behind the scenes
 * - Use Springboard's module system for state, actions, and routing
 */

import React from 'react';
import springboard from 'springboard';

// Types for the counter app
type CounterState = {
  count: number;
  history: number[];
};

type Theme = 'light' | 'dark';

// Initial state
const initialCounterState: CounterState = {
  count: 0,
  history: [],
};

// Register the main module
springboard.registerModule('CounterApp', {}, async (moduleAPI) => {
  // Create persistent state - works across all platforms
  const counterState = await moduleAPI.statesAPI.createPersistentState<CounterState>(
    'counter_state_v1',
    initialCounterState
  );

  const themeState = await moduleAPI.statesAPI.createPersistentState<Theme>(
    'theme',
    'light'
  );

  // Create actions - these work on any platform
  const actions = moduleAPI.createActions({
    increment: async () => {
      counterState.setStateImmer((state) => {
        state.count += 1;
        state.history.push(state.count);
      });
    },

    decrement: async () => {
      counterState.setStateImmer((state) => {
        state.count -= 1;
        state.history.push(state.count);
      });
    },

    reset: async () => {
      counterState.setState(initialCounterState);
    },

    setCount: async (args: { value: number }) => {
      counterState.setStateImmer((state) => {
        state.count = args.value;
        state.history.push(state.count);
      });
    },

    toggleTheme: async () => {
      themeState.setState(themeState.getState() === 'light' ? 'dark' : 'light');
    },
  });

  // Register routes - framework handles routing on each platform
  moduleAPI.registerRoute(
    '/',
    {
      documentMeta: async () => ({
        title: 'Springboard Counter App',
        description: 'A multi-platform counter app built with Springboard',
      }),
    },
    () => {
      const counter = counterState.useState();
      const theme = themeState.useState();

      return (
        <CounterPage
          counter={counter}
          theme={theme}
          onIncrement={actions.increment}
          onDecrement={actions.decrement}
          onReset={actions.reset}
          onToggleTheme={actions.toggleTheme}
        />
      );
    }
  );

  moduleAPI.registerRoute(
    '/history',
    {
      documentMeta: async () => ({
        title: 'Counter History | Springboard',
        description: 'View the history of counter changes',
      }),
    },
    () => {
      const counter = counterState.useState();
      const theme = themeState.useState();

      return (
        <HistoryPage
          history={counter.history}
          theme={theme}
          onClear={actions.reset}
        />
      );
    }
  );
});

// ============================================================================
// Components
// ============================================================================

type CounterPageProps = {
  counter: CounterState;
  theme: Theme;
  onIncrement: () => void;
  onDecrement: () => void;
  onReset: () => void;
  onToggleTheme: () => void;
};

const CounterPage: React.FC<CounterPageProps> = ({
  counter,
  theme,
  onIncrement,
  onDecrement,
  onReset,
  onToggleTheme,
}) => {
  const styles = getStyles(theme);

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Springboard Counter</h1>
        <p style={styles.subtitle}>Multi-platform app demo</p>
        <button style={styles.themeButton} onClick={onToggleTheme}>
          {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
        </button>
      </header>

      <main style={styles.main}>
        <div style={styles.counterDisplay}>
          <span style={styles.countLabel}>Count</span>
          <span style={styles.countValue}>{counter.count}</span>
        </div>

        <div style={styles.buttonGroup}>
          <button style={styles.button} onClick={onDecrement}>
            - Decrement
          </button>
          <button style={styles.buttonPrimary} onClick={onIncrement}>
            + Increment
          </button>
        </div>

        <button style={styles.buttonSecondary} onClick={onReset}>
          Reset
        </button>

        <nav style={styles.nav}>
          <a href="/history" style={styles.link}>
            View History ({counter.history.length} entries)
          </a>
        </nav>
      </main>

      <footer style={styles.footer}>
        <p>Built with Springboard - Write once, run everywhere</p>
        <ul style={styles.platformList}>
          <li>Browser</li>
          <li>Node.js</li>
          <li>PartyKit</li>
        </ul>
      </footer>
    </div>
  );
};

type HistoryPageProps = {
  history: number[];
  theme: Theme;
  onClear: () => void;
};

const HistoryPage: React.FC<HistoryPageProps> = ({ history, theme, onClear }) => {
  const styles = getStyles(theme);

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Counter History</h1>
        <a href="/" style={styles.backLink}>
          Back to Counter
        </a>
      </header>

      <main style={styles.main}>
        {history.length === 0 ? (
          <p style={styles.emptyMessage}>No history yet. Start counting!</p>
        ) : (
          <>
            <ul style={styles.historyList}>
              {history.map((value, index) => (
                <li key={index} style={styles.historyItem}>
                  <span style={styles.historyIndex}>#{index + 1}</span>
                  <span style={styles.historyValue}>{value}</span>
                </li>
              ))}
            </ul>
            <button style={styles.buttonSecondary} onClick={onClear}>
              Clear History
            </button>
          </>
        )}
      </main>
    </div>
  );
};

// ============================================================================
// Styles
// ============================================================================

const getStyles = (theme: Theme): Record<string, React.CSSProperties> => {
  const isDark = theme === 'dark';

  const colors = {
    bg: isDark ? '#1a1a2e' : '#ffffff',
    text: isDark ? '#eaeaea' : '#333333',
    textMuted: isDark ? '#a0a0a0' : '#666666',
    primary: '#4f46e5',
    primaryHover: '#4338ca',
    secondary: isDark ? '#374151' : '#e5e7eb',
    border: isDark ? '#374151' : '#e5e7eb',
    cardBg: isDark ? '#16213e' : '#f9fafb',
  };

  return {
    container: {
      minHeight: '100vh',
      backgroundColor: colors.bg,
      color: colors.text,
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      padding: '2rem',
    },
    header: {
      textAlign: 'center',
      marginBottom: '2rem',
    },
    title: {
      fontSize: '2rem',
      fontWeight: 700,
      margin: '0 0 0.5rem 0',
    },
    subtitle: {
      color: colors.textMuted,
      margin: 0,
    },
    themeButton: {
      marginTop: '1rem',
      padding: '0.5rem 1rem',
      backgroundColor: 'transparent',
      border: `1px solid ${colors.border}`,
      borderRadius: '0.375rem',
      color: colors.text,
      cursor: 'pointer',
      fontSize: '0.875rem',
    },
    main: {
      maxWidth: '400px',
      margin: '0 auto',
      textAlign: 'center',
    },
    counterDisplay: {
      backgroundColor: colors.cardBg,
      border: `1px solid ${colors.border}`,
      borderRadius: '0.75rem',
      padding: '2rem',
      marginBottom: '1.5rem',
    },
    countLabel: {
      display: 'block',
      fontSize: '0.875rem',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      marginBottom: '0.5rem',
    },
    countValue: {
      display: 'block',
      fontSize: '4rem',
      fontWeight: 700,
      color: colors.primary,
    },
    buttonGroup: {
      display: 'flex',
      gap: '1rem',
      justifyContent: 'center',
      marginBottom: '1rem',
    },
    button: {
      padding: '0.75rem 1.5rem',
      backgroundColor: colors.secondary,
      border: 'none',
      borderRadius: '0.5rem',
      color: colors.text,
      fontSize: '1rem',
      cursor: 'pointer',
      fontWeight: 500,
    },
    buttonPrimary: {
      padding: '0.75rem 1.5rem',
      backgroundColor: colors.primary,
      border: 'none',
      borderRadius: '0.5rem',
      color: '#ffffff',
      fontSize: '1rem',
      cursor: 'pointer',
      fontWeight: 500,
    },
    buttonSecondary: {
      padding: '0.5rem 1rem',
      backgroundColor: 'transparent',
      border: `1px solid ${colors.border}`,
      borderRadius: '0.375rem',
      color: colors.textMuted,
      fontSize: '0.875rem',
      cursor: 'pointer',
    },
    nav: {
      marginTop: '2rem',
    },
    link: {
      color: colors.primary,
      textDecoration: 'none',
    },
    backLink: {
      color: colors.primary,
      textDecoration: 'none',
      fontSize: '0.875rem',
    },
    footer: {
      textAlign: 'center',
      marginTop: '3rem',
      color: colors.textMuted,
      fontSize: '0.875rem',
    },
    platformList: {
      listStyle: 'none',
      padding: 0,
      display: 'flex',
      justifyContent: 'center',
      gap: '1rem',
      marginTop: '0.5rem',
    },
    historyList: {
      listStyle: 'none',
      padding: 0,
      margin: '0 0 1.5rem 0',
    },
    historyItem: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: '0.75rem 1rem',
      backgroundColor: colors.cardBg,
      border: `1px solid ${colors.border}`,
      borderRadius: '0.375rem',
      marginBottom: '0.5rem',
    },
    historyIndex: {
      color: colors.textMuted,
      fontSize: '0.875rem',
    },
    historyValue: {
      fontWeight: 600,
      color: colors.primary,
    },
    emptyMessage: {
      color: colors.textMuted,
      fontStyle: 'italic',
    },
  };
};
