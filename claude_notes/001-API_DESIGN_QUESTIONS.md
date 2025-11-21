# ModuleAPI Redesign - Questions for Newcomers & Validation

## Background

We're considering restructuring the ModuleAPI from a flat structure to a namespaced structure to improve discoverability, readability, and make server-only code more obvious for build-time optimizations.

### Current API (Flat Structure)
```typescript
moduleAPI.createSharedStates({...})
moduleAPI.createServerStates({...})
moduleAPI.createUserAgentStates({...})
moduleAPI.createActions({...})
moduleAPI.createServerActions({...})
moduleAPI.registerRoute('/', {}, Component)
moduleAPI.registerApplicationShell(Shell)
moduleAPI.statesAPI.createSharedState('key', value)
```

### Proposed API (Namespaced Structure)
```typescript
// Server-only (stripped from client builds)
moduleAPI.server.createStates({...})
moduleAPI.server.createActions({...})

// Shared between clients and server (source of truth on server)
moduleAPI.shared.createStates({...})
moduleAPI.shared.createActions({...})

// User agent specific (stored on client, React Native process, etc.)
moduleAPI.userAgent.createStates({...})
moduleAPI.userAgent.createActions({...})

// UI-related
moduleAPI.ui.registerRoute('/', {}, Component)
moduleAPI.ui.registerApplicationShell(Shell)
moduleAPI.ui.registerReactProvider(Provider) // future
```

---

## Section 1: Conceptual Clarity

### Q1.1: Domain Understanding
When you see these three namespaces (`server`, `shared`, `userAgent`), do you immediately understand the distinction?
- What would you expect `server` to mean?
- What would you expect `shared` to mean?
- What would you expect `userAgent` to mean?
- Are there any overlaps or ambiguities?

> `server` means server-only
> `shared` means public and automatically sync'd with everyone connected
> `userAgent` means local to the user's device (not their auth'd account etc.). we may want to support state associated with the user's account and have a formal integration with `better-auth`

### Q1.2: State Lifecycle Mental Model
For each namespace, can you describe in your own words:
- **Server states**: Where they're stored, who can access them, when they sync (if at all)
- **Shared states**: Where they're stored, who can access them, when they sync
- **User agent states**: Where they're stored, who can access them, when they sync

> Server states do not sync. This is where things like user-provided API keys will go. Clients can never directly access these, unless requested via server action

> Shared states are stored on the server, and stored in-memory on the client, sync'd via websockets whenever state values change. Probably could be stored in the user agent storage as well, e.g. localStorage

> User agent states are stored in localStorage etc.

### Q1.3: Mobile App Context
In a mobile app context (React Native + WebView):
- Where would you expect `userAgent` states to be stored?
- If you call `moduleAPI.userAgent.createActions`, where would you expect the action to run?
- Does this match your intuition, or does it feel surprising?

> On the device
> On the device. If we wanted them to run in the same context, the dev should make a regular javascript function

---

## Section 2: Naming & Consistency

### Q2.1: Plural vs Singular Consistency
Should we use `createStates` everywhere or vary by namespace?

**Option A - Consistent plural:**
```typescript
moduleAPI.server.createStates({...})
moduleAPI.shared.createStates({...})
moduleAPI.userAgent.createStates({...})
```

**Option B - Namespace in method name:**
```typescript
moduleAPI.server.createServerStates({...})
moduleAPI.shared.createSharedStates({...})
moduleAPI.userAgent.createUserAgentStates({...})
```

**Option C - Mix (as currently proposed):**
```typescript
moduleAPI.server.createStates({...})
moduleAPI.shared.createStates({...}) // or createSharedStates?
moduleAPI.userAgent.createStates({...}) // or createUserAgentStates?
```

Which feels most natural? Which is least redundant while maintaining clarity?

> What do you think?
> I think we *must* have `createServerStates` and `createServerActions`

> Let's go option B

### Q2.2: Actions Naming
For actions that run locally vs remotely:

