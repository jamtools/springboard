import React from 'react';
import springboard from 'springboard';

// Test various edge cases for server state and action compilation

springboard.registerModule('server_state_edge_cases', {}, async (moduleAPI) => {
    // Test 1: Multiple server states at once using createServerStates
    const serverStates = await moduleAPI.statesAPI.createServerStates({
        userSession: { userId: 'user-123', token: 'secret-token' },
        apiKeys: { stripe: 'sk_test_123', sendgrid: 'SG.xyz' },
        internalCache: { lastSync: Date.now(), data: {} },
    });

    // Test 2: Single server state
    const singleServerState = await moduleAPI.statesAPI.createServerState('config', {
        dbPassword: 'super-secret-password',
        adminKey: 'admin-key-123',
    });

    // Test 3: Function that returns a function (for actions)
    const createHandler = (name: string) => async () => {
        console.log(`Handler for ${name} called`);
        return { success: true, name };
    };

    // Test 4: Regular createAction
    const regularAction1 = moduleAPI.createAction('regular1', {}, async () => {
        console.log('Regular action - will be kept in browser');
        return { data: 'regular' };
    });

    // Test 5: Singular createServerAction with inline function
    const serverAction1 = moduleAPI.createServerAction('serverAction1', {}, async () => {
        console.log('This should be removed from client');
        return serverStates.userSession.getState();
    });

    // Test 6: Singular createServerAction with function that returns a function
    const serverAction2 = moduleAPI.createServerAction('serverAction2', {}, createHandler('test'));

    // Test 7: Singular createServerAction with variable reference
    const myHandler = async () => {
        console.log('Variable handler');
        return singleServerState.getState();
    };
    const serverAction3 = moduleAPI.createServerAction('serverAction3', {}, myHandler);

    // Test 8: Mix of createActions (regular - for backwards compat testing)
    const regularActions = moduleAPI.createActions({
        // Inline arrow function
        inlineArrow: async () => {
            console.log('Regular action that will be kept');
            return { type: 'regular' };
        },

        // Inline async function
        inlineAsync: async function() {
            return { data: 'async regular' };
        },
    });

    // Test 9: createServerActions (plural) with various patterns
    const serverActions = moduleAPI.createServerActions({
        // Server action with inline logic
        authenticate: async () => {
            const session = serverStates.userSession.getState();
            console.log('Authenticating user:', session.userId);
            return { authenticated: true, userId: session.userId };
        },

        // Server action with nested logic
        authorize: async () => {
            const keys = serverStates.apiKeys.getState();
            console.log('Authorizing with keys');
            return { authorized: true, hasStripeKey: !!keys.stripe };
        },

        // Server action accessing server state
        getSecrets: async () => {
            const config = singleServerState.getState();
            return { hasPassword: !!config.dbPassword };
        },
    });

    // UI Component to verify behavior
    const EdgeCasesUI: React.FC = () => {
        return (
            <div style={{padding: '20px', fontFamily: 'monospace'}}>
                <h1>Server State Edge Cases Test</h1>
                <div style={{marginTop: '20px'}}>
                    <h2>Regular Actions (backwards compat):</h2>
                    <button onClick={() => regularAction1()}>Regular Action 1</button>
                    <button onClick={() => regularActions.inlineArrow()}>Regular Actions.inlineArrow</button>
                    <button onClick={() => regularActions.inlineAsync()}>Regular Actions.inlineAsync</button>
                </div>
                <div style={{marginTop: '20px'}}>
                    <h2>Server Actions:</h2>
                    <button onClick={() => serverAction1()}>Server Action 1 (inline)</button>
                    <button onClick={() => serverAction2()}>Server Action 2 (factory)</button>
                    <button onClick={() => serverAction3()}>Server Action 3 (variable)</button>
                    <button onClick={() => serverActions.authenticate()}>Server Actions.authenticate</button>
                    <button onClick={() => serverActions.authorize()}>Server Actions.authorize</button>
                    <button onClick={() => serverActions.getSecrets()}>Server Actions.getSecrets</button>
                </div>
                <div style={{marginTop: '20px'}}>
                    <h3>Expected Behavior:</h3>
                    <ul>
                        <li><strong>Browser Build:</strong> All server states removed, all action bodies empty</li>
                        <li><strong>Server Build:</strong> Everything intact with full implementation</li>
                    </ul>
                </div>
            </div>
        );
    };

    moduleAPI.registerRoute('/', {}, () => <EdgeCasesUI />);
});
