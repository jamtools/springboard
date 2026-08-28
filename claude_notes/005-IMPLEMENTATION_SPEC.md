# Implementation Specification - ModuleAPI v2

This document contains all finalized decisions and serves as the single source of truth for implementation.

---

## 🎯 Core API - Final Structure

```typescript
// ============================================
// SPRINGBOARD GLOBAL
// ============================================

springboard.registerModule(moduleId, options, callback)
springboard.registerClassModule(callback)
springboard.registerSplashScreen(Component)
springboard.runOn(platform, callback)  // Returns T | Promise<T> | null
springboard.isPlatform(platform)  // Runtime check only
springboard.platform  // Current platform string
springboard.configure({disableObjectFreeze?: boolean})

// ============================================
// MODULE API
// ============================================

// Server namespace (stripped from client builds)
moduleAPI.server.createServerStates(states)
moduleAPI.server.createServerActions(actions)
moduleAPI.server.createServerRecordStates(recordStates)

// Shared namespace (synced across all clients)
moduleAPI.shared.createSharedStates(states)
moduleAPI.shared.createSharedActions(actions)
moduleAPI.shared.createSharedRecordStates(recordStates)

// UserAgent namespace (device-local storage)
moduleAPI.userAgent.createUserAgentStates(states)
moduleAPI.userAgent.createUserAgentActions(actions)
moduleAPI.userAgent.createUserAgentRecordStates(recordStates)

// Client namespace (server→client RPC)
moduleAPI.client.createClientActions(actions)

// UI namespace
moduleAPI.ui.registerRoute(path, options, component)
moduleAPI.ui.registerApplicationShell(component)
moduleAPI.ui.registerReactProvider(provider)  // Future

// Top-level utilities
moduleAPI.getModule(moduleId)
moduleAPI.onDestroy(callback)
moduleAPI.moduleId
moduleAPI.fullPrefix

// Internal (discouraged)
moduleAPI._internal.statesAPI
moduleAPI._internal.deps
```

---

## 🔨 Build Transformations

### 1. Server State Removal

**Detection:** Method name `createServerStates`

```typescript
// Source
const serverStates = await moduleAPI.server.createServerStates({
  apiKey: process.env.STRIPE_KEY
});

// Client build → ENTIRE DECLARATION REMOVED
// (nothing)

// Server build → unchanged
const serverStates = await moduleAPI.server.createServerStates({
  apiKey: process.env.STRIPE_KEY
});
```

### 2. Server Action Body Stripping

**Detection:** Method name `createServerActions`

```typescript
// Source
const serverActions = moduleAPI.server.createServerActions({
  authenticate: async (args) => {
    const key = serverStates.apiKey.getState();
    return {authenticated: true};
  }
});

// Client build → BODY STRIPPED
const serverActions = moduleAPI.server.createServerActions({
  authenticate: async () => {}
});

// Server build → unchanged
```

### 3. Platform-Specific Code (`springboard.runOn`)

**Detection:** `springboard.runOn(platform, callback)`

**Strategy:** Remove callback body for non-matching platforms, return `null` at runtime

```typescript
// Source
const deps = springboard.runOn('node', async () => {
  const midi = await import('midi-service');
  return {midi};
});

// Node build → Execute callback
const deps = await (async () => {
  const midi = await import('midi-service');
  return {midi};
})();

// Browser build → Return null
const deps = null;
```

**Complex expressions work naturally:**

```typescript
// Source
const deps = springboard.runOn('node', async () => {
  return {midi: await import('midi')};
}) ?? springboard.runOn('browser', async () => {
  return {audio: await import('audio')};
});

// Node build
const deps = await (async () => {
  return {midi: await import('midi')};
})() ?? null;

// Browser build
const deps = null ?? await (async () => {
  return {audio: await import('audio')};
})();
```

**Document the platform matrix:**
- `node` + `server`
- `cf-workers` + `server`
- `web` + `browser` + `client` + `user-agent`
- `tauri` + `browser` + `client` + `user-agent`
- `react-native-web` + `browser` + `client`
- `react-native` + `user-agent`

---

## 🌐 Platform Detection

### Runtime Only (No Compile-Time Optimization)

