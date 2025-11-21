# Final API Design - Springboard ModuleAPI v2

## Executive Summary

This document represents the finalized API design based on extensive Q&A and feedback. All decisions are marked as **✅ FINAL**.

---

## ✅ Core Design Principles

1. **Verbose & Explicit** - Method names clearly state what they create (`createServerStates`, not `createStates`)
2. **Namespace Organization** - Group related APIs under `.server`, `.shared`, `.userAgent`, `.ui`
3. **Security by Design** - Server-only code is obvious and stripped at build time
4. **Platform Flexibility** - Use `springboard.runOn(platform, callback)` for platform-specific code
5. **Immutability** - Freeze all framework-created objects after initialization

---

## ✅ Complete API Surface

```typescript
// ============================================
// SPRINGBOARD GLOBAL API
// ============================================

springboard.registerModule(moduleId, options, callback)
springboard.registerClassModule(callback)
springboard.registerSplashScreen(Component)
springboard.runOn(platform, callback)  // NEW

// ============================================
// MODULE API - Server Namespace
// ============================================

moduleAPI.server.createServerStates({...})
moduleAPI.server.createServerActions({...})
moduleAPI.server.createServerRecordStates({...})

// ============================================
// MODULE API - Shared Namespace
// ============================================

moduleAPI.shared.createSharedStates({...})
moduleAPI.shared.createSharedActions({...})
moduleAPI.shared.createSharedRecordStates({...})

// ============================================
// MODULE API - UserAgent Namespace
// ============================================

moduleAPI.userAgent.createUserAgentStates({...})
moduleAPI.userAgent.createUserAgentActions({...})
moduleAPI.userAgent.createUserAgentRecordStates({...})

// ============================================
// MODULE API - Client Namespace
// ============================================

moduleAPI.client.createClientActions({...})  // Server→Client RPC

// Note: NO moduleAPI.client.createStates() - use userAgent instead

// ============================================
// MODULE API - UI Namespace
// ============================================

moduleAPI.ui.registerRoute(path, options, component)
moduleAPI.ui.registerApplicationShell(component)
moduleAPI.ui.registerReactProvider(provider)  // Future

// ============================================
// MODULE API - Top Level Utilities
// ============================================

moduleAPI.getModule(moduleId)
moduleAPI.onDestroy(callback)
moduleAPI.moduleId
moduleAPI.fullPrefix

// ============================================
// MODULE API - Internal (Discouraged)
// ============================================

moduleAPI._internal.statesAPI
moduleAPI._internal.deps
```

---

## 🆕 New Feature: `springboard.runOn(platform, callback)`

Replace comment-based platform annotations with a typed API.

### API Signature

```typescript
function runOn<T>(
  platform: 'server' | 'client' | 'browser' | 'userAgent' | 'react-native' | 'tauri' | 'node' | 'cf-worker',
  callback: () => T | Promise<T>
): T | Promise<T>
```

### Current Pattern (Comments)
```typescript
// @platform "node"
createIoDependencies = async () => {
  const {NodeQwertyService} = await import('@jamtools/core/services/node/node_qwerty_service');
  const {NodeMidiService} = await import('@jamtools/core/services/node/node_midi_service');
  return {qwerty: new NodeQwertyService(), midi: new NodeMidiService()};
};
// @platform end
```

### New Pattern (Typed API)
```typescript
const createIoDependencies = springboard.runOn('node', async () => {
  const {NodeQwertyService} = await import('@jamtools/core/services/node/node_qwerty_service');
  const {NodeMidiService} = await import('@jamtools/core/services/node/node_midi_service');
  return {qwerty: new NodeQwertyService(), midi: new NodeMidiService()};
});
```

### Benefits
- ✅ TypeScript autocomplete for platform names
- ✅ Type-safe return values
- ✅ Clear scoping of platform-specific code
- ✅ Easier to write ESLint rules for
- ✅ Works with async imports seamlessly

### Build Transformation
The compiler detects `springboard.runOn(platform, ...)` and:
1. **On matching platform:** Replaces with just the callback body
2. **On other platforms:** Removes entire expression or replaces with `undefined`

```typescript
// Source
const deps = springboard.runOn('node', () => createNodeDeps());

// Browser build
const deps = undefined;

// Node build
const deps = (() => createNodeDeps())();
```

---

## 🔄 Client Actions - Server→Client RPC

Client actions allow the server to invoke functions on specific clients or broadcast to all clients.

### Complete Example

