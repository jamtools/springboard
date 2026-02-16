# Vite Multi-Platform Test App

This test app validates the Springboard Vite plugin across all 6 platform targets:

| Platform | Description | Command |
|----------|-------------|---------|
| browser_online | Web app with server connection | `npm run build:browser_online` |
| browser_offline | PWA with local SQLite | `npm run build:browser_offline` |
| node_maestro | Node.js backend server | `npm run build:node_maestro` |
| tauri | Desktop app (Tauri webview) | `npm run build:tauri` |
| rn_webview | React Native webview content | `npm run build:rn_webview` |
| rn_main | React Native host bundle | `npm run build:rn_main` |

## Prerequisites

- Node.js 20+
- pnpm
- Verdaccio running at http://localhost:4873

## Setup

```bash
# Start Verdaccio (in another terminal)
verdaccio

# Install dependencies (from Verdaccio)
pnpm install

# Run dev server
npm run dev
```

## Testing

Run the full test workflow:

```bash
./scripts/test-publish-workflow.sh
```

This will:
1. Publish springboard to local Verdaccio
2. Update dependencies
3. Build all platform targets
4. Report success/failure

## Development

```bash
# Dev server (browser + node)
npm run dev

# Dev server (browser only)
npm run dev:browser

# Build all platforms
npm run build:all

# Type check
npm run check-types
```
