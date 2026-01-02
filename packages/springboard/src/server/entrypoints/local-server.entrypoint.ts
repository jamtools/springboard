import {serve} from '@hono/node-server';

import {makeWebsocketServerCoreDependenciesWithSqlite} from '../../platforms/node/services/ws_server_core_dependencies';

import type {NodeAppDependencies} from '../../platforms/node/entrypoints/main';

import {initApp} from '../hono_app';

export default async (): Promise<NodeAppDependencies> => {
    const coreDeps = await makeWebsocketServerCoreDependenciesWithSqlite();

    const {app, injectWebSocket, nodeAppDependencies} = initApp(coreDeps);

    const port = process.env.PORT || '1337';

    const server = serve({
        fetch: app.fetch,
        port: parseInt(port),
    }, (info) => {
        console.log(`Server listening on http://localhost:${info.port}`);
    });

    injectWebSocket(server);

    return nodeAppDependencies;
};