```typescript
springboard.registerModule('Main', {}, async (moduleAPI) => {

  // Define actions that server can call on clients
  const clientActions = moduleAPI.client.createClientActions({
    toast: async (args: {
      message: string;
      id?: string;
      type?: 'info' | 'success' | 'error' | 'warning';
      duration?: number;
    }) => {
      // Runs on client when server invokes it
      const newId = await createOrUpdateToast(args);
      return {toastId: newId};
    },

    updateProgress: async (args: {
      operationId: string;
      progress: number;
      status: string;
    }) => {
      // Update client UI
      setProgress(args.operationId, args.progress);
    },
  });

  // Server actions can invoke client actions
  const serverActions = moduleAPI.server.createServerActions({
    doTheThing: async (args: {userInput: string}, userContext) => {
      // userContext provided by framework:
      // - connectId: string
      // - userId?: string
      // - sessionId: string
      // - metadata: Record<string, any>

      // Call client action on specific user
      const {toastId} = await clientActions.toast(
        {message: 'Starting operation', type: 'info'},
        userContext
      );

      // Perform long-running work
      const result = await doSomeWork(args).onProgress(progress => {
        // Update the same toast with progress
        clientActions.toast(
          {
            message: `Operation ${progress}% complete`,
            id: toastId,
            type: 'info'
          },
          userContext
        );
      });

      // Final success toast
      await clientActions.toast(
        {
          message: 'Operation complete!',
          id: toastId,
          type: 'success',
          duration: 3000
        },
        userContext
      );

      return result;
    },
  });
});
```

### Client Action Call Modes

```typescript
// Call on specific client (default)
await clientActions.toast({message: 'Hello'}, userContext);

// Call locally (React Native → WebView communication)
await clientActions.toast({message: 'Hello'}, {mode: 'local'});

// Broadcast to all connected clients
await clientActions.toast({message: 'System announcement'}, {mode: 'broadcast'});

// Broadcast to all EXCEPT current user
await clientActions.toast({message: 'Someone else did something'}, {
  mode: 'broadcast_exclude_current_user',
  userContext
});
```

### Integration Example: Mantine Notifications

```typescript
const clientActions = moduleAPI.client.createClientActions({
  showNotification: async (args: {
    title?: string;
    message: string;
    color?: string;
    icon?: React.ReactNode;
    autoClose?: number | false;
    id?: string;
  }) => {
    // Direct integration with Mantine
    if (args.id) {
      notifications.update({
        id: args.id,
        ...args,
      });
    } else {
      const id = notifications.show(args);
      return {notificationId: id};
    }
  },
});
```

### React Native Considerations

- **Client Actions** run in **WebView process** by default
- To run in RN process, call a UserAgent action from the client action:

```typescript
const userAgentActions = moduleAPI.userAgent.createUserAgentActions({
  vibrate: async (args: {duration: number}) => {
    // Runs in React Native process
    Vibration.vibrate(args.duration);
  },
});

const clientActions = moduleAPI.client.createClientActions({
  notifyWithVibration: async (args: {message: string}) => {
    // This runs in WebView
    showToast(args.message);

    // Call to RN process
    await userAgentActions.vibrate({duration: 200});
  },
});
```

---

## 📦 Record States - ID-Based Collections

For managing collections of entities with IDs.

### API

```typescript
const recordStates = await moduleAPI.shared.createSharedRecordStates({
  users: {
    initialRecords: [
      {id: '1', name: 'Alice', role: 'admin'},
      {id: '2', name: 'Bob', role: 'user'}
    ],
    version: 1,
    migrate: async (current: {state: any, version: number}) => {
      // Optional migration logic
      switch (current.version) {
        case 1:
          // Already latest version
          return current.state;
        default:
          throw new Error(`Unknown version: ${current.version}`);
      }
    }
  }
});

// Methods available on recordStates.users:
recordStates.users.add({id: '3', name: 'Charlie', role: 'user'})
recordStates.users.upsert({id: '1', name: 'Alice Updated'})  // Create or update
recordStates.users.update('1', {name: 'Alice Updated'})      // Update existing
recordStates.users.replace('1', {id: '1', name: 'Alice', role: 'admin'})  // Full replace
recordStates.users.remove('2')
recordStates.users.getById('1')
recordStates.users.getAll()
recordStates.users.useState()  // React hook
recordStates.users.useById('1')  // React hook for single record
```

### Migration Pattern

