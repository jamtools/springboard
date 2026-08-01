# Platform Support

Springboard supports multiple deployment platforms with platform-specific code.

## Supported Platforms

| Platform | Runtime | Use Case |
|----------|---------|----------|
| browser | Web browser | Standard web apps |
| node | Node.js | Server, CLI tools |
| desktop | Tauri | Desktop apps |
| react-native | React Native | Mobile apps |
| partykit | PartyKit edge | Serverless realtime |

## Platform Detection

```typescript
// Check platform at runtime
if (typeof window !== 'undefined') {
  // Browser
} else {
  // Node.js
}

// Check if maestro (server/authoritative)
if (moduleAPI.deps.core.isMaestro()) {
  // Running as server
}
```

## Conditional Compilation

Use `@platform` directives for platform-specific code:

```typescript
// @platform "node"
import fs from 'fs';

async function readFile(path: string) {
  return fs.readFileSync(path, 'utf-8');
}
// @platform end

// @platform "browser"
async function readFile(path: string) {
  const response = await fetch(path);
  return response.text();
}
// @platform end
```

The code block is only included in the specified platform build.

### Multiple Platforms
```typescript
// @platform "node"
// @platform "desktop"
// Code included in both Node.js and Desktop builds
import { exec } from 'child_process';
// @platform end
```

## Platform-Specific Services

### Browser

- **RPC**: WebSocket + HTTP fallback
- **Storage**: localStorage
- **Files**: Download via browser API

```typescript
// Browser-specific features
const { userAgent } = moduleAPI.deps.core.storage;
await userAgent.set('key', 'value'); // Uses localStorage
```

### Node.js

- **RPC**: WebSocket client
- **Storage**: JSON file on disk
- **Files**: fs module

```typescript
// @platform "node"
import { writeFileSync } from 'fs';

async function exportData(data: any) {
  writeFileSync('./export.json', JSON.stringify(data, null, 2));
}
// @platform end
```

### Desktop (Tauri)

- **RPC**: Tauri IPC bridge
- **Storage**: Local file system
- **Files**: Native file dialogs

```typescript
// @platform "desktop"
import { save } from '@tauri-apps/api/dialog';

async function saveFileDialog(content: string) {
  const path = await save({ defaultPath: 'document.txt' });
  if (path) {
    await writeTextFile(path, content);
  }
}
// @platform end
```

### React Native

- **RPC**: WebView bridge
- **Storage**: AsyncStorage
- **Files**: Platform-specific APIs

```typescript
// @platform "react-native"
import AsyncStorage from '@react-native-async-storage/async-storage';

async function saveLocal(key: string, value: string) {
  await AsyncStorage.setItem(key, value);
}
// @platform end
```

## Build Configuration

### CLI Options
```bash
# Build for specific platform
sb build src/index.tsx --platforms browser
sb build src/index.tsx --platforms node
sb build src/index.tsx --platforms desktop
sb build src/index.tsx --platforms all

# Development
sb dev src/index.tsx --platforms main  # browser + node
```

### Environment Variables
```typescript
// Available in browser builds
process.env.WS_HOST      // WebSocket host
process.env.DATA_HOST    // HTTP API host

// Available in node builds
process.env.PORT         // Server port
process.env.NODE_KV_STORE_DATA_FILE  // KV store path
```

## Cross-Platform Patterns

### Abstract Platform Differences
```typescript
// platform-utils.ts
export async function readLocalFile(key: string): Promise<string | null> {
  // @platform "browser"
  return localStorage.getItem(key);
  // @platform end

  // @platform "node"
  try {
    const { readFileSync } = await import('fs');
    return readFileSync(`./data/${key}.txt`, 'utf-8');
  } catch {
    return null;
  }
  // @platform end
}
```

### Feature Detection
```typescript
const features = {
  hasFileSystem: typeof window === 'undefined',
  hasClipboard: typeof navigator?.clipboard !== 'undefined',
  isOnline: typeof navigator?.onLine !== 'undefined' ? navigator.onLine : true
};
```

## Offline Support

### Browser Offline Mode
```bash
sb build src/index.tsx --platforms browser_offline
```

Builds a fully offline-capable version:
- All assets bundled
- `isMaestro()` returns `true`
- LocalStorage for all state

### Detecting Online Status
```typescript
// @platform "browser"
function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return online;
}
// @platform end
```