**Current proposal:**
```typescript
moduleAPI.shared.createActions({...})      // Can run local or remote
moduleAPI.userAgent.createActions({...})   // Runs on user agent (RN process for mobile)
moduleAPI.server.createActions({...})      // Always runs on server
```

Questions:
- Does `shared.createActions` clearly communicate that it can run locally OR remotely?
- Should there be a `local` vs `remote` distinction in the API itself?
- Is `userAgent.createActions` clear that it runs on the React Native process (not webview)?

### Q2.3: UI Namespace
Should UI-related methods be under `moduleAPI.ui.*` or remain at the top level?

**Option A - Namespaced:**
```typescript
moduleAPI.ui.registerRoute('/', {}, Component)
moduleAPI.ui.registerApplicationShell(Shell)
moduleAPI.ui.registerReactProvider(Provider)
```

**Option B - Top-level:**
```typescript
moduleAPI.registerRoute('/', {}, Component)
moduleAPI.registerApplicationShell(Shell)
moduleAPI.registerReactProvider(Provider)
```

Which feels more natural? Does `ui` add clarity or just verbosity?

> `ui` adds clarity

---

## Section 3: Developer Experience

### Q3.1: Discoverability
Imagine you're typing `moduleAPI.` and your IDE shows autocomplete:

**Current (Flat):**
```
createAction
createActions
createServerAction
createServerActions
createSharedStates
createServerStates
createUserAgentStates
registerRoute
registerApplicationShell
statesAPI
deps
```

**Proposed (Namespaced):**
```
deps
getModule
onDestroy
server
shared
userAgent
ui
```

Questions:
- Which is easier to navigate?
- Does the namespaced version make it easier or harder to discover functionality?
- When would you prefer the flat structure? When would you prefer namespaced?

> I like the nested one

### Q3.2: Common Use Cases
For the most common use case (creating shared states and actions), which feels better?

**Current:**
```typescript
const states = await moduleAPI.createSharedStates({
  board: initialBoard,
  winner: null
})

const actions = moduleAPI.createActions({
  clickedCell: async (args) => { /* ... */ }
})
```

**Proposed:**
```typescript
const states = await moduleAPI.shared.createStates({
  board: initialBoard,
  winner: null
})

const actions = moduleAPI.shared.createActions({
  clickedCell: async (args) => { /* ... */ }
})
```

Is the extra `.shared` worth the explicitness?

> Yeah I think it's worth it

### Q3.3: Learning Curve
As a newcomer:
- Would you find the namespaced structure easier or harder to learn?
- Does it help you build a mental model faster, or does it add cognitive overhead?
- Would you need to constantly refer to docs, or could you guess the API?

---

## Section 4: Build-Time Transformations

### Q4.1: Compiler Detection
The build system needs to detect and strip server-only code. Which is easier to reason about?

**Current approach:**
```typescript
// Compiler looks for: createServerState, createServerStates, createServerAction, createServerActions
const serverState = await moduleAPI.createServerStates({...})
const serverAction = moduleAPI.createServerActions({...})
```

**Proposed approach:**
```typescript
// Compiler looks for: moduleAPI.server.*
const serverState = await moduleAPI.server.createStates({...})
const serverAction = moduleAPI.server.createActions({...})
```

Questions:
- Which pattern is more intuitive for understanding "this code won't run in the browser"?
- Does seeing `moduleAPI.server.*` make it more obvious that code will be stripped?
- Is it valuable to have the server-only nature in the namespace vs the method name?

> I think only the method name matters on this aspect. Either work. Let's go with proposed approach