```typescript
const serverStates = await moduleAPI.server.createServerRecordStates({
  myState: {
    initialRecords: [],
    version: 3,
    migrate: async (current: {state: any, version: number}) => {
      let migrated = current.state;
      let fromVersion = current.version;

      // Sequential migrations
      if (fromVersion < 2) {
        migrated = migrateV1ToV2(migrated);
      }
      if (fromVersion < 3) {
        migrated = migrateV2ToV3(migrated);
      }

      return migrated;
    },
  },
});

// Run migration on server startup
await springboard.runOn('server', async () => {
  await serverStates.myState.runMigration();
});
```

### Naming Consideration

Pattern becomes: `moduleAPI.server.createServerRecordStates(...)`

This is verbose but:
- ✅ Explicit about what's being created
- ✅ Compiler can detect method name for stripping
- ✅ Clear during code review
- ✅ Consistent with decision to be verbose everywhere

---

## 🔨 Build Transformation Strategy

### Detection Method: **Option A - Method Name**

The compiler looks for specific method names:
- `createServerStates`
- `createServerActions`
- `createServerRecordStates`

**Reason:** Don't enforce variable naming (`moduleAPI` could be renamed to `m` or `api`)

### Transformation Rules

#### 1. Server States - Variable Removal
```typescript
// Source
const serverStates = await moduleAPI.server.createServerStates({
  apiKey: process.env.STRIPE_KEY,
  dbPassword: process.env.DB_PASSWORD
});

// Client build
// (entire declaration removed)

// Server build
const serverStates = await moduleAPI.server.createServerStates({...});
```

#### 2. Server Actions - Body Stripping
```typescript
// Source
const serverActions = moduleAPI.server.createServerActions({
  authenticate: async (args) => {
    const session = serverStates.apiKey.getState();
    console.log('Authenticating:', args);
    return {authenticated: true};
  }
});

// Client build
const serverActions = moduleAPI.server.createServerActions({
  authenticate: async () => {}
});

// Server build
const serverActions = moduleAPI.server.createServerActions({...});
```

#### 3. Platform-Specific Code
```typescript
// Source
const deps = springboard.runOn('node', () => createNodeDeps());

// Client build
const deps = undefined;

// Server build
const deps = (() => createNodeDeps())();
```

### Important Note: Isomorphic Code

`moduleAPI.server` **DOES** exist on the client:
- Client needs to call server actions via RPC
- Only the **state variable declarations** are removed
- Action **implementations** have bodies stripped but structure remains

```typescript
// Client sees:
moduleAPI.server.createServerActions({
  myAction: async () => {}  // Body stripped, RPC call injected
})

// Client does NOT see:
const serverStates = ...  // Entire variable removed
```

---

## 🔒 Object Freezing Strategy

Freeze everything the framework creates to prevent accidental mutation.

### What Gets Frozen

```typescript
// 1. ModuleAPI instance
Object.freeze(moduleAPI);
Object.freeze(moduleAPI.server);
Object.freeze(moduleAPI.shared);
Object.freeze(moduleAPI.userAgent);
Object.freeze(moduleAPI.client);
Object.freeze(moduleAPI.ui);
Object.freeze(moduleAPI._internal);

// 2. State supervisors
const states = await moduleAPI.shared.createSharedStates({...});
Object.freeze(states);
Object.freeze(states.someState);  // Freeze each supervisor

// 3. Action objects
const actions = moduleAPI.shared.createSharedActions({...});
Object.freeze(actions);

// 4. Modules after initialization
const module = await registerModule('MyModule', {}, async (api) => {
  return {someExport: 'value'};
});
Object.freeze(module);
```

### Implementation

Use deep freeze utility:
```typescript
function deepFreeze<T>(obj: T): T {
  Object.freeze(obj);
  Object.getOwnPropertyNames(obj).forEach(prop => {
    const val = (obj as any)[prop];
    if (val && typeof val === 'object' && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  });
  return obj;
}
```

---

## 🧪 ESLint Rules

Inspired by React's exhaustive deps rule, create rules for Springboard patterns.

### Rule 1: `springboard/server-state-access`

**Enforce:** Server states can only be accessed in server actions or `springboard.runOn('server', ...)`

```typescript
// ❌ Bad
const MyComponent = () => {
  const value = serverStates.apiKey.getState();  // ERROR
  return <div>{value}</div>;
};

// ✅ Good
const serverActions = moduleAPI.server.createServerActions({
  getApiKey: async () => {
    return serverStates.apiKey.getState();  // OK - inside server action
  }
});
```

### Rule 2: `springboard/no-secrets-in-shared`

