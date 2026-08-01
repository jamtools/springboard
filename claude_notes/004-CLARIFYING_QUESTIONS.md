# Clarifying Questions - API Design Details

Based on your feedback, here are some implementation details that need clarification.

---

## 1. Platform Detection - `isPlatform()` API

You mentioned wanting a helper similar to `runOn` that checks multiple platform tags:

### Pattern Matching Logic

```typescript
// These are the platform combinations you listed:
const combinations = {
  SERVER_NODE: ['node', 'server'],
  SERVER_WORKERS: ['cf-workers', 'server'],
  BROWSER_WEB: ['web', 'browser', 'client', 'user-agent'],
  BROWSER_TAURI: ['tauri', 'browser', 'client', 'user-agent'],
  BROWSER_RN_WEB: ['react-native-web', 'browser', 'client'],
  RN_NATIVE: ['react-native', 'user-agent'],
};
```

**Question 1a:** Should `isPlatform(['server', 'node'])` return true if ANY match (OR logic) or ALL match (AND logic)?

```typescript
// Option A: ANY (OR)
isPlatform(['server', 'node'])  // true on node, true on server

// Option B: ALL (AND)
isPlatform(['server', 'node'])  // true only if BOTH node AND server
```

> let's just allow one arg

**Question 1b:** Should we provide predefined constants?

```typescript
// Option A: String arrays
isPlatform(['server', 'node'])

// Option B: Constants
isPlatform(PLATFORM.SERVER_NODE)

// Option C: Both
isPlatform(['server', 'node'])  // works
isPlatform(PLATFORM.SERVER_NODE)  // also works
```

> keep them separate. we can have a `as const` thing and have the separated things

**Question 1c:** How does this work at compile time vs runtime?

```typescript
// At compile time (can optimize away branches)
if (isPlatform(['browser'])) {
  // This code can be removed in server build
}

// At runtime (can't optimize)
const platforms = getPlatformsFromConfig();
if (isPlatform(platforms)) {
  // Dynamic check, can't be compiled out
}
```

Should `isPlatform()` work at both compile and runtime, or just runtime?

> runtime use only. no compile changes

---

## 2. Client Action Patterns

### Timeout Behavior

You want `{error: 'timed out'}` instead of throwing.

**Question 2a:** What's the default timeout?

```typescript
// Option A: Fixed default
const DEFAULT_CLIENT_ACTION_TIMEOUT = 5000; // 5 seconds

// Option B: Configurable per action
moduleAPI.client.createClientActions({
  toast: {
    handler: async (args) => { /* ... */ },
    timeout: 10000  // 10 seconds for this specific action
  }
});

// Option C: Configurable per call
await clientActions.toast({message: 'hi'}, userContext, {timeout: 3000});
```

> I like all of them. cascade CBA. If C is defined, do that, otherwise do B, otherwise A
> we should still accept functions as the values passed to `createClientActions`

**Question 2b:** What does "optional callback" mean alongside async/await?

```typescript
// Option A: Promise + optional callback (Node.js style)
await clientActions.toast({message: 'hi'}, userContext, (error, result) => {
  // Called when response received or timeout
});

// Option B: Fire-and-forget mode
clientActions.toast({message: 'hi'}, userContext);  // No await, returns void

// Option C: Both patterns
const promise = clientActions.toast({message: 'hi'}, userContext);
await promise;  // Can await if needed
// Or ignore promise if fire-and-forget
```

> maybe we can just do a not awaited `then` if we want to do an "optional callback". any differences in performance or anything?

**Question 2c:** Server-generated IDs pattern

You mentioned server can supply its own UUID (like `toastId`) to avoid waiting. Should this be a convention or enforced?

> it's an arbitrary function call with an argument. nothing special to me