```typescript
// Single argument only
springboard.isPlatform('server')  // boolean
springboard.isPlatform('node')    // boolean

// Current platform
springboard.platform  // string: 'node' | 'browser' | 'cf-workers' | etc.

// Common patterns
if (springboard.isPlatform('server')) {
  // Do server things
}

// Multiple checks
const isServer = springboard.isPlatform('server');
const isNode = springboard.isPlatform('node');
if (isServer && isNode) {
  // Only on node server (not CF workers)
}
```

**Note:** These are runtime checks only. They do NOT affect compilation. Use `springboard.runOn()` for compile-time code removal.

---

## 🔄 Client Actions - Server→Client RPC

### Timeout Behavior

**Cascade:** Call-level → Action-level → Global default (5000ms)

```typescript
// Global default
const DEFAULT_TIMEOUT = 5000;

// Action-level timeout
const clientActions = moduleAPI.client.createClientActions({
  toast: {
    handler: async (args: {message: string}) => {
      showNotification(args.message);
    },
    timeout: 10000  // 10 seconds for this action
  },

  // Can also use function directly (uses default timeout)
  quickAction: async (args) => {
    doSomething();
  }
});

// Call-level timeout (overrides action-level)
await clientActions.toast({message: 'hi'}, userContext, {timeout: 3000});
```

### Async Pattern with Optional Callback

Use `.then()` for fire-and-forget with callback:

```typescript
// Fire-and-forget with no callback
clientActions.toast({message: 'hi'}, userContext);

// Fire-and-forget with callback using .then()
clientActions.toast({message: 'hi'}, userContext).then(
  result => console.log('Success:', result),
  error => console.error('Error:', error)
);

// Await if you need the result
const result = await clientActions.toast({message: 'hi'}, userContext);
```

### Timeout Return Value

**Never throw on timeout.** Return error object:

```typescript
const result = await clientActions.toast({message: 'hi'}, userContext);
if (result.error) {
  // Handle timeout or other error
  console.log(result.error);  // 'timed out' or other error message
} else {
  // Success
  console.log(result.data);
}
```

### Server-Generated IDs (Convention)

Framework doesn't enforce, but document the pattern:

```typescript
const serverActions = moduleAPI.server.createServerActions({
  doLongOperation: async (args, userContext) => {
    // Generate ID on server to avoid waiting
    const operationId = uuid();

    // Send initial notification
    clientActions.toast({
      message: 'Starting...',
      id: operationId
    }, userContext);

    // Do work
    await doWork();

    // Update same notification
    clientActions.toast({
      message: 'Complete!',
      id: operationId
    }, userContext);
  }
});
```

### Call Modes

```typescript
// Specific user (default)
await clientActions.toast({message: 'hi'}, userContext);

// Local (React Native → WebView)
await clientActions.toast({message: 'hi'}, {mode: 'local'});

// Broadcast to all
await clientActions.toast({message: 'System update'}, {mode: 'broadcast'});

// Broadcast except current user
await clientActions.toast({message: 'Someone else joined'}, {
  mode: 'broadcast_exclude_current_user',
  userContext
});
```

---

## 🗂️ State Versioning

### Smooth Transition

```typescript
// Non-versioned (version implicitly null)
const states = await moduleAPI.shared.createSharedStates({
  myState: {message: 'hello'}
});

// Add version later
const states = await moduleAPI.shared.createSharedStates({
  myState: {
    value: {message: 'hello'},
    version: 2,
    migrate: async (current) => {
      // current.version is null for old data
      if (current.version === null) {
        // Migrate from null → version 2
        return {message: current.state.message || 'default'};
      }
      if (current.version === 1) {
        // Migrate from v1 → v2
        return migrateV1ToV2(current.state);
      }
      return current.state;  // Already v2
    }
  }
});
```

### TypeScript Detection

```typescript
type StateConfig<T> =
  | T  // Simple value (no version)
  | {  // Versioned value
      value: T;
      version: number;
      migrate: (current: {state: any, version: number | null}) => T | Promise<T>;
    };

// Both valid:
const states = await moduleAPI.shared.createSharedStates({
  simple: {count: 0},  // No version
  versioned: {
    value: {count: 0},
    version: 1,
    migrate: async (current) => { /* required */ }
  }
});
```

### Database Schema

**Use metadata column in existing kvstore:**

```sql
CREATE TABLE kvstore (
  key TEXT PRIMARY KEY,
  value TEXT,  -- JSON
  metadata TEXT  -- JSON: {version: number}
);
```