**Enforce:** Warn on hardcoded secrets in shared/userAgent state

```typescript
// ❌ Bad
const states = await moduleAPI.shared.createSharedStates({
  apiKey: 'sk_live_12345'  // ERROR: Possible secret in shared state
});

// ✅ Good
const states = await moduleAPI.server.createServerStates({
  apiKey: process.env.STRIPE_KEY  // OK - server state
});
```

### Rule 3: `springboard/platform-awareness`

**Enforce:** Respect `@platform` comments and `springboard.runOn()` blocks

```typescript
// ❌ Bad
const browserFeature = springboard.runOn('browser', () => {
  return window.localStorage;  // OK
});

const oops = window.localStorage;  // ERROR if not in browser block
```

### Rule 4: `springboard/client-action-context`

**Enforce:** Client actions invoked from server must have userContext or mode

```typescript
// ❌ Bad
await clientActions.toast({message: 'hi'});  // ERROR: Missing context

// ✅ Good
await clientActions.toast({message: 'hi'}, userContext);
await clientActions.toast({message: 'hi'}, {mode: 'broadcast'});
```

### Implementation Notes

- Study `configs/ExhaustiveDeps.ts` for AST traversal patterns
- Use ESTree node types: `CallExpression`, `MemberExpression`, `Identifier`
- Track scope and variable declarations
- Support both `// @platform` comments and `springboard.runOn()` patterns

---

## 📚 Documentation Structure

Write condensed docs first for review, then expand.

### Condensed Doc Outline

1. **API Reference** (Auto-generated via TypeDoc)
   - `moduleAPI.server.*`
   - `moduleAPI.shared.*`
   - `moduleAPI.userAgent.*`
   - `moduleAPI.client.*`
   - `moduleAPI.ui.*`
   - `springboard.runOn()`

2. **Core Concepts** (1-2 pages each)
   - State Lifecycle & Sync
   - Server vs Shared vs UserAgent
   - Client Actions Pattern
   - Platform-Specific Code
   - Record States & Migrations

3. **Guides** (Short, practical)
   - Quickstart (update existing)
   - Creating Server-Only Logic
   - Building Multiplayer Features
   - Integrating with UI Libraries (Mantine example)
   - Mobile App Considerations (RN + WebView)

4. **Migration from v1** (Not needed per your note, but keep for reference)

5. **Security Best Practices**
   - Never put secrets in `shared` or `userAgent`
   - Always use `server` for sensitive data
   - Validate inputs in server actions
   - Use client actions for user notifications

---

## 🎯 Implementation Checklist

### Phase 1: Core Refactor
- [ ] Create namespace classes (ServerAPI, SharedAPI, UserAgentAPI, ClientAPI, UIAPI)
- [ ] Implement verbose method names everywhere
- [ ] Move existing APIs to `_internal.*`
- [ ] Add Object.freeze() to all framework objects
- [ ] Update existing modules to use new API
- [ ] Add JSDoc comments to all public APIs

### Phase 2: Build System
- [ ] Update esbuild plugin to detect new method names
- [ ] Implement `springboard.runOn()` transformation
- [ ] Strip server state variables completely
- [ ] Strip server action bodies (keep structure)
- [ ] Add error stubs for client builds
- [ ] Test transformation with all edge cases

### Phase 3: Client Actions
- [ ] Implement `createClientActions()` method
- [ ] Add userContext parameter to RPC framework
- [ ] Support call modes: `local`, `broadcast`, `broadcast_exclude_current_user`
- [ ] Add client action registry
- [ ] Implement server→client invocation
- [ ] Test React Native → WebView communication

### Phase 4: Record States
- [ ] Implement `createRecordStates()` for all namespaces
- [ ] Add methods: `add`, `update`, `upsert`, `replace`, `remove`, `getById`, `getAll`
- [ ] Implement migration system with version tracking
- [ ] Add React hooks: `useState()`, `useById()`
- [ ] Test migration patterns

### Phase 5: Developer Tools
- [ ] Write ESLint rules (4 rules listed above)
- [ ] Add VS Code snippets for common patterns
- [ ] Improve error messages with helpful suggestions
- [ ] Add TypeScript declaration files

### Phase 6: Documentation
- [ ] Write condensed API docs (review draft)
- [ ] Generate TypeDoc reference
- [ ] Update quickstart guide
- [ ] Write security best practices
- [ ] Add example integrations (Mantine, etc.)
- [ ] Solicit community feedback

---

## ❓ Remaining Questions & Considerations

