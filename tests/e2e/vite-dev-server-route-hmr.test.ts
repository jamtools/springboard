import { afterEach, describe, expect, test } from 'vitest';
import { createServer, type ViteDevServer } from 'vite';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { springboardDev } from '../../packages/springboard/vite-plugin/src/plugins/dev.js';
import type { NormalizedOptions } from '../../packages/springboard/vite-plugin/src/types.js';

const TEST_ROUTE_PATH = '/__e2e/custom-route';
const INITIAL_ROUTE_VALUE = 'ROUTE_VERSION_1';
const UPDATED_ROUTE_VALUE = 'ROUTE_VERSION_2';
const ROUTE_WAIT_TIMEOUT_MS = 30_000;
const ROUTE_POLL_INTERVAL_MS = 150;
const TMP_PARENT_DIR = path.resolve(process.cwd(), 'packages/springboard/.tmp-e2e-fixtures');

type RunningFixture = {
    fixtureRoot: string;
    routeFilePath: string;
    server: ViteDevServer;
    port: number;
};

const delay = async (ms: number): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, ms));
};

const createFixture = async (): Promise<{ fixtureRoot: string; routeFilePath: string }> => {
    await fs.mkdir(TMP_PARENT_DIR, { recursive: true });
    const fixtureRoot = await fs.mkdtemp(path.join(TMP_PARENT_DIR, 'vite-dev-route-'));
    const sourceDir = path.join(fixtureRoot, 'src');
    const routeFilePath = path.join(sourceDir, 'server-entry.ts');
    const browserEntryPath = path.join(sourceDir, 'browser-entry.ts');
    const indexHtmlPath = path.join(fixtureRoot, 'index.html');

    await fs.mkdir(sourceDir, { recursive: true });

    await fs.writeFile(routeFilePath, `
import { serverRegistry } from 'springboard/server/register';

serverRegistry.registerServerModule((server) => {
  server.hono.get('${TEST_ROUTE_PATH}', (c) => {
    return c.text('${INITIAL_ROUTE_VALUE}');
  });
});
`.trimStart(), 'utf-8');

    await fs.writeFile(browserEntryPath, 'export {};\n', 'utf-8');
    await fs.writeFile(indexHtmlPath, '<!doctype html><html><body><div id="root"></div></body></html>\n', 'utf-8');

    return { fixtureRoot, routeFilePath };
};

const makeOptions = (fixtureRoot: string): NormalizedOptions => {
    return {
        entry: './src/server-entry.ts',
        entryConfig: {
            node: './src/server-entry.ts',
            browser: './src/browser-entry.ts',
        },
        platforms: ['node'],
        platform: 'node',
        platformMacro: 'node',
        documentMeta: undefined,
        viteConfig: undefined,
        debug: false,
        partykitName: undefined,
        outDir: 'dist',
        root: fixtureRoot,
        nodeServerPort: 1337,
    };
};

const getListeningPort = (server: ViteDevServer): number => {
    const address = server.httpServer?.address();
    if (!address || typeof address === 'string') {
        throw new Error('Failed to read dev server address');
    }
    return address.port;
};

const startFixtureServer = async (fixtureRoot: string): Promise<{ server: ViteDevServer; port: number }> => {
    const server = await createServer({
        configFile: false,
        root: fixtureRoot,
        logLevel: 'error',
        server: {
            host: '127.0.0.1',
            port: 0,
        },
        plugins: [springboardDev(makeOptions(fixtureRoot))],
    });

    await server.listen();
    const port = getListeningPort(server);
    return { server, port };
};

const getRouteResponse = async (port: number): Promise<{ status: number; body: string }> => {
    const url = `http://127.0.0.1:${port}${TEST_ROUTE_PATH}`;
    const response = await fetch(url, { cache: 'no-store' });
    const body = await response.text();
    return { status: response.status, body };
};

const waitForRouteValue = async (port: number, expectedBody: string): Promise<void> => {
    const deadline = Date.now() + ROUTE_WAIT_TIMEOUT_MS;
    let lastSeen = '<no response>';

    while (Date.now() < deadline) {
        try {
            const { status, body } = await getRouteResponse(port);
            lastSeen = `status=${status} body=${body}`;
            if (status === 200 && body === expectedBody) {
                return;
            }
        } catch (error) {
            if (error instanceof Error) {
                lastSeen = error.message;
            } else {
                lastSeen = String(error);
            }
        }

        await delay(ROUTE_POLL_INTERVAL_MS);
    }

    throw new Error(`Timed out waiting for route body "${expectedBody}". Last seen: ${lastSeen}`);
};

const editRouteSource = async (routeFilePath: string): Promise<void> => {
    const before = await fs.readFile(routeFilePath, 'utf-8');
    if (!before.includes(INITIAL_ROUTE_VALUE)) {
        throw new Error(`Expected source to contain ${INITIAL_ROUTE_VALUE}`);
    }

    const after = before.replace(INITIAL_ROUTE_VALUE, UPDATED_ROUTE_VALUE);
    await fs.writeFile(routeFilePath, after, 'utf-8');
};

describe('Springboard dev server route HMR', () => {
    let runningFixture: RunningFixture | null = null;

    afterEach(async () => {
        if (runningFixture) {
            await runningFixture.server.close();
            await fs.rm(runningFixture.fixtureRoot, { recursive: true, force: true });
            runningFixture = null;
        }

        await fs.rm(TMP_PARENT_DIR, { recursive: true, force: true });
    });

    test('reloads registerServerModule route after source edit', async () => {
        const { fixtureRoot, routeFilePath } = await createFixture();
        try {
            const { server, port } = await startFixtureServer(fixtureRoot);
            runningFixture = {
                fixtureRoot,
                routeFilePath,
                server,
                port,
            };
        } catch (error) {
            await fs.rm(fixtureRoot, { recursive: true, force: true });
            throw error;
        }

        if (!runningFixture) {
            throw new Error('Fixture server failed to start');
        }

        const { port } = runningFixture;

        await waitForRouteValue(port, INITIAL_ROUTE_VALUE);

        await editRouteSource(routeFilePath);

        await waitForRouteValue(port, UPDATED_ROUTE_VALUE);

        const finalResponse = await getRouteResponse(port);
        expect(finalResponse.status).toBe(200);
        expect(finalResponse.body).toBe(UPDATED_ROUTE_VALUE);
    });
});
