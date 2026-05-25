# API Design Observations & Recommendations

Based on your feedback, here are the key decisions and recommendations for the ModuleAPI redesign.

---

## ✅ Core Decisions Summary

### 1. Namespaced Structure with Explicit Method Names
**Decision:** Use namespaces with explicit method names (Option B)

```typescript
moduleAPI.server.createServerStates({...})
moduleAPI.server.createServerActions({...})
moduleAPI.shared.createSharedStates({...})
moduleAPI.shared.createSharedActions({...})
moduleAPI.userAgent.createUserAgentStates({...})
moduleAPI.userAgent.createUserAgentActions({...})
moduleAPI.ui.registerRoute('/', {}, Component)
```

**Rationale:**
- `server` namespace stands out visually during code review
- Method names are explicit about what they create
- Avoids relying solely on namespace for meaning
- Better grep-ability and searchability

### 2. Internal APIs
Move current public APIs to `_internal`:
```typescript
moduleAPI._internal.statesAPI
moduleAPI._internal.deps
```

And freeze most framework-set objects to prevent mutation.

### 3. Migration Strategy
**Hard break** - No deprecation period, no migration guides. Clean slate.

### 4. Documentation
Regenerate API docs by namespace using typedoc (see commit `e455efe4e416c54fdee0146e893be2b7aa1bf1e2`)

---

## 🤔 Open Question: Redundancy vs Brevity

You raised an important point:
> Should we have `createStates` or explicit `createSharedStates`? Brevity is nice, and redundancy of repeating `shared` in `moduleAPI.shared.createSharedStates` feels weird

### Option 1: Short & DRY (Reduced Redundancy)
```typescript
moduleAPI.server.createStates({...})
moduleAPI.server.createActions({...})
moduleAPI.shared.createStates({...})
moduleAPI.shared.createActions({...})
moduleAPI.userAgent.createStates({...})
moduleAPI.userAgent.createActions({...})
```

**Pros:**
- Less typing, cleaner code
- Namespace already tells you the scope
- More pleasant to use frequently

**Cons:**
- Build transformations need to look at namespace + method (e.g., `moduleAPI.server.createStates`)
- Slightly less grep-able
- All methods have same name across namespaces

### Option 2: Explicit & Verbose
```typescript
moduleAPI.server.createServerStates({...})
moduleAPI.server.createServerActions({...})
moduleAPI.shared.createSharedStates({...})
moduleAPI.shared.createSharedActions({...})
moduleAPI.userAgent.createUserAgentStates({...})
moduleAPI.userAgent.createUserAgentActions({...})
```

**Pros:**
- Crystal clear what you're creating
- Easy to grep for "createServerStates" or "createSharedStates"
- Build transformations can match on method name alone if needed
- Reads well in isolation (code snippets, error messages)

**Cons:**
- Feels redundant: `moduleAPI.shared.createSharedStates`
- More typing

### Recommendation: **Hybrid Approach**

Keep explicit names for **server** (needed for build transformations), but use short names elsewhere:

```typescript
// Server - explicit (needed for compiler detection & security review)
moduleAPI.server.createServerStates({...})
moduleAPI.server.createServerActions({...})

// Shared - short (most common, prioritize DX)
moduleAPI.shared.createStates({...})
moduleAPI.shared.createActions({...})

// UserAgent - short
moduleAPI.userAgent.createStates({...})
moduleAPI.userAgent.createActions({...})
```

**Rationale:**
- Server methods MUST be explicit for security/code review visibility
- Shared methods are most frequently used → optimize for ergonomics
- UserAgent methods are less common → short names are fine
- Build transformations already need namespace detection for tree-shaking

> I don't think examples in this repo are condusive to real programs. And usage of each pattern will be specific to the app being developed.
> Let's go verbose and ask for community feedback. Let's put that in the docs.

---

## 💡 New Feature: Client Actions

You mentioned wanting to add "client actions" - server-to-client RPC calls.

### Current Pattern
Already exists for shared state sync:
```typescript
// packages/springboard/core/services/states/shared_state_service.ts:105
private receiveRpcSetSharedState = async (args: SharedStateMessage) => {
```

### Proposed API

**Option 1: Dedicated namespace**
```typescript
moduleAPI.client.createClientActions({
  showNotification: async (args: {message: string}) => {
    // Runs on client when server calls it
  },
  updateUIState: async (args: {key: string, value: any}) => {
    // ...
  }
})

// Server-side usage
await someClient.actions.showNotification({message: 'Hello'})
```