### 1. UserAgent vs Client Terminology

**Current decision:**
- `userAgent` = device storage (localStorage, RN AsyncStorage)
- `client` = network participant (for server→client RPC)

**Consideration:** Is this distinction clear to newcomers? Should we rename?
- Alternative: `device` and `client`?
- Alternative: `local` and `client`?

> someone could use `local` and think it's local to the server. I named `userAgent` before I was thinking of making server state etc., which is why I wanted to differentiate where it's stored. I like userAgent. should it be called local instead? the server actually does have its own userAgent state, but that's essentially the same as server state, but it's not removed by the compiler, and generally not accessed in any meaningful way on the server

### 2. Client Action Return Values

When server calls client action:
```typescript
const {toastId} = await clientActions.toast({message: 'hi'}, userContext);
```

**Questions:**
- Should this wait for client response? (adds latency)
- Or fire-and-forget with optional callback?
- What happens if client is disconnected?
- Should there be a timeout?

> I like supporting both async and optional callback. have a timeout as well. but return `{error: 'timed out' (or similar)} instead of throwing an error. maybe the server can supply its own toastId so it doesn't need to wait for the client to return that. it makes its own uuid that it keeps track of in the moment. client actions should generally not expect a return value. should be stateless but resuamable like the notification id thing

**Suggested approach:**
- Default: Fire-and-forget (don't await)
- Optional: `await` if you need return value
- Timeout after 5 seconds with error
- Queue messages if client temporarily disconnected

### 3. Record State Primary Keys

**Current:** Require `id` field

**Questions:**
- Always string? Or allow number?
- Support composite keys?
- Support custom key function?

> always string
> just do id for now. it makes it so we can have a column in the database to search for. we're doing a basic sql kvstore atm /Users/mickmister/code/jamtools-worktrees/server-state-jamtools-worktree/packages/springboard/data_storage/kv_api_trpc.ts:3
1: export class HttpKvStoreFromKysely {
  /Users/mickmister/code/jamtools-worktrees/server-state-jamtools-worktree/packages/springboard/data_storage/sqlite_db.ts:25
1:     await db.schema.createTable('kvstore')
> so we'll make a record based kvstore table that has ids and uses a key just like this kvstore table

**Suggested:** Start simple with string `id`, expand later if needed

### 4. Migration Rollback

**Question:** Should migrations support rollback/undo?

```typescript
migrate: async (current) => {
  return {
    up: () => migrateForward(current),
    down: () => migrateBackward(current)
  };
}
```

> Nah

**Suggested:** Not initially. Add if users request it.

### 5. Platform Detection at Runtime

**Question:** Should we expose `springboard.platform` for runtime checks?

```typescript
if (springboard.platform === 'node') {
  // Do something
}
```

> yeah but it's a combination of a few things
- "node" and "server"
- "cf-workers" and "server"
- "web" and "browser" and "client" and "user-agent"
- "tauri" and "browser" and "client" and "user-agent"
- "react-native-web" and "browser" and "client"
- "react-native" and "user-agent" (idk about client. I think react-native should forward client actions to the webview, for times where the RN process is communicating to the server, but the websocket is going to RN. idk maybe both are connected with the same better-auth session token, so they )

> I feel like the most common ones will be "server" and "browser", which is the same as "server" and "client" looking at the thing. maybe we can have a helper function like `isPlatform` that can do multiple checks for us, just like `runOn` for the same sets as above

**Suggested:** Yes, useful for debugging and conditional logic that can't be compiled out

### 6. State Versioning Strategy

**Question:** Where should version be stored?

> It should be stored in the database behind the scenes. it should be optional, as well as migrate

**Option A:** In state key
```typescript
const state = await moduleAPI.shared.createSharedStates({
  'myState:v3': initialValue
});
```

**Option B:** In metadata
```typescript
const state = await moduleAPI.shared.createSharedStates({
  myState: {value: initialValue, version: 3}
});
```

> I don't like how verbose this is, but it seems right. but I hate how it's verbose. maybe we make it so if a version is specified then it becomes a versioned object. but if not, the value it the value that `myState` points to. so we'll do a typescript ternary and make the thing a special versioned thing if it has a `version` key, and then support the optional `migrate` func as well. should be a smooth transition and not require any special setup between those two things. we should just add the version number to a separate thing in the database. then these are both valid:

```ts
const state = await moduleAPI.shared.createSharedStates({
  myState: {value: {message: null} as ({message: string | null}), version: 3},
});