**Enforce `migrate` when `version` is provided** (TypeScript + runtime check)

---

## 📦 Record States

### New Table Schema

```sql
CREATE TABLE kvstore_records (
  key TEXT,           -- 'prefix|state|users'
  record_id TEXT,     -- '123' (always string)
  value TEXT,         -- JSON
  metadata TEXT,      -- JSON: {version: number}
  PRIMARY KEY (key, record_id)
);

CREATE INDEX idx_kvstore_records_key ON kvstore_records(key);
```

### API

```typescript
const users = await moduleAPI.shared.createSharedRecordStates({
  users: {
    initialRecords: [
      {id: '1', name: 'Alice'},
      {id: '2', name: 'Bob'}
    ],
    version: 1,  // Optional
    migrate: async (current) => { /* Required if version provided */ }
  }
});

// Methods
users.add({id: '3', name: 'Charlie'})
users.update('1', {name: 'Alice Updated'})
users.upsert({id: '1', name: 'Alice'})  // Create or update
users.replace('1', {id: '1', name: 'Alice', role: 'admin'})
users.remove('2')
users.getById('1')
users.getAll()
users.useState()  // React hook - all records
users.useById('1')  // React hook - single record
```

### Sync Strategy

**Individual record sync** (not full collection):

```typescript
// Client receives:
{
  type: 'recordUpdate',
  key: 'prefix|state|users',
  recordId: '123',
  value: {id: '123', name: 'Updated'}
}

// Not:
{
  type: 'recordState',
  key: 'prefix|state|users',
  value: [allUsers]  // ❌ Too much data
}
```

### Performance

**Default:** Load all records into memory (consistent with current state pattern)

**Future:** Add `avoidPreload` option when needed:

```typescript
const users = await moduleAPI.shared.createSharedRecordStates({
  users: {
    initialRecords: [],
    avoidPreload: true  // Don't load all records on init
  }
});

// Then must explicitly load
await users.loadById('123');  // Lazy load single record
await users.loadAll();  // Load everything
```

---

## ⚠️ UserAgent State on Server

### Warning Strategy

**Warn when accessed, not created:**

```typescript
// Server code - creating is OK (no warning)
const userAgentStates = await moduleAPI.userAgent.createUserAgentStates({
  theme: 'dark'
});

// Server code - accessing triggers warning
const theme = userAgentStates.theme.getState();
// Console warning:
// "UserAgent state 'theme' accessed on server. This is rarely needed.
//  Consider using server state, or check isPlatform('client') before accessing."
```

### Suggested Pattern in Warning

```typescript
if (springboard.isPlatform('client')) {
  const theme = userAgentStates.theme.getState();  // No warning
}
```

---

## 🔧 Object Freezing

### Configuration

```typescript
// Default: Freeze everything
springboard.configure({
  disableObjectFreeze: false  // Default
});

// Opt-out for testing/debugging
springboard.configure({
  disableObjectFreeze: true  // Inherently insecure
});
```

### What Gets Frozen

```typescript
// 1. ModuleAPI and all namespaces
Object.freeze(moduleAPI);
Object.freeze(moduleAPI.server);
Object.freeze(moduleAPI.shared);
Object.freeze(moduleAPI.userAgent);
Object.freeze(moduleAPI.client);
Object.freeze(moduleAPI.ui);

// 2. State supervisors
const states = await moduleAPI.shared.createSharedStates({...});
Object.freeze(states);
Object.freeze(states.myState);

// 3. Actions
const actions = moduleAPI.shared.createSharedActions({...});
Object.freeze(actions);

// 4. Modules after initialization
Object.freeze(module);
```

---

## 🚨 Error Messages

### Server State Access from Client

```typescript
// Client tries to access server state
serverStates.apiKey.getState();

// Error thrown:
Error: Cannot access server state "apiKey" from client build.

Server states are only accessible server-side for security.

Did you mean to:
  • Use shared state: moduleAPI.shared.createSharedStates()
  • Call from server action: moduleAPI.server.createServerActions()

Docs: https://docs.springboard.dev/server-states
```

### Client Action Timeout

```typescript
const result = await clientActions.toast({message: 'hi'}, userContext);

// On timeout, result is:
{
  error: 'timed out',
  timeout: 5000,
  actionName: 'toast'
}
```

---

## 🧪 Testing Strategy

### Shared Test Suites