**Option 2: Under userAgent namespace**
```typescript
moduleAPI.userAgent.createClientCallableActions({
  showNotification: async (args) => { /* ... */ }
})
```

**Option 3: Explicit direction in name**
```typescript
moduleAPI.createServerToClientActions({
  showNotification: async (args) => { /* ... */ }
})
```

### Recommendation: **Option 1 with clarity**

```typescript
// Define client-side actions that server can invoke
moduleAPI.client.createActions({
  showNotification: async (args: {message: string}) => {
    // Runs on this client
  }
})

// Or more explicit:
moduleAPI.client.createClientActions({...})
```

**Rationale:**
- Symmetric with `server` namespace
- Clear that these run on client
- Natural place for client-specific APIs
- Distinguishes from `userAgent` (device storage) vs `client` (network participant)

**Alternative naming:**
- `moduleAPI.rpc.client.*` and `moduleAPI.rpc.server.*` - more explicit about RPC nature
- `moduleAPI.client.*` for client-initiated, `moduleAPI.receiver.*` for server-initiated


> Client actions are special though. Take this block for example:

```ts
springboard.registerModule('Main', {}, async (moduleAPI) => {


  const clientActions = moduleAPI.client.createClientActions({
    toast: async (args: {message: string; id?: string /* ...other mantine notifications props with sane defaults */}) => {
      const const newId = await createOrUpdateToast(args);
      return {toastId};
    },
  });

  const serverActions = moduleAPI.server.createServerActions({
    doTheThing: async (args: {userInput: string}, userContext) => { // userContext will be provided by the framework and contains things like connect id
      const {toastId} = await clientActions.toast({message: 'Starting operation'}, userContext); // optionally pass addtional properties like {mode: 'broadcast_exclude_current_user'}, or {mode: 'broadcast'}. we should also have examples of integrating with things like mantine notifications

      const result = await doSomeWork(args).onProgress(progress => {
        clientActions.toast({message: `Operation ${progress}% complete`, id: toastId}, userContext);
      });
    },
  });
});
```

---

## 🗂️ Future Feature: Record-Based State

You mentioned planning `createRecordBasedState` for handling IDs/updating objects.

### Suggested API

```typescript
// Under each namespace
moduleAPI.shared.createRecordBasedStates({
  users: {
    // Schema/initial records
    initialRecords: [
      {id: '1', name: 'Alice'},
      {id: '2', name: 'Bob'}
    ]
  },
  tasks: {
    initialRecords: []
  }
})

// Usage
users.add({id: '3', name: 'Charlie'})
users.update('1', {name: 'Alice Updated'})
users.remove('2')
users.getById('1')
users.getAll()
```

>

> Maybe a `replace` to signify we're replacing the whole value

> Maybe a `upsert` for "id may exist"

> I also want a `moduleAPI.server.runOnServer(() => {}), and one for client as well. Need to determine react native vs rn webview differences. I think client actions should run in the webview, and if the dev wants something to run in RN process, they can call a userAgent action from the client action. Here's a use case:

```ts
const serverStates = await m.server.createRecordStates({
  myState: {
    values: [],
    version: 3,
    migrate: async (current: {state, version}) => { // added this after writing this example. I think this is a cool pattern to provide

    },
  },
});

await m.server.runOnServer(async () => {
  switch (serverStates.myState.version) {
    case 1:
      // ...migrate to version 2
      // fallthrough
    case 2:
      // ...migrate to version 3
      // fallthrough
    case 3:
      // nothing to migrate
      break;
    default:
      // throw error or handle unknown version
  }
});
```

**Questions to consider:**
- Should it be `createRecordStates` or `createRecordBasedStates`?
- Should records require an `id` field, or accept a key function?
- Should it be under each namespace or a separate concern?

> `createRecordStates` looks good
> Let's require an id
> Under each namespace. But that that gets wordy right:

```ts
m.server.createServerRecordStates()
```

### Recommendation: **Namespace-specific**

```typescript
moduleAPI.server.createRecordStates({...})
moduleAPI.shared.createRecordStates({...})
moduleAPI.userAgent.createRecordStates({...})
```

Keeps the pattern consistent - each namespace has same capabilities, just different scope/sync behavior.

> We'll want to compile out `server.createServerRecordStates`, so I think we should use this one

---

## 🏗️ Proposed Final API Surface

```typescript
// Server-only (stripped from client builds)
moduleAPI.server.createServerStates({...})
moduleAPI.server.createServerActions({...})
moduleAPI.server.createRecordStates({...})  // future