const state = await moduleAPI.shared.createSharedStates({
  myState: {message: null} as {message: string | null},
});

```

> and the system adapts when version is added at a later deployment. maybe we enforce a `migrate` func if version is provided. we can put this in jsdocs

**Option C:** Separate version store
```typescript
// Framework tracks versions separately
```

**Suggested:** Option B for record states, Option C for regular states

> it's its own row in the existing kvstore behind the scenes for both of these things

---

## 🎨 Code Examples - Before & After

### Example 1: Simple Module

**Before:**
```typescript
springboard.registerModule('TicTacToe', {}, async (moduleAPI) => {
  const boardState = await moduleAPI.statesAPI.createSharedState('board', initialBoard);

  const actions = moduleAPI.createActions({
    clickCell: async (args) => {
      boardState.setState(newBoard);
    }
  });

  moduleAPI.registerRoute('/', {}, () => <Board />);
});
```

**After:**
```typescript
springboard.registerModule('TicTacToe', {}, async (moduleAPI) => {
  const states = await moduleAPI.shared.createSharedStates({
    board: initialBoard,
    winner: null
  });

  const actions = moduleAPI.shared.createSharedActions({
    clickCell: async (args) => {
      states.board.setState(newBoard);
    }
  });

  moduleAPI.ui.registerRoute('/', {}, () => <Board />);
});
```

### Example 2: Server + Client Module

**Before:**
```typescript
springboard.registerModule('Auth', {}, async (moduleAPI) => {
  const serverState = await moduleAPI.statesAPI.createServerState('sessions', {});

  const serverAction = moduleAPI.createServerAction('login', {}, async (creds) => {
    const session = await validateCredentials(creds);
    serverState.setState({...serverState.getState(), [session.id]: session});
    return {token: session.token};
  });

  moduleAPI.registerRoute('/login', {}, () => <LoginForm />);
});
```

**After:**
```typescript
springboard.registerModule('Auth', {}, async (moduleAPI) => {
  const serverStates = await moduleAPI.server.createServerStates({
    sessions: {}
  });

  const clientActions = moduleAPI.client.createClientActions({
    showWelcome: async (args: {username: string}) => {
      notifications.show({message: `Welcome ${args.username}!`});
    }
  });

  const serverActions = moduleAPI.server.createServerActions({
    login: async (creds, userContext) => {
      const session = await validateCredentials(creds);
      serverStates.sessions.setStateImmer(s => {
        s[session.id] = session;
      });

      // Notify client
      await clientActions.showWelcome({username: session.username}, userContext);

      return {token: session.token};
    }
  });

  moduleAPI.ui.registerRoute('/login', {}, () => <LoginForm />);
});
```

### Example 3: Platform-Specific Code

**Before:**
```typescript
// @platform "node"
const createNodeDeps = async () => {
  const midi = await import('midi-service');
  return {midi};
};
// @platform end

// @platform "browser"
const createBrowserDeps = async () => {
  const audio = await import('web-audio');
  return {audio};
};
// @platform end
```

**After:**
```typescript
const deps = await springboard.runOn('node', async () => {
  const midi = await import('midi-service');
  return {midi};
}) ?? await springboard.runOn('browser', async () => {
  const audio = await import('web-audio');
  return {audio};
});
```

> this looks nuts. definitely want unit tests on our esbuild plugin. really really cool stuff here. note we also need to support babel. we can copy this one and make unit tests for it too. it should match up with esbuild ideally /Users/mickmister/code/songdrive-workspaces/ffmpeg-songdrive/apps/mobile/babel.config.js. it's already got the comments thing

---

## 🚀 Next Steps

1. **Review this document** - Confirm all decisions are correct
2. **Write condensed docs** - API reference + core concepts (10-20 pages total)
3. **Get feedback** - Share with 2-3 developers for initial reactions
4. **Implement Phase 1** - Core refactor with new API structure
5. **Test thoroughly** - Ensure build transformations work correctly
6. **Implement remaining phases** - Client actions, record states, ESLint
7. **Launch & iterate** - Gather community feedback, adjust as needed

---

## 📝 Notes for Implementation

- Keep existing code working during development (feature flags?)
- Write tests for build transformations before implementing
- Consider adding `--verbose` flag for API naming (community feedback mechanism)
- Document security model clearly (what gets stripped, what doesn't)
- Add migration guides only if users request (not initially needed)
- Freeze objects gradually - start with ModuleAPI, expand to states
- Make ESLint rules opt-in initially (gradual adoption)
