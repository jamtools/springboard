import {describe, it} from 'vitest';

// This integration suite is intentionally skipped until the package-level
// Vitest config can transform React Native's Flow-typed ESM entrypoint. Keep the
// file import-light so skipped tests do not make the publish/CI test phase parse
// react-native before the suite is enabled.
describe.skip('KvRnWebview', () => {
    it('should update UI when UserAgent state changes', () => {
        // Disabled pending React Native Vitest transform setup.
    });
});
