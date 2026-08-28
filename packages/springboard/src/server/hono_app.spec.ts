import {afterEach, describe, expect, it} from 'vitest';

import {initApp} from './hono_app.js';
import {resetServerRegistry, serverRegistry} from './register.js';
import type {KVStore, Springboard} from '../core/index.js';

class MemoryKVStore implements KVStore {
    private values = new Map<string, unknown>();

    get = async <T>(key: string): Promise<T | null> => {
        return (this.values.has(key) ? this.values.get(key) : null) as T | null;
    };

    set = async <T>(key: string, value: T): Promise<void> => {
        this.values.set(key, value);
    };

    getAll = async (): Promise<Record<string, any> | null> => {
        return Object.fromEntries(this.values.entries());
    };
}

const makeInitArgs = () => ({
    remoteKV: new MemoryKVStore(),
    userAgentKV: new MemoryKVStore(),
    broadcastMessage: () => undefined,
});

const makeInjectResources = () => ({
    engine: undefined as unknown as Springboard,
    getEnvValue: () => undefined,
    serveStaticFile: async (_c: unknown, fileName: string, headers: Record<string, string>) => new Response(`<html>${fileName}</html>`, {
        headers,
    }),
});

describe('initApp server module route ordering', () => {
    afterEach(() => {
        resetServerRegistry();
    });

    it('lets server module routes registered before initApp win over the SPA fallback', async () => {
        serverRegistry.registerServerModule(({hono}) => {
            hono.get('/dashboard/api/health', (c) => c.json({ok: true}));
        });

        const {app, injectResources} = initApp(makeInitArgs());

        injectResources(makeInjectResources());

        const apiResponse = await app.request('/dashboard/api/health');
        await expect(apiResponse.json()).resolves.toEqual({ok: true});
        expect(apiResponse.headers.get('content-type')).toContain('application/json');

        const spaResponse = await app.request('/dashboard/unknown');
        await expect(spaResponse.text()).resolves.toBe('<html>index.html</html>');
        expect(spaResponse.headers.get('content-type')).toContain('text/html');
    });

    it('lets server module routes registered after injectResources win over the SPA fallback', async () => {
        const {app, injectResources} = initApp(makeInitArgs());

        injectResources(makeInjectResources());

        serverRegistry.registerServerModule(({hono}) => {
            hono.get('/dashboard/api/late-health', (c) => c.json({ok: true}));
        });

        const response = await app.request('/dashboard/api/late-health');
        await expect(response.json()).resolves.toEqual({ok: true});
        expect(response.headers.get('content-type')).toContain('application/json');
    });

    it('serves a registered webhook route instead of the SPA fallback', async () => {
        serverRegistry.registerServerModule(({hono}) => {
            hono.post('/dashboard/api/webhooks/github', (c) => c.json({ok: true}));
        });

        const {app, injectResources} = initApp(makeInitArgs());

        injectResources(makeInjectResources());

        const apiResponse = await app.request('/dashboard/api/webhooks/github', {
            method: 'POST',
        });

        expect(apiResponse.headers.get('content-type')).toContain('application/json');
        await expect(apiResponse.json()).resolves.toEqual({ok: true});
    });
});
