import React from 'react';
import springboard from 'springboard';

// Test @platform directive comment removal and line preservation

springboard.registerModule('platform_directives_test', {}, async (moduleAPI) => {
    // Line 7 - This comment should be preserved

    // @platform "node"
    const nodeFeature = {
        fs: 'filesystem',
        secret: 'node-only-secret',
        data: 'node-platform-data'
    };
    console.log('Node platform code - should be removed in browser build');
    // @platform end
    // Line 17 - This should stay at line 17 even after platform block removal

    // @platform "browser"
    const browserFeature = {
        dom: 'document',
        feature: 'browser-only-feature',
        api: 'browser-web-api'
    };
    console.log('Browser platform code - should be removed in node build');
    // @platform end
    // Line 27 - Shared code marker

    // Shared code that should always exist in all builds
    const sharedCode = 'always-present';
    const anotherShared = 'also-shared';

    console.log('This is shared code that appears in all platforms');

    // @platform "server"
    const serverContext = {
        database: 'postgres',
        secret: 'server-context-secret'
    };
    console.log('Server context code - should appear in node AND cf-workers builds');
    // @platform end
    // Line 42 - After server context block

    moduleAPI.ui.registerRoute('/', {}, () => {
        return (
            <div>
                <h1>Platform Directives Test</h1>
                <p>Shared: {sharedCode}</p>
            </div>
        );
    });
});