Create shared test cases for esbuild and babel transformers:

```typescript
// packages/springboard/cli/test/transformer-shared-tests.ts
export const transformerTests = [
  {
    name: 'removes server state declarations',
    input: `
      const serverStates = await moduleAPI.server.createServerStates({
        secret: 'key'
      });
    `,
    clientOutput: '',  // Removed entirely
    serverOutput: '...'  // Unchanged
  },
  {
    name: 'strips server action bodies',
    input: `
      const actions = moduleAPI.server.createServerActions({
        doThing: async (args) => {
          return {result: 'data'};
        }
      });
    `,
    clientOutput: `
      const actions = moduleAPI.server.createServerActions({
        doThing: async () => {}
      });
    `,
    serverOutput: '...'  // Unchanged
  },
  {
    name: 'handles runOn for node',
    input: `
      const deps = springboard.runOn('node', () => {
        return require('midi');
      });
    `,
    nodeOutput: `
      const deps = (() => {
        return require('midi');
      })();
    `,
    browserOutput: 'const deps = null;'
  },
  // ... more cases
];
```

### ESBuild Plugin Tests

```typescript
// packages/springboard/cli/test/esbuild-plugin.test.ts
import {esbuildPluginPlatformInject} from '../src/esbuild_plugins/esbuild_plugin_platform_inject';
import {transformerTests} from './transformer-shared-tests';

describe('esbuild plugin', () => {
  transformerTests.forEach(test => {
    it(test.name, async () => {
      const clientResult = await transformWithPlugin(test.input, 'browser');
      expect(normalize(clientResult)).toBe(normalize(test.clientOutput));

      const serverResult = await transformWithPlugin(test.input, 'node');
      expect(normalize(serverResult)).toBe(normalize(test.serverOutput));
    });
  });
});
```

### Babel Plugin Tests

```typescript
// packages/springboard/cli/test/babel-plugin.test.ts
import {babelPluginPlatformInject} from '../src/babel_plugins/babel_plugin_platform_inject';
import {transformerTests} from './transformer-shared-tests';

describe('babel plugin', () => {
  transformerTests.forEach(test => {
    it(test.name, () => {
      const clientResult = babelTransform(test.input, 'browser');
      expect(normalize(clientResult)).toBe(normalize(test.clientOutput));

      const serverResult = babelTransform(test.input, 'node');
      expect(normalize(serverResult)).toBe(normalize(test.serverOutput));
    });
  });
});
```

---

## 📚 Documentation Requirements

### 1. API Reference (TypeDoc)

Auto-generate from comprehensive JSDoc comments:

```typescript
/**
 * Create server-only states that are never synced to clients.
 *
 * **Security:** State values are only accessible server-side. In client builds,
 * the entire variable declaration is removed by the compiler.
 *
 * **Storage:** Persisted to server storage (database/filesystem).
 *
 * **Sync:** Never synced to clients. Use `shared.createSharedStates()` for synced state.
 *
 * @example
 * ```typescript
 * const serverStates = await moduleAPI.server.createServerStates({
 *   apiKey: process.env.STRIPE_KEY,
 *   dbPassword: process.env.DB_PASSWORD
 * });
 *
 * // In server action
 * const key = serverStates.apiKey.getState();
 * ```
 *
 * @see {@link https://docs.springboard.dev/server-states | Server States Guide}
 */
createServerStates<States extends Record<string, any>>(
  states: States
): Promise<{[K in keyof States]: ServerStateSupervisor<States[K]>}>
```

### 2. Platform Matrix Document

Create table showing what platforms map to what tags:

| Runtime Environment | Platform Tags |
|---------------------|---------------|
| Node.js server | `node`, `server` |
| Cloudflare Workers | `cf-workers`, `server` |
| Web browser | `web`, `browser`, `client`, `user-agent` |
| Tauri desktop | `tauri`, `browser`, `client`, `user-agent` |
| React Native Web | `react-native-web`, `browser`, `client` |
| React Native | `react-native`, `user-agent` |

### 3. Migration Examples

Document common patterns with before/after:
- Simple shared state
- Server-only logic
- Client actions integration
- Platform-specific code
- Record states

---

## 🎯 Implementation Phases

