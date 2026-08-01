import {initApp} from './hono_app.js';
import {serverRegistry} from './register.js';
import type {KVStore, Springboard} from '../core/index.js';

const originalRegisterServerModule = serverRegistry.registerServerModule;

const makeKVStore = (): KVStore => ({
    get: async () => null,
    set: async () => {},
    getAll: async () => ({}),
});

const resetServerRegistry = () => {
    serverRegistry.registerServerModule = originalRegisterServerModule;
    delete (originalRegisterServerModule as unknown as {calls?: unknown[]}).calls;
};

describe('initApp server module routes', () => {
    beforeEach(() => {
        resetServerRegistry();
    });

    afterEach(() => {
        resetServerRegistry();
    });

    it('serves a registered server module route instead of the SPA fallback', async () => {
        serverRegistry.registerServerModule(({hono}) => {
            hono.post('/dashboard/api/webhooks/github', (c) => c.json({ok: true}));
        });

        const {app, injectResources} = initApp({
            remoteKV: makeKVStore(),
            userAgentKV: makeKVStore(),
            broadcastMessage: () => {},
        });

        injectResources({
            engine: {} as Springboard,
            getEnvValue: () => 'test',
            serveStaticFile: async (_c, fileName, headers) => new Response(`SPA ${fileName}`, {
                headers,
            }),
        });

        const apiResponse = await app.request('/dashboard/api/webhooks/github', {
            method: 'POST',
        });

        expect(apiResponse.headers.get('content-type')).toContain('application/json');
        expect(await apiResponse.json()).toEqual({ok: true});

        const spaResponse = await app.request('/dashboard/unknown');

        expect(await spaResponse.text()).toBe('SPA index.html');
        expect(spaResponse.headers.get('content-type')).toContain('text/html');
    });
});