```typescript
// Convention: Pass id in args
const toastId = uuid();
await clientActions.toast({message: 'Starting', id: toastId}, userContext);
// ... later
await clientActions.toast({message: 'Progress 50%', id: toastId}, userContext);

// Or: Framework provides id automatically?
const {operationId} = clientActions.toast.createOperation();
await clientActions.toast({message: 'Starting', operationId}, userContext);
```

### Stateless but Resumable

You said "stateless but resumable like the notification id thing."

**Question 2d:** What does "resumable" mean here?

```typescript
// Is it about idempotency?
// Calling multiple times with same id updates the same toast
await clientActions.toast({message: 'Step 1', id: 'op-123'}, userContext);
await clientActions.toast({message: 'Step 2', id: 'op-123'}, userContext);  // Updates same toast

// Or about reconnection handling?
// If client disconnects and reconnects, can continue operation
await clientActions.toast({message: 'Step 3', id: 'op-123'}, userContext);  // Works after reconnect

// Or both?
```

> the toast function itself is written to be resumable. just commenting that we get that for free because of mantine's upsert notification thing. mantine is not part of the framework, just using that as an example

---

## 3. UserAgent State on Server

You mentioned: "the server actually does have its own userAgent state, but that's essentially the same as server state, but it's not removed by the compiler, and generally not accessed in any meaningful way on the server"

**Question 3a:** Should we document this edge case or hide it?

```typescript
// Should this be allowed?
await springboard.runOn('server', async () => {
  const userAgentState = await moduleAPI.userAgent.createUserAgentStates({
    something: 'value'
  });

  // What storage does this use on server?
  // Is it useful for anything?
});
```

**Question 3b:** Should we warn against or prevent this pattern?

```typescript
// Option A: Allow silently (current behavior)

// Option B: Runtime warning
console.warn('UserAgent state on server is rarely needed. Consider using server state instead.');

// Option C: Compile-time error via ESLint
// Rule: springboard/no-useragent-state-on-server
```

> let's do it when the user agent state is *accessed*, not created. and give advice on how to run that check only in the client instead

---

## 4. Babel Transformer Implementation

You mentioned needing to support both esbuild and babel, referencing an existing babel config with comments.

**Question 4a:** Implementation order?

- Implement esbuild first, then port to babel?
- Implement babel first (since it exists)?
- Implement both simultaneously?

> implement esbuild first. we want to focus on the new API

**Question 4b:** Should they share test suites?

```typescript
// Shared test cases
const testCases = [
  {
    input: 'moduleAPI.server.createServerStates({...})',
    expectedOutput: '/* removed */',
  },
  // ... more cases
];

// Run against both transformers
describe('esbuild plugin', () => {
  testCases.forEach(testCase => {
    it(testCase.input, () => {
      expect(esbuildTransform(testCase.input)).toBe(testCase.expectedOutput);
    });
  });
});

describe('babel plugin', () => {
  testCases.forEach(testCase => {
    it(testCase.input, () => {
      expect(babelTransform(testCase.input)).toBe(testCase.expectedOutput);
    });
  });
});
```

> yeah that sounds good

**Question 4c:** The existing babel config at `/Users/mickmister/code/songdrive-workspaces/ffmpeg-songdrive/apps/mobile/babel.config.js` already has the comments thing. Should we:
- Extend that plugin?
- Create a new plugin?
- Merge functionality?

> extend it and add the new stuff. probably want to share some things since the esbuild one is using babel for part of it too. maybe we could have one implementation, unless if babel is not efficient for the parts we're not using babel for

---

## 5. State Versioning Implementation

You want smooth transition between versioned and non-versioned state:

```typescript
// Non-versioned
const state = await moduleAPI.shared.createSharedStates({
  myState: {message: null}
});

// Later, add version
const state = await moduleAPI.shared.createSharedStates({
  myState: {value: {message: null}, version: 3}
});
```

**Question 5a:** When version is added for the first time, what version was the old data?

