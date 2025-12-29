import {startNodeApp, NodeAppDependencies} from './main';
import {NodeKVStoreService} from '../services/node_kvstore_service';
import {NodeLocalJsonRpcClientAndServer} from '../services/node_local_json_rpc';

/**
 * Creates a default RPC implementation for standalone node apps.
 * This is a simple local RPC that doesn't require external message broadcasting.
 */
const createDefaultRpc = (): NodeLocalJsonRpcClientAndServer => {
    return new NodeLocalJsonRpcClientAndServer({
        broadcastMessage: (message: string) => {
            // No-op for standalone apps - messages stay local
        }
    });
};

/**
 * Flexible entrypoint for Node.js applications.
 * Can be used with custom dependencies or will provide sensible defaults.
 *
 * @param deps - Optional dependencies. If not provided, defaults will be used.
 */
export default (deps?: Partial<NodeAppDependencies>) => {
    // Create default dependencies
    const storage = deps?.storage || new NodeKVStoreService('default');
    const rpc = deps?.rpc || createDefaultRpc();
    const injectEngine = deps?.injectEngine || (() => {
        // No-op by default - engine is started but not injected anywhere
    });

    // Merge provided deps with defaults
    const fullDeps: NodeAppDependencies = {
        storage,
        rpc,
        injectEngine,
        ...deps,
    };

    startNodeApp(fullDeps).then(async engine => {
        console.log('Node application started successfully');
        // Keep the process alive indefinitely
        await new Promise(() => {});
    }).catch(error => {
        console.error('Failed to start node application:', error);
        process.exit(1);
    });
};
