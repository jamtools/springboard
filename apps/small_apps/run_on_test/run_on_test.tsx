import React from 'react';
import springboard from 'springboard';

// Test springboard.runOn() transformation

springboard.registerModule('run_on_test', {}, async (moduleAPI) => {
    // Test 1: runOn with node platform
    const nodeDeps = springboard.runOn('node', () => {
        console.log('Running on node');
        return {
            platform: 'node',
            secret: 'node-only-secret',
        };
    });

    // Test 2: runOn with browser platform
    const browserDeps = springboard.runOn('browser', () => {
        console.log('Running on browser');
        return {
            platform: 'browser',
            feature: 'browser-only-feature',
        };
    });

    // Test 3: runOn with async callback
    const asyncDeps = await springboard.runOn('node', async () => {
        console.log('Running async on node');
        return {
            asyncData: 'node-async-data',
        };
    });

    // Test 4: runOn with fallback pattern
    const deps = springboard.runOn('node', () => {
        return {midi: 'node-midi-service'};
    }) ?? springboard.runOn('browser', () => {
        return {audio: 'browser-audio-service'};
    });

    const RunOnTestUI: React.FC = () => {
        return (
            <div style={{padding: '20px', fontFamily: 'monospace'}}>
                <h1>springboard.runOn() Test</h1>
                <div style={{marginTop: '20px'}}>
                    <h2>Expected Behavior:</h2>
                    <ul>
                        <li><strong>Node Build:</strong> nodeDeps and asyncDeps should have values, browserDeps should be null</li>
                        <li><strong>Browser Build:</strong> browserDeps should have values, nodeDeps and asyncDeps should be null</li>
                    </ul>
                </div>
                <div style={{marginTop: '20px'}}>
                    <h2>Values:</h2>
                    <pre>nodeDeps: {JSON.stringify(nodeDeps, null, 2)}</pre>
                    <pre>browserDeps: {JSON.stringify(browserDeps, null, 2)}</pre>
                    <pre>asyncDeps: {JSON.stringify(asyncDeps, null, 2)}</pre>
                    <pre>deps: {JSON.stringify(deps, null, 2)}</pre>
                </div>
            </div>
        );
    };

    moduleAPI.ui.registerRoute('/', {}, () => <RunOnTestUI />);

    return {};
});
