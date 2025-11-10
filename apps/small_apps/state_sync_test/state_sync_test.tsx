import React from 'react';
import springboard from 'springboard';
import {Module, registerModule} from 'springboard/module_registry/module_registry';
springboard

type StateSyncTestState = {
    sharedCounter: number;
    serverSecretValue: string;
    lastUpdated: number;
};

/**
 * Test module demonstrating the difference between server-only state and shared state.
 *
 * - sharedCounter: Syncs across all clients in real-time
 * - serverSecretValue: Only exists on server, never exposed to clients
 * - lastUpdated: Timestamp of last update (shared)
 */
springboard.registerModule('state_sync_test', {}, async (moduleAPI) => {
    const sharedState = await moduleAPI.statesAPI.createSharedState('counter', {
        value: 0,
        lastUpdated: Date.now(),
    });

    const serverState = await moduleAPI.statesAPI.createServerState('secret', {
        apiKey: 'super-secret-key-12345',
        internalCounter: 0,
    });

    // Actions to manipulate state
    const actions = moduleAPI.createActions({
        incrementShared: async () => {
            const current = sharedState.getState();
            sharedState.setState({
                value: current.value + 1,
                lastUpdated: Date.now(),
            });
        },

        incrementServer: async () => {
            const current = serverState.getState();
            serverState.setState({
                ...current,
                internalCounter: current.internalCounter + 1,
            });
        },

        getServerValue: async () => {
            // This action runs on the server and returns the server-only value
            const current = serverState.getState();
            return {internalCounter: current.internalCounter};
        },
    });

    // UI Component
    const StateTestUI: React.FC = () => {
        const shared = sharedState.useState();
        const [serverCount, setServerCount] = React.useState<number | null>(null);

        const fetchServerCount = async () => {
            const result = await actions.getServerValue();
            setServerCount(result.internalCounter);
        };

        React.useEffect(() => {
            fetchServerCount();
        }, []);

        return (
            <div style={{padding: '20px', fontFamily: 'sans-serif'}}>
                <h1>State Synchronization Test</h1>

                <div style={{
                    border: '2px solid #4CAF50',
                    padding: '15px',
                    marginBottom: '20px',
                    borderRadius: '8px',
                }}>
                    <h2>✅ Shared State (Syncs to All Clients)</h2>
                    <p><strong>Counter Value:</strong> <span id="shared-counter">{shared.value}</span></p>
                    <p><small>Last Updated: {new Date(shared.lastUpdated).toLocaleTimeString()}</small></p>
                    <button
                        id="increment-shared-btn"
                        onClick={() => actions.incrementShared()}
                        style={{
                            padding: '10px 20px',
                            fontSize: '16px',
                            backgroundColor: '#4CAF50',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                        }}
                    >
                        Increment Shared Counter
                    </button>
                </div>

                <div style={{
                    border: '2px solid #ff9800',
                    padding: '15px',
                    borderRadius: '8px',
                }}>
                    <h2>🔒 Server-Only State (Never Syncs to Clients)</h2>
                    <p><strong>Internal Counter:</strong> <span id="server-counter">{serverCount ?? 'Loading...'}</span></p>
                    <p><small>Note: This value is fetched via RPC action, not synced automatically</small></p>
                    <div style={{display: 'flex', gap: '10px'}}>
                        <button
                            id="increment-server-btn"
                            onClick={async () => {
                                await actions.incrementServer();
                                await fetchServerCount();
                            }}
                            style={{
                                padding: '10px 20px',
                                fontSize: '16px',
                                backgroundColor: '#ff9800',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                            }}
                        >
                            Increment Server Counter
                        </button>
                        <button
                            id="refresh-server-btn"
                            onClick={fetchServerCount}
                            style={{
                                padding: '10px 20px',
                                fontSize: '16px',
                                backgroundColor: '#2196F3',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                            }}
                        >
                            Refresh Server Value
                        </button>
                    </div>
                </div>

                <div style={{
                    marginTop: '20px',
                    padding: '15px',
                    backgroundColor: '#f5f5f5',
                    borderRadius: '8px',
                }}>
                    <h3>Testing Instructions</h3>
                    <ol>
                        <li>Open this page in two browser windows/tabs</li>
                        <li>Click "Increment Shared Counter" in one window - both windows update instantly</li>
                        <li>Click "Increment Server Counter" in one window - only updates when you click "Refresh"</li>
                        <li>Server-only state is never automatically synchronized to clients</li>
                    </ol>
                </div>
            </div>
        );
    };

    moduleAPI.registerRoute('/', {}, () => <StateTestUI />);
});