// Shared/synced (source of truth on server)
moduleAPI.shared.createStates({...})
moduleAPI.shared.createActions({...})
moduleAPI.shared.createRecordStates({...})  // future

// User agent (device storage)
moduleAPI.userAgent.createStates({...})
moduleAPI.userAgent.createActions({...})
moduleAPI.userAgent.createRecordStates({...})  // future

// Client-callable (server → client RPC)
moduleAPI.client.createActions({...})  // new

// UI
moduleAPI.ui.registerRoute('/', {}, Component)
moduleAPI.ui.registerApplicationShell(Shell)
moduleAPI.ui.registerReactProvider(Provider)  // future

// Utilities (top-level)
moduleAPI.getModule('module-id')
moduleAPI.onDestroy(callback)

// Internal (discouraged from public use)
moduleAPI._internal.statesAPI
moduleAPI._internal.deps
```

> Nah I think I like the full verbose way. Let's start there and get community feedback

---

## 🔧 Build Transformation Updates

### Current Detection Pattern
```typescript
// esbuild plugin looks for:
'createServerState' || 'createServerStates' || 'createServerAction' || 'createServerActions'
```

### Proposed Detection Pattern

**Option A - Method name only:**
```typescript
'createServerStates' || 'createServerActions'
```
- Simpler regex
- Works if we use explicit names

**Option B - Namespace + method:**
```typescript
'moduleAPI.server.createServerStates' || 'moduleAPI.server.createServerActions'
```
- More precise
- Avoids false positives

**Option C - Any `moduleAPI.server.*`:**
```typescript
/moduleAPI\.server\./
```
- Future-proof
- Simple rule: "anything under `moduleAPI.server` gets stripped"

> I do like that in general. Though I don't want to enforce someone to name their variable `moduleAPI`, so this doesn't work. certainly don't want to remove `server.` entirely from the code. let's not do this

### Recommendation: **Option C**
Strip everything under `moduleAPI.server.*`, but leave stubs that throw errors (per Q8.2 decision).

> No let's go with Option A

```typescript
// Client build result
moduleAPI.server = new Proxy({}, {
  get() {
    throw new Error('moduleAPI.server is only available in server builds')
  }
})
```

> Note that this is isomorphic code. The client will indeed be calling `moduleAPI.server.createServerActions` in order to be able to call those actions. the argument to the function is stripped at compile time though. We compile out the `createServerState` so the client doesn't know about those at all

---

## 📝 Additional Recommendations

### 1. TypeScript Type Safety
Even though files are isomorphic, we can still provide better types:

```typescript
// In client builds, server APIs could be typed as unavailable
type ModuleAPIClient = {
  server: never;  // TypeScript error if you try to access
  shared: SharedAPI;
  userAgent: UserAgentAPI;
  // ...
}

// In server builds
type ModuleAPIServer = {
  server: ServerAPI;
  shared: SharedAPI;
  userAgent: UserAgentAPI;
  // ...
}
```

Though you mentioned TypeScript can't help because files are isomorphic - this might still catch some mistakes during development.

> `moduleAPI.server` does exist on the client though, so no

### 2. JSDoc Comments
Add comprehensive JSDoc with examples:

```typescript
/**
 * Create server-only states that are never available to clients.
 *
 * **Security:** State values are only accessible server-side. Clients cannot
 * read these values, even if they obtain a reference to the state object.
 *
 * **Storage:** Persisted to server storage (database/file system)
 *
 * **Build:** Entire variable declarations are removed from client builds.
 *
 * @example
 * ```typescript
 * const secrets = await moduleAPI.server.createServerStates({
 *   apiKey: process.env.STRIPE_KEY,
 *   dbPassword: process.env.DB_PASSWORD
 * })
 *
 * // Server-side only
 * const key = secrets.apiKey.getState()
 * ```
 */
