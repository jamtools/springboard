/**
 * Tauri Maestro Entrypoint (Placeholder)
 *
 * This entrypoint runs on the Tauri sidecar (Node.js process) and provides
 * the "maestro" functionality - the server-side orchestrator for the Tauri app.
 *
 * The implementation would:
 * - Use dependency injection similar to node_server_entrypoint.ts
 * - Communicate with the Tauri webview via IPC or local WebSocket
 * - Provide local-only storage (file-based or SQLite)
 * - Handle native functionality through Tauri commands
 *
 * Reference: packages/springboard/src/platforms/node/entrypoints/node_server_entrypoint.ts
 */

import {startNodeApp, NodeAppDependencies} from '../../node/entrypoints/main';

export default async (_deps?: Partial<NodeAppDependencies>) => {
    throw new Error('Tauri maestro platform not yet implemented');
};

// Re-export for compatibility
export {startNodeApp};
