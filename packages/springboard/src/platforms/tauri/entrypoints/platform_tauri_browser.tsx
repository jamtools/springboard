import React from 'react';
import ReactDOM from 'react-dom/client';

import {Command} from '@tauri-apps/plugin-shell';
import {appDataDir} from '@tauri-apps/api/path';

import {CoreDependencies} from '../../../core/types/module_types';

import {HttpKvStoreClient as HttpKVStoreService} from '../../../core/services/http_kv_store_client';

import {Main} from '../../browser/entrypoints/main';
// import {Main} from './main';
import {BrowserKVStoreService} from '../../browser/services/browser_kvstore_service';
import {BrowserJsonRpcClientAndServer} from '../../browser/services/browser_json_rpc';
import {Springboard} from '../../../core/engine/engine';
import {ExtraModuleDependencies} from '../../../core/module_registry/module_registry';

const RUN_SIDECAR_FROM_WEBVIEW = Boolean(process.env.RUN_SIDECAR_FROM_WEBVIEW);

let wsProtocol = 'ws';
let httpProtocol = 'http';
if (location.protocol === 'https:') {
    wsProtocol = 'wss';
    httpProtocol = 'https';
}

const WS_HOST = process.env.WS_HOST || `${wsProtocol}://${location.host}`;
const DATA_HOST = process.env.DATA_HOST || `${httpProtocol}://${location.host}`;

export const startAndRenderBrowserApp = async (): Promise<Springboard> => {
    const rpc = new BrowserJsonRpcClientAndServer(`${WS_HOST}/ws`);
    // const rpc = mockDeps.rpc;

    const kvStore = new HttpKVStoreService(DATA_HOST);

    // const kvStore = new BrowserKVStoreService(localStorage);
    const userAgentKVStore = new BrowserKVStoreService(localStorage);

    // const kvStore = mockDeps.storage.remote;
    // const userAgentKVStore = mockDeps.storage.userAgent;

    const isLocal = false;
    // const isLocal = localStorage.getItem('isLocal') === 'true';

    const coreDeps: CoreDependencies = {
        log: console.log,
        showError: (error: string) => console.error(error),
        storage: {
            remote: kvStore,
            userAgent: userAgentKVStore,
        },
        rpc: {
            remote: rpc,
            local: rpc,
        },
        isMaestro: () => isLocal,
    };

    const extraDeps: ExtraModuleDependencies = {
    };

    const engine = new Springboard(coreDeps, extraDeps);

    // await waitForPageLoad();

    const rootElem = document.createElement('div');
    // rootElem.style.overflowY = 'scroll';
    document.body.appendChild(rootElem);

    const root = ReactDOM.createRoot(rootElem);
    root.render(<Main engine={engine} />);

    await engine.waitForInitialize();

    return engine;
};

const startSidecar = async () => {
    const pingServer = async () => {
        await fetch('http://127.0.0.1:1337');
    };

    try {
        await pingServer();
        console.log('sidecar already started');
        return;
    } catch (e) {
        console.log('starting sidecar');
    }

    return new Promise<void>(async (resolve, reject) => {
        try {
            const dataDir = await appDataDir();

            const envVars = {
                NODE_KV_STORE_DATA_FILE: `${dataDir}/maestro_kv_data.json`,
                SQLITE_DATABASE_FILE: `${dataDir}/server_kv.db`,
                TAURI_DATA_DIRECTORY: dataDir,
                WEBAPP_FOLDER: '/snapshot/jamtools/dist/browser', // TODO: jamtools should not be hardcoded
            };

            const command = Command.sidecar('binaries/local-server', '', {
                env: envVars,
                cwd: dataDir, // I wish this would solve the issue with making data dir, and not require the env vars above. but it seems it doesn't solve it
            });

            const _proc = await command.spawn();
            // proc.write();

            command.stdout.on('data', (arg) => {
                console.log('command.stdout', arg);
            });

            command.stderr.on('data', (arg) => {
                console.log('command.stderr', arg);
            });

            await new Promise(r => setTimeout(r, 500));

            // TODO: we should really wait for a "ready" signal rather than continuously pinging
            for (let i = 0; i < 25; i++) {
                try {
                    await pingServer();
                    console.log('Successfully pinged server');
                    resolve();
                    return;
                } catch (e) {
                    console.error('failed to connect to sidecar. retrying in 0.5 seconds');
                    await new Promise(r => setTimeout(r, 500));
                }
            }

            throw new Error('Sidecar did not respond after multiple pings');
        } catch (e) {
            console.error('Error in webview, waiting for Tauri maestro to initialize');
            reject(e);
        }
    });
};

if (RUN_SIDECAR_FROM_WEBVIEW) {
    startSidecar().then(() => {
        console.log('sidecar started. starting webview app');
        startAndRenderBrowserApp();
    });
} else {
    startAndRenderBrowserApp();
}

export default async () => {};
