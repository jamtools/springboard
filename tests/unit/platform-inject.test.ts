import {describe, expect, it} from 'vitest';
import {applyPlatformTransform} from '../../packages/springboard/vite-plugin/src/plugins/platform-inject.js';

const transform = (code: string, platform: Parameters<typeof applyPlatformTransform>[2], options?: Parameters<typeof applyPlatformTransform>[3]) => {
    return applyPlatformTransform(code, '/src/example.tsx', platform, options)?.code ?? code;
};

describe('vite platform inject transform', () => {
    it('keeps matching platform blocks and removes non-matching blocks', () => {
        const code = `
// @platform "node"
const serverSecret = 'server-secret';
// @platform end
// @platform "browser"
const browserValue = 'browser-value';
// @platform end
`;

        const browser = transform(code, 'web');
        expect(browser).toContain('browser-value');
        expect(browser).not.toContain('server-secret');

        const node = transform(code, 'node');
        expect(node).toContain('server-secret');
        expect(node).not.toContain('browser-value');
    });

    it('transforms runOn calls for matching and non-matching platforms', () => {
        const code = `
const nodeValue = springboard.runOn('node', () => 'node-only-secret');
const webValue = springboard.runOn('browser', () => 'browser-only-feature');
`;

        const browser = transform(code, 'web');
        expect(browser).toContain('browser-only-feature');
        expect(browser).not.toContain('node-only-secret');
        expect(browser).toContain('undefined');

        const node = transform(code, 'node');
        expect(node).toContain('node-only-secret');
        expect(node).not.toContain('browser-only-feature');
    });

    it('strips server states and server action implementations from client builds', () => {
        const code = `
const secretStates = await moduleAPI.server.createServerStates({apiKey: 'sk_test_123'});
const singleSecret = await moduleAPI.server.createServerState('password', 'super-secret-password');
const serverActions = moduleAPI.server.createServerActions({
  authenticate: async (args) => {
    console.log('Authenticating user:', args.userId, secretStates.apiKey.getState());
    return {ok: true};
  }
});
const regularAction = moduleAPI.shared.createSharedAction('regular', {}, async () => {
  console.log('Regular action kept');
});
`;

        const browser = transform(code, 'web');
        expect(browser).not.toContain('sk_test_123');
        expect(browser).not.toContain('super-secret-password');
        expect(browser).not.toContain('Authenticating user:');
        expect(browser).toContain('createServerActions');
        expect(browser).toContain('Regular action kept');

        const node = transform(code, 'node');
        expect(node).toContain('sk_test_123');
        expect(node).toContain('super-secret-password');
        expect(node).toContain('Authenticating user:');
    });

    it('preserves server states/actions for offline browser and tauri builds when requested', () => {
        const code = `
const secretStates = await moduleAPI.server.createServerStates({apiKey: 'sk_test_123'});
const serverAction = moduleAPI.server.createServerAction('admin', {}, async () => {
  console.log('Admin server action body');
});
`;

        const offline = transform(code, 'browser_offline', {preserveServerStatesAndActions: true});
        expect(offline).toContain('sk_test_123');
        expect(offline).toContain('Admin server action body');

        const tauri = transform(code, 'tauri', {preserveServerStatesAndActions: true});
        expect(tauri).toContain('sk_test_123');
        expect(tauri).toContain('Admin server action body');
    });
});