createServerStates<States extends Record<string, any>>(
  states: States
): Promise<{[K in keyof States]: ServerStateSupervisor<States[K]>}>
```

### 3. Error Messages
Improve error messages to guide users:

```typescript
// When accessing server state from client stub
Error: Cannot access server state "apiKey" from client build.
Server states are only available server-side for security.
Use moduleAPI.shared.createStates() for client-accessible state.
```

> Error message structure looks good

### 4. Linting Rules (Future)
Create ESLint rules:
- Warn if hardcoded secrets appear in `moduleAPI.shared.*` or `moduleAPI.userAgent.*`
- Warn if `moduleAPI.server.*` is accessed in UI component files
- Suggest using `createRecordStates` when state is array of objects with `id` field

> Maybe. If we're going to use eslint, let's get creative and objective. What are we actually trying to solve? We can read the react hooks eslint plugin and learn from that. "server state must be accessed in a server action or `runOnServer` callback". can we have eslint be aware of code between comments too? like this /Users/mickmister/code/jamtools-worktrees/server-state-jamtools-worktree/packages/springboard/cli/src/esbuild_plugins/esbuild_plugin_platform_inject.ts:34
1:                 const platformRegex = new RegExp(`\/\/ @platform "${platform}"([\\s\\S]*?)\/\/ @platform end`, 'g');
1:                 const otherPlatformRegex = new RegExp(`\/\/ @platform "(node|browser|react-native|fetch)"([\\s\\S]*?)\/\/ @platform end`, 'g');

> we can ensure server stuff is being done in server land. you can do things like this /Users/mickmister/code/jamtools-worktrees/server-state-jamtools-worktree/packages/jamtools/core/modules/io/io_module.tsx:41
1: // @platform "node"
1: createIoDependencies = async () => {

> Speaking of which, we need an easy way to do these things. Maybe a `springboard.runOn('server' | 'client' | 'browser' | 'userAgent' | 'react-native' | 'tauri' | 'node' | 'cf-worker')`. Probably better than `moduleAPI.server.runOnServer`

> so this becomes

```typescript
springboard.runOn('server', () => {
  createIoDependencies = async () => {

  };
});
```

> `runOn` should return the return value of the callback, which may be a promise, in which case `runOn` returns a promise as well

> what do you think about this? the comment things are hard to type and have to autocompletion hand-holding. we can compile out the code so it's not present on other platforms, allowing seamless async imports like /Users/mickmister/code/jamtools-worktrees/server-state-jamtools-worktree/packages/jamtools/core/modules/io/io_module.tsx:50
1:     const {NodeQwertyService} = await import('@jamtools/core/services/node/node_qwerty_service');
1:     const {NodeMidiService} = await import('@jamtools/core/services/node/node_midi_service');

---

## 🎯 Implementation Priority

1. **Phase 1 - Core Refactor:**
   - Implement namespaced structure
   - Add explicit method names (`createServerStates`, etc.)
   - Move to `_internal.*`
   - Update build transformations
   - Add error stubs for client builds

2. **Phase 2 - Documentation:**
   - Regenerate typedoc API reference
   - Add comprehensive JSDoc
   - Update quickstart guide
   - Add security best practices doc

3. **Phase 3 - New Features:**
   - Add `moduleAPI.client.createActions()` for server→client RPC
   - Add `createRecordStates()` across namespaces
   - Add `moduleAPI.ui.registerReactProvider()`

4. **Phase 4 - DX Improvements:**
   - Add ESLint rules
   - Improve error messages
   - Add code snippets for VS Code

> For eslint rules, please see https://github.com/facebook/react/blob/main/packages/eslint-plugin-react-hooks/src/rules/ExhaustiveDeps.ts which I've placed at ./configs/ExhaustiveDeps.ts

---

## ❓ Questions for You

1. **Redundancy:** Do you prefer explicit (`createSharedStates`) everywhere, or hybrid (explicit for `server.*`, short elsewhere)?

> I think I like `createSharedStates`

2. **Client actions namespace:** `moduleAPI.client.*` or something else? Should it be symmetric with server?

> I think it should be `createClientAction`. it represents something to run in the caller of an action. I think RN process can reach into webview this way too. like `clientActions.toast(args, {mode: 'local'});`, so it doesn't require a user id etc.

3. **Record-based state:** Should it follow same pattern (`createRecordStates` under each namespace)?

> `moduleAPI.client.createStates` won't exist. because  user agent state should be used instead

4. **Object.freeze:** Which objects should be frozen? Just `moduleAPI`, or also state supervisors?

> I think everything the framework creates. modules themselves too after they're done initializing

5. **Docs priority:** Should we do hard break + refactor first, then docs? Or write docs to finalize API before implementing?

> we could write docs first. maybe a very condensed version that's easy to review

> ingest this, and create another doc to flesh out any more important things