```typescript
// Day 1: No version
myState: {message: 'hello'}

// Day 2: Add version, what happens?
myState: {value: {message: null}, version: 2, migrate: async (current) => {
  // What is current.version here?
  // Was the old data implicitly version 1? Or version 0? Or undefined?
}}
```

> the version is null to begin with. any defined version is greater than that version

**Question 5b:** Should we enforce `migrate` when version is provided?

```typescript
// Option A: Required
myState: {
  value: initialValue,
  version: 2,
  migrate: async (current) => { /* REQUIRED */ }
}

// Option B: Optional (but warn in JSDoc)
myState: {
  value: initialValue,
  version: 2,
  // migrate is optional, but if you have multiple versions, you should provide it
}
```

> yes enforce migrate

**Question 5c:** Database schema for version tracking

You said "it's its own row in the existing kvstore behind the scenes." Should version be:

```typescript
// Option A: Suffix on key
key: 'prefix|state|myState'
value: {message: 'hello'}
key: 'prefix|state|myState|__version'
value: 3

// Option B: Metadata column
key: 'prefix|state|myState'
value: {message: 'hello'}
metadata: {version: 3}

// Option C: Separate table
// kvstore table: stores values
// kvstore_versions table: stores versions
```

> metadata sounds good

---

## 6. Record States Database Schema

You mentioned making "a record based kvstore table that has ids and uses a key just like this kvstore table."

**Question 6a:** Separate table or same table?

```typescript
// Option A: Separate table
// kvstore: regular states
// kvstore_records: record states (with id column)

// Option B: Same table with flag
// kvstore: { key, value, is_record, record_id }

// Option C: Same table, different key pattern
// kvstore:
//   - key='prefix|state|users' -> full array
//   - key='prefix|state|users|record|123' -> individual record
```

> let's do a new table for conventional separation and to add the id column

**Question 6b:** Sync behavior for record states

```typescript
// When record is updated, should we:

// Option A: Sync entire collection every time
users.update('123', {name: 'New name'});
// -> Broadcasts: {type: 'recordState', key: 'users', value: allUsers}

// Option B: Sync individual record
users.update('123', {name: 'New name'});
// -> Broadcasts: {type: 'recordUpdate', key: 'users', recordId: '123', value: updatedUser}

// Option C: Batch sync
users.update('123', {name: 'New name'});
users.update('456', {name: 'Another'});
// -> Broadcasts once: {type: 'recordUpdates', key: 'users', updates: [{id: '123', ...}, {id: '456', ...}]}
```

> sync individual record

**Question 6c:** Performance for large collections

```typescript
const users = await moduleAPI.shared.createSharedRecordStates({
  users: {initialRecords: []}  // Could grow to 10,000+ records
});

// Should we:
// Option A: Load all records into memory (current pattern for states)
// Option B: Lazy load records on demand
// Option C: Pagination/windowing support
// Option D: Warn if collection exceeds threshold
```

> we'll address that when we need to
> maybe we can have a `avoidPreload: boolean` to avoid loading all of them

---

## 7. Platform-Specific Code Edge Cases

For the nullish coalescing pattern you called "nuts":

```typescript
const deps = await springboard.runOn('node', async () => {
  return {midi: await import('midi-service')};
}) ?? await springboard.runOn('browser', async () => {
  return {audio: await import('web-audio')};
});
```

**Question 7a:** What should this compile to?

```typescript
// In node build:
const deps = await (async () => {
  return {midi: await import('midi-service')};
})();
// The browser part is removed entirely

// In browser build:
const deps = await (async () => {
  return {audio: await import('web-audio')};
})();
// The node part is removed entirely

// But what about the ?? operator? Should we:
// Option A: Remove the whole ?? chain, just keep the matching branch
// Option B: Keep structure but replace non-matching with undefined
// Option C: Detect pattern and optimize
```

> I think we should just remove the function body of the callback for non-matching platforms during compile time, and then just return `null` at runtime
> we should document the matrix of `runOn` in the docs

**Question 7b:** Should we support complex boolean logic?