**Progress Summary:**
- ✅ Phase 1: Core Refactor - COMPLETE
- ✅ Phase 2: Build System - COMPLETE
- ⏸️ Phase 3: Platform Detection - NOT STARTED
- ⏸️ Phase 4: Client Actions - NOT STARTED
- ⏸️ Phase 5: State Versioning - NOT STARTED
- ⏸️ Phase 6: Record States - NOT STARTED
- ⏸️ Phase 7: Warnings & Error Messages - NOT STARTED
- ⏸️ Phase 8: Babel Plugin - NOT STARTED
- ⏸️ Phase 9: Documentation - NOT STARTED
- ⏸️ Phase 10: Polish & Launch - NOT STARTED

**Commits:**
- `5143799` - Phase 1 & 2: Core refactor + build transformations
- `374e5b2` - Bonus: registerReactProvider implementation

---

### Phase 1: Core Refactor (Week 1-2) ✅ COMPLETE
- [x] Create namespace classes (ServerAPI, SharedAPI, UserAgentAPI, ClientAPI, UIAPI)
- [x] Implement all `create*` methods with verbose names
- [x] ~~Move existing APIs to `_internal.*`~~ (Decided against; deprecated methods delegate to new APIs instead)
- [ ] Add `springboard.configure()` for object freezing (Deferred)
- [ ] Implement object freezing logic (deep freeze) (Deferred)
- [x] Add comprehensive JSDoc to all public methods
- [x] Update existing modules to use new API
- [x] **BONUS:** Implement `registerReactProvider()` with multi-provider support

### Phase 2: Build System (Week 2-3) ✅ COMPLETE
- [x] Update esbuild plugin to detect new method names (both old and new namespaced APIs)
- [x] Implement `springboard.runOn()` transformation
- [x] Strip server state variable declarations
- [x] Strip server action bodies (keep structure)
- [ ] Create shared test suite (Deferred - separate esbuild/babel tests for now)
- [x] Add esbuild plugin tests (7 comprehensive tests covering all transformations)
- [x] Test transformation edge cases (browser/node builds, async callbacks, chained `??` operators)

### Phase 3: Platform Detection (Week 3)
- [ ] Implement `springboard.isPlatform(platform)`
- [ ] Implement `springboard.platform` getter
- [ ] Add runtime platform detection logic
- [ ] Document platform matrix
- [ ] Add unit tests

### Phase 4: Client Actions (Week 3-4)
- [ ] Implement `createClientActions()` method
- [ ] Add timeout cascade logic (call → action → global)
- [ ] Support both function and config object patterns
- [ ] Implement userContext parameter in RPC framework
- [ ] Add call modes: `local`, `broadcast`, `broadcast_exclude_current_user`
- [ ] Return error objects on timeout (no throw)
- [ ] Add client action registry
- [ ] Implement server→client invocation
- [ ] Test React Native → WebView communication

### Phase 5: State Versioning (Week 4-5)
- [ ] Add metadata column to kvstore table
- [ ] Implement version detection (check for `version` key in config)
- [ ] TypeScript: Require `migrate` when `version` provided
- [ ] Runtime: Validate `migrate` function exists
- [ ] Handle null version (for unversioned data)
- [ ] Store version in metadata column
- [ ] Call migrate function on state initialization
- [ ] Add unit tests for migration logic

### Phase 6: Record States (Week 5-6)
- [ ] Create `kvstore_records` table with schema
- [ ] Implement `createRecordStates()` for all namespaces
- [ ] Add methods: `add`, `update`, `upsert`, `replace`, `remove`
- [ ] Add getters: `getById`, `getAll`
- [ ] Implement individual record sync (not full collection)
- [ ] Add React hooks: `useState()`, `useById()`
- [ ] Support versioning for record states
- [ ] Test with 1000+ records
- [ ] Document `avoidPreload` for future performance optimization

### Phase 7: Warnings & Error Messages (Week 6)
- [ ] Implement UserAgent state access warning on server
- [ ] Add helpful suggestions in warning message
- [ ] Implement error stubs for server state access from client
- [ ] Add detailed error messages with docs links
- [ ] Test all error scenarios

### Phase 8: Babel Plugin (Week 7)
- [ ] Extend existing babel plugin
- [ ] Share logic with esbuild plugin where possible
- [ ] Run shared test suite against babel plugin
- [ ] Ensure output matches esbuild plugin
- [ ] Test with React Native babel config

