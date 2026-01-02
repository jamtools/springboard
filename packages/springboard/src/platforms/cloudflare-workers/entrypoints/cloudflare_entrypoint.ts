/**
 * Cloudflare Workers Entrypoint (Placeholder)
 *
 * This entrypoint is not yet implemented. The implementation would:
 * - Use the platform-agnostic initApp() from springboard/server/hono_app
 * - Provide Cloudflare-specific implementations for:
 *   - KV stores (Cloudflare KV instead of SQLite)
 *   - WebSocket handling (Durable Objects)
 *   - Static file serving (R2 or Workers Assets)
 *   - Environment variable access
 *
 * Reference: packages/springboard/src/platforms/node/entrypoints/node_server_entrypoint.ts
 */

export interface CloudflareEnv {
    KV_NAMESPACE: unknown; // Would be KVNamespace from @cloudflare/workers-types
}

export default {
    async fetch(_request: Request, _env: CloudflareEnv, _ctx: unknown): Promise<Response> {
        throw new Error('Cloudflare Workers platform not yet implemented');
    },
};