```typescript
// Should these work?
const a = springboard.runOn('node', () => 1) || springboard.runOn('browser', () => 2);
const b = springboard.runOn('node', () => 1) && springboard.runOn('browser', () => 2);
const c = springboard.runOn('node', () => 1) ? 'yes' : 'no';

// Or only simple patterns?
```

> that should already work with my idea above

---

## 8. ESLint Rule: Platform Awareness

For the rule that respects `@platform` comments and `springboard.runOn()`:

**Question 8a:** Should the rule understand both old and new syntax?

```typescript
// Old syntax (comments)
// @platform "node"
const midi = require('midi');
// @platform end

// New syntax (runOn)
const midi = springboard.runOn('node', () => require('midi'));

// Should ESLint handle both? Or migrate to new syntax?
```

> hopefully both yeah

**Question 8b:** What about nested platform blocks?

```typescript
springboard.runOn('server', () => {
  springboard.runOn('node', () => {
    // Only on server + node (not cf-workers)
  });
});

// Should this be:
// Option A: Allowed (AND logic)
// Option B: Disallowed (confusing)
// Option C: Warning (use isPlatform instead)
```

> idk let's table the eslint stuff for now

---

## 9. Migration Path - Practical Questions

**Question 9a:** Should we provide a codemod for migrating existing code?

```typescript
// Transform:
moduleAPI.createSharedStates({...})
// Into:
moduleAPI.shared.createSharedStates({...})

// Automatically via:
npx springboard migrate-api
```

**Question 9b:** Staging the rollout

Since this is a breaking change, should we:
- Phase 1: Release new API alongside old (both work)
- Phase 2: Deprecate old API (warnings)
- Phase 3: Remove old API

Or just hard break immediately?

**Question 9c:** Version numbering

Should this be:
- Springboard v2.0.0 (major version bump)
- Springboard v1.x.0 with feature flag
- Springboard v1.x.0 with opt-in via config

> don't worry about breaking changes. we're still in experimental phase

---

## 10. Final Implementation Details

**Question 10a:** Should `Object.freeze()` be optional?

Some developers might want to mutate framework objects for testing or debugging.

```typescript
// Option A: Always freeze (strict)
// Option B: Freeze in production only
// Option C: Config option: { freezeFrameworkObjects: true }
```

> freeze by default, and allow it to be disabled on init. we will eventually get to an isolated non-side-effect init process where this will be more secure. let's have a `springboard.configure({disableObjectFreeze?: boolean})` that is inherently insecure for now

**Question 10b:** Error message quality

For stripped server code accessed in browser:

```typescript
// Current plan:
serverStates.apiKey.getState()
// Error: Cannot access server state "apiKey" from client build.

// Should we also:
// - Show stack trace to where it was defined?
// - Link to docs?
// - Show what alternatives exist?
Error: Cannot access server state "apiKey" from client build.

Server states are only accessible server-side for security.

Did you mean to:
  • Use shared state: moduleAPI.shared.createSharedStates()
  • Call from server action: moduleAPI.server.createServerActions()

Docs: https://docs.springboard.dev/server-states
```

> Looks good to me

---

## Summary

The main areas needing clarification:

1. **Platform detection** - ANY vs ALL logic, constants, compile vs runtime
2. **Client actions** - Timeout defaults, callback pattern, server-generated IDs, "resumable" meaning
3. **UserAgent on server** - Document, warn, or prevent?
4. **Babel transformer** - Order, test sharing, relation to existing plugin
5. **State versioning** - Initial version number, migration enforcement, database schema
6. **Record states** - Database design, sync strategy, performance limits
7. **Platform code edge cases** - Compilation strategy for complex expressions
8. **ESLint** - Support both syntaxes, nested blocks?
9. **Migration** - Codemod, staging, versioning?
10. **Polish** - Optional freezing, error message quality

Let me know which of these you want to discuss, or if you're ready to move forward with implementation!