### Phase 9: Documentation (Week 8)
- [ ] Write condensed API overview (10-20 pages)
- [ ] Generate TypeDoc reference
- [ ] Document platform matrix
- [ ] Update quickstart guide
- [ ] Write security best practices guide
- [ ] Add example integrations (Mantine, etc.)
- [ ] Create migration examples

### Phase 10: Polish & Launch (Week 9)
- [ ] Add VS Code snippets
- [ ] Improve error messages based on testing
- [ ] Performance testing
- [ ] Security audit
- [ ] Community preview (2-3 developers)
- [ ] Address feedback
- [ ] Public release

---

## ✅ Definition of Done

Each feature is complete when:
- [ ] Implementation matches this spec
- [ ] Unit tests written and passing (>90% coverage)
- [ ] Integration tests passing
- [ ] JSDoc comments added
- [ ] TypeScript types are correct
- [ ] No TypeScript errors in strict mode
- [ ] Manual testing completed
- [ ] Documentation written
- [ ] Code review completed
- [ ] Merged to main branch

---

## 🚨 Out of Scope (For Now)

Explicitly NOT implementing in this phase:
- ❌ ESLint rules (tabled for future)
- ❌ Migration codemods (experimental phase, breaking changes OK)
- ❌ Backwards compatibility (hard break)
- ❌ Migration guides (not needed yet)
- ❌ Record state pagination/windowing (address when needed)
- ❌ Migration rollback support (add if users request)
- ❌ Composite keys for records (string `id` only)
- ❌ Complex platform nesting in ESLint (tabled)

---

## 📝 Notes for Implementation

### Code Organization

```
packages/springboard/
├── core/
│   ├── engine/
│   │   ├── module_api.ts          # Main ModuleAPI class
│   │   ├── server_api.ts          # ServerAPI namespace
│   │   ├── shared_api.ts          # SharedAPI namespace
│   │   ├── user_agent_api.ts      # UserAgentAPI namespace
│   │   ├── client_api.ts          # ClientAPI namespace (new)
│   │   ├── ui_api.ts              # UIAPI namespace
│   │   └── register.ts            # springboard global
│   ├── services/
│   │   ├── states/
│   │   │   ├── server_state_supervisor.ts
│   │   │   ├── shared_state_supervisor.ts
│   │   │   ├── user_agent_state_supervisor.ts
│   │   │   └── record_state_supervisor.ts  # New
│   │   └── platform/
│   │       ├── platform_detector.ts        # New
│   │       └── platform_types.ts           # New
├── cli/
│   ├── src/
│   │   ├── esbuild_plugins/
│   │   │   └── esbuild_plugin_platform_inject.ts
│   │   └── babel_plugins/
│   │       └── babel_plugin_platform_inject.ts
│   └── test/
│       ├── transformer-shared-tests.ts     # Shared test cases
│       ├── esbuild-plugin.test.ts
│       └── babel-plugin.test.ts
└── data_storage/
    ├── kv_api.ts                           # Updated for metadata
    └── record_store_api.ts                 # New
```

### Key Implementation Details

1. **Keep existing code working during development** - Use feature flags or parallel implementations

2. **Write tests first** for build transformations - These are critical and hard to debug

3. **Freeze gradually** - Start with ModuleAPI, expand to states, get feedback before freezing everything

4. **Platform detection is simple** - Just check `process` object, `window` object, or other globals

5. **Client actions need userContext** - Add to RPC framework, include connectId, userId, sessionId

6. **Record states are complex** - Start simple (all in memory), optimize later

7. **Version migration runs once** - On state initialization, check stored version vs declared version

8. **Babel and esbuild must match** - Share test suite, compare outputs

9. **Error messages are UX** - Spend time making them helpful, not just informative

10. **Document the "why"** - Not just "how to use", but "when to use" and "why it works this way"

---

## 🎉 Success Criteria

This implementation is successful when:

1. **All tests passing** - Unit, integration, and transformation tests
2. **TypeScript errors = 0** - In strict mode
3. **Existing modules migrated** - All internal modules use new API
4. **Build outputs correct** - Server code stripped from client builds
5. **Documentation complete** - API reference, guides, examples
6. **Performance maintained** - No significant regression in build time or runtime
7. **Security validated** - Server states never leak to client
8. **Community feedback positive** - 2-3 developers test and approve

---

This spec is the authoritative source for implementation. Any changes should update this document first, then implement.
