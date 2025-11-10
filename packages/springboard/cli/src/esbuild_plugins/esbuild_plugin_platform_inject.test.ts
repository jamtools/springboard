import {describe, it, expect, beforeAll} from 'vitest';
import path from 'path';
import fs from 'fs';
import {execSync} from 'child_process';

describe('esbuild_plugin_platform_inject', () => {
    const rootDir = path.resolve(__dirname, '../../../../..');
    const cliPath = path.resolve(__dirname, '../cli.ts');
    const testAppPath = 'server_state_edge_cases/server_state_edge_cases.tsx';
    const distPath = path.resolve(rootDir, 'apps/small_apps/dist');

    beforeAll(() => {
        // Clean dist directory before running tests
        if (fs.existsSync(distPath)) {
            fs.rmSync(distPath, { recursive: true, force: true });
        }

        // Build the edge cases app using the CLI
        execSync(`npx tsx ${cliPath} build ${testAppPath}`, {
            cwd: path.resolve(rootDir, 'apps/small_apps'),
            stdio: 'inherit',
            env: {
                ...process.env,
                NODE_ENV: 'production',
            },
        });
    });

    it('should remove server states and strip action bodies in browser build', async () => {
        // Read the browser build output
        const browserDistPath = path.join(distPath, 'browser/dist');
        const jsFiles = fs.readdirSync(browserDistPath).filter(f => f.endsWith('.js') && f.startsWith('index-'));
        expect(jsFiles.length).toBeGreaterThan(0);

        const browserBuildContent = fs.readFileSync(path.join(browserDistPath, jsFiles[0]), 'utf-8');

        // Verify server state CALLS are removed (secret data never appears)
        expect(browserBuildContent).not.toContain('user-123'); // From serverStates.userSession
        expect(browserBuildContent).not.toContain('secret-token');
        expect(browserBuildContent).not.toContain('sk_test_123'); // From serverStates.apiKeys
        expect(browserBuildContent).not.toContain('super-secret-password'); // From singleServerState
        expect(browserBuildContent).not.toContain('admin-key-123');

        // Verify regular actions are NOT stripped (they should have full bodies)
        expect(browserBuildContent).toContain('createAction("regular1"');
        expect(browserBuildContent).toContain('Regular action - will be kept in browser');
        // expect(browserBuildContent).toContain('regularActions');
        expect(browserBuildContent).toContain('Regular action that will be kept');

        // Verify server action calls exist but bodies are empty
        expect(browserBuildContent).toContain('createServerAction("serverAction1"');
        expect(browserBuildContent).toContain('createServerAction("serverAction2"');
        expect(browserBuildContent).toContain('createServerAction("serverAction3"');

        // Verify server action bodies are stripped (should not contain implementation details)
        expect(browserBuildContent).not.toContain('This should be removed from client');
        expect(browserBuildContent).toContain('Variable handler');

        // Verify createServerActions bodies are empty
        // expect(browserBuildContent).toContain('serverActions');
        expect(browserBuildContent).not.toContain('Authenticating user:');
        expect(browserBuildContent).not.toContain('Authorizing with keys');

    }, 60000);

    it('should keep server states and full action bodies in server build', async () => {
        // The server build was already created in the previous test
        // Read the server build output (not node - the server build is where everything is bundled)
        const serverDistPath = path.join(distPath, 'server/dist');
        const jsFiles = fs.readdirSync(serverDistPath).filter(f => f.endsWith('.cjs'));
        expect(jsFiles.length).toBeGreaterThan(0);

        const nodeBuildContent = fs.readFileSync(path.join(serverDistPath, jsFiles[0]), 'utf-8');

        // Verify server states are present
        expect(nodeBuildContent).toContain('createServerStates');
        expect(nodeBuildContent).toContain('userSession');
        expect(nodeBuildContent).toContain('apiKeys');
        expect(nodeBuildContent).toContain('user-123');
        expect(nodeBuildContent).toContain('secret-token');
        expect(nodeBuildContent).toContain('sk_test_123');

        // Verify createServerState is present
        expect(nodeBuildContent).toContain('createServerState');
        expect(nodeBuildContent).toContain('super-secret-password');
        expect(nodeBuildContent).toContain('admin-key-123');

        // Verify action bodies are intact
        expect(nodeBuildContent).toContain('Regular action - will be kept in browser');
        expect(nodeBuildContent).toContain('This should be removed from client');
        expect(nodeBuildContent).toContain('Variable handler');
        expect(nodeBuildContent).toContain('Regular action that will be kept');

        // Verify server action bodies are intact
        expect(nodeBuildContent).toContain('Authenticating user:');
        expect(nodeBuildContent).toContain('Authorizing with keys');
        expect(nodeBuildContent).toContain('hasPassword:');

    }, 60000);

    it('should only strip createServerAction and createServerActions, not regular actions', async () => {
        // Use the browser build from the first test
        const browserDistPath = path.join(distPath, 'browser/dist');
        const jsFiles = fs.readdirSync(browserDistPath).filter(f => f.endsWith('.js') && f.startsWith('index-'));
        const browserBuildContent = fs.readFileSync(path.join(browserDistPath, jsFiles[0]), 'utf-8');

        // Verify regular createAction keeps its body
        expect(browserBuildContent).toContain('createAction("regular1"');
        expect(browserBuildContent).toContain('Regular action - will be kept in browser');

        // Verify regular createActions keeps its bodies
        expect(browserBuildContent).toContain('Regular action that will be kept');

        // Verify createServerAction bodies are stripped
        expect(browserBuildContent).toContain('createServerAction("serverAction1"');
        expect(browserBuildContent).toContain('createServerAction("serverAction2"');
        expect(browserBuildContent).toContain('createServerAction("serverAction3"');
        expect(browserBuildContent).not.toContain('This should be removed from client');
        expect(browserBuildContent).not.toContain('Handler for test called');
        // Variable handler will still exist as an unused function declaration
        expect(browserBuildContent).toContain('Variable handler');

        // Verify createServerActions bodies are stripped
        expect(browserBuildContent).not.toContain('Authenticating user:');
    }, 60000);
});