### Q4.2: Code Review & Auditing
When reviewing code for security (ensuring secrets don't leak to client):

**Current:**
```typescript
const apiKeys = await moduleAPI.statesAPI.createServerStates({
  stripeKey: 'sk_live_...',
  dbPassword: 'password123'
})
```

**Proposed:**
```typescript
const apiKeys = await moduleAPI.server.createStates({
  stripeKey: 'sk_live_...',
  dbPassword: 'password123'
})
```

Is `moduleAPI.server.*` a more obvious visual signal during code review?

> Yeah it's more obvious

---

## Section 5: Migration & Backwards Compatibility

### Q5.1: Migration Path
If we make this change, how should we handle migration?

**Option A - Hard break:**
- Remove old methods entirely
- Force everyone to migrate at once
- Clear documentation

**Option B - Deprecation period:**
- Keep old methods with deprecation warnings
- Gradual migration over several versions
- Both APIs work simultaneously

**Option C - Aliases:**
- Old methods become aliases to new ones
- Keep both forever for compatibility

Which would you prefer as a framework user?

> Hard break for this effort

### Q5.2: StatesAPI Exposure
Currently `moduleAPI.statesAPI` is exposed. In the new design:

**Option A - Remove it:**
```typescript
// No longer exposed
// moduleAPI.statesAPI.createSharedState(...) ❌
```

**Option B - Keep it as deprecated:**
```typescript
// Still works but deprecated
moduleAPI.statesAPI.createSharedState(...) // Shows warning
```

**Option C - Internal only:**
```typescript
// Available but documented as internal API
moduleAPI._internal.statesAPI // or similar
```

Should `statesAPI` remain exposed at all?

> I think `_internal` is fine, and I think `_internal.deps` makes sense too

---

## Section 6: Future Extensibility

### Q6.1: Plugin System
If modules/plugins want to extend ModuleAPI with their own namespaces:

```typescript
// Imagine a plugin adds:
moduleAPI.database.query(...)
moduleAPI.auth.login(...)
moduleAPI.payments.createCheckout(...)
```

Does the namespaced approach make this extension pattern clearer and more maintainable?

> I think `getModule` is better. Not sure how I feel about editing moduleAPI. In fact I think we should `Object.freeze` most things set up by the framework

### Q6.2: Platform-Specific APIs
In the future, we might have platform-specific methods:

```typescript
moduleAPI.platform.desktop.createTrayIcon(...)
moduleAPI.platform.mobile.requestPermission(...)
moduleAPI.platform.web.registerServiceWorker(...)
```

Does this nested namespace pattern feel natural or too deep?

> No let's not do this. Seems like too much to maintain, and is not the goal of the framework to make opinionated APIs to things like this

---

## Section 7: Documentation & Communication

### Q7.1: Tutorial Flow
For the quickstart tutorial, which is easier to explain to a newcomer?

**Current approach:**
> "To create state that syncs across devices, use `moduleAPI.createSharedStates()`. For server-only state, use `moduleAPI.createServerStates()`."

**Proposed approach:**
> "State is organized by where it lives: `moduleAPI.server.*` for server-only, `moduleAPI.shared.*` for synced state, `moduleAPI.userAgent.*` for client-only."

Which mental model is easier to teach?

### Q7.2: Error Messages
When someone uses the wrong API, which error is more helpful?

**Current:**
```
Error: Cannot call createServerStates() from client.
Did you mean createSharedStates()?
```

**Proposed:**
```
Error: moduleAPI.server is not available in client builds.
Use moduleAPI.shared or moduleAPI.userAgent instead.
```

### Q7.3: Documentation Structure
How would you organize the docs?

**Option A - By namespace:**
- Server API (`moduleAPI.server.*`)
- Shared API (`moduleAPI.shared.*`)
- UserAgent API (`moduleAPI.userAgent.*`)
- UI API (`moduleAPI.ui.*`)

**Option B - By functionality:**
- State Management
- Actions
- UI Registration
- Dependencies

**Option C - By use case:**
- Creating multiplayer state
- Server-side logic
- Client-side storage
- Routing

> Option A used to be autogenerated by typedoc. let's bring that back. look at commit e455efe4e416c54fdee0146e893be2b7aa1bf1e2 to see what changed

---

## Section 8: Edge Cases & Gotchas

### Q8.1: Hybrid Actions
What if an action needs to run on both server and client at different times?

```typescript
// Does this make sense?
moduleAPI.shared.createActions({
  saveData: async (data, options) => {
    // Sometimes called with { mode: 'local' }
    // Sometimes called with { mode: 'remote' }
  }
})
```

Should this be in `shared`, or should there be explicit `local` and `remote` namespaces?

> I think shared makes sense. I don't necessarily "like" it but it's the best I've come up with

### Q8.2: State Access Patterns
If I create a server state, should I be able to reference it from client code?

```typescript
// On server
const serverState = await moduleAPI.server.createStates({
  secret: 'my-secret-key'
})

// Later in client code - should this work?
const value = serverState.getState() // ❌ Compile error? Runtime error? Return null?
```

What's the expected behavior?

> Definitely some sort of error. We could have a stub client-side and throw an error on access. Right now we remove it entirely since the client has no business of it existing. Let's go stub&error route

### Q8.3: TypeScript Inference
Should TypeScript prevent you from using server APIs in client code?

```typescript
if (isServer) {
  // TypeScript error: "moduleAPI.server" is not available in client builds
  const state = await moduleAPI.server.createStates({...})
}
```

Would this be helpful or annoying?

> Typescript can't help here because every file in the framework is assumed to be isomorphic

---

## Section 9: Comparison with Other Frameworks

### Q9.1: Similar Patterns
Are there other frameworks with similar namespace patterns you've used?

Examples:
- Next.js: `use server` / `use client` directives
- tRPC: `t.procedure.*` namespacing
- Remix: `loader` / `action` separation

How does this proposal compare? What can we learn from them?

> Not super familiar with Remix's choices. I want to lean on react-query, and use the APIs I've suggested for functions and states

### Q9.2: Industry Conventions
Do you have strong opinions about where the "execution location" should be specified?

**Option A - Namespace:**
```typescript
moduleAPI.server.createStates({...})
```

**Option B - Method name:**
```typescript
moduleAPI.createServerStates({...})
```

**Option C - Directive/decorator:**
```typescript
'use server'
moduleAPI.createStates({...})
```

**Option D - Configuration:**
```typescript
moduleAPI.createStates({...}, { location: 'server' })
```

> I think Option A is the best. `server` stands out this way. Though I think it should be `moduleAPI.server.createServerActions`

---

## Section 10: Final Thoughts

### Q10.1: Overall Preference
After reading through this document, which API style do you prefer overall and why?

> Overall nested stuff

### Q10.2: Deal Breakers
Are there any aspects of the proposed design that would be deal breakers for you?

> Idk

### Q10.3: Biggest Win
What's the single biggest improvement this change would bring?

> Easy to navigate autocomplete and easier to read server-only things

### Q10.4: Biggest Risk
What's the single biggest risk or downside of making this change?

> Nothing

### Q10.5: Alternative Proposals
Do you have any alternative design ideas that might achieve the same goals better?

> Nope. Can you come up with something?

---

## Your Context

Please answer these questions while considering:
- You're a newcomer to Springboard framework
- You have experience with modern React/TypeScript
- You may or may not have experience with server/client state management
- You want an API that's discoverable, type-safe, and hard to misuse

---

## Next Steps

Based on feedback to these questions, we'll:
1. Refine the API design
2. Create migration guides
3. Update documentation
4. Implement the changes
5. Add comprehensive JSDoc comments

> No migration guides are necessary

> I also want to add "client actions" which is essentially a way for the server to call functions on the client. That's already happening in one case, and is how the shared state sync works /Users/mickmister/code/jamtools-worktrees/server-state-jamtools-worktree/packages/springboard/core/services/states/shared_state_service.ts:105
1:     private receiveRpcSetSharedState = async (args: SharedStateMessage) => {



> Should we have `createStates` or explicit `createSharedStates`? Brevity is nice, and redundancy of repeating `shared` in `moduleAPI.shared.createSharedStates` feels weird

> I also plan to have a `createRecordBasedState` which handles ids for updating objects etc.
