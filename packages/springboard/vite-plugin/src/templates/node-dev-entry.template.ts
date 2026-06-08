import process from 'node:process';

import crosswsNodeImport from 'crossws/adapters/node';

type CrosswsNodeAdapter = typeof crosswsNodeImport;
const crosswsNode = ((crosswsNodeImport as unknown as {default?: CrosswsNodeAdapter}).default ?? crosswsNodeImport) as CrosswsNodeAdapter;

import { initApp } from 'springboard/server/hono_app';
import { makeWebsocketServerCoreDependenciesWithSqlite } from 'springboard/platforms/node/services/ws_server_core_dependencies';
import { LocalJsonNodeKVStoreService } from 'springboard/platforms/node/services/node_kvstore_service';
import { CoreDependencies, Springboard } from 'springboard/core';
import {
  springboard,
  clearRegisteredModules,
  clearRegisteredClassModules,
  clearRegisteredSplashScreen,
} from 'springboard/core/engine/register';
import { resetServerRegistry } from 'springboard/server/register';

export type DevServerHandle = {
  fetch: (request: Request) => Promise<Response>;
  ws: ReturnType<typeof crosswsNode>;
  dispose: () => Promise<void>;
};

springboard.reset();
clearRegisteredModules();
clearRegisteredClassModules();
clearRegisteredSplashScreen();
resetServerRegistry();

await import('__USER_ENTRY__');

export async function createDevServer(): Promise<DevServerHandle> {
  const nodeKvDeps = await makeWebsocketServerCoreDependenciesWithSqlite();
  const useWebSocketsForRpc = import.meta.env.VITE_USE_WEBSOCKETS_FOR_RPC === 'true';

  let wsNode: ReturnType<typeof crosswsNode>;

  const { app, serverAppDependencies, injectResources, createWebSocketHooks } = initApp({
    broadcastMessage: (message) => {
      return wsNode.publish('event', message);
    },
    remoteKV: nodeKvDeps.kvStoreFromKysely,
    userAgentKV: new LocalJsonNodeKVStoreService('userAgent'),
    enableStaticRoutes: false,
  });

  app.notFound((c) => {
    c.header('x-springboard-fallback', '1');
    return c.text('', 404);
  });

  wsNode = crosswsNode({
    hooks: createWebSocketHooks(useWebSocketsForRpc),
  });

  const coreDeps: CoreDependencies = {
    log: console.log,
    showError: console.error,
    storage: serverAppDependencies.storage,
    isMaestro: () => true,
    rpc: serverAppDependencies.rpc,
  };

  Object.assign(coreDeps, serverAppDependencies);

  const engine = new Springboard(coreDeps, {});

  injectResources({
    engine,
    serveStaticFile: async (c, _fileName, headers) => {
      Object.entries(headers).forEach(([key, value]) => {
        c.header(key, value);
      });
      c.status(404);
      return c.text('Not found');
    },
    getEnvValue: (name) => process.env[name],
  });

  await engine.initialize();

  return {
    fetch: app.fetch,
    ws: wsNode,
    dispose: async () => {
      wsNode.closeAll();
    },
  };
}
