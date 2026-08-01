# State Management

Springboard provides three types of state, each with different persistence and sync behavior.

## State Types Comparison

| Type | Persistence | Sync | Use Case |
|------|-------------|------|----------|
| SharedState | In-memory (server cache) | Real-time cross-device | Temporary shared data, UI sync |
| PersistentState | Database | Cross-device on load | User data, settings, saved state |
| UserAgentState | localStorage | None (device-local) | UI preferences, local settings |

## createSharedState

```typescript
const counter = await moduleAPI.statesAPI.createSharedState('counter', 0);
```

**Behavior:**
- Cached on server
- Broadcasts changes to all connected devices instantly
- Lost on server restart (unless persisted separately)
- Use for: cursor positions, typing indicators, live collaboration

**Example:**
```typescript
const presenceState = await moduleAPI.statesAPI.createSharedState('presence', {
  users: [] as { id: string; cursor: { x: number; y: number } }[]
});

// Update broadcasts to all devices
presenceState.setStateImmer(draft => {
  const user = draft.users.find(u => u.id === myId);
  if (user) user.cursor = { x, y };
});
```

## createPersistentState

```typescript
const settings = await moduleAPI.statesAPI.createPersistentState('settings', {
  theme: 'light',
  language: 'en'
});
```

**Behavior:**
- Stored in database (server-side)
- Loaded on app start
- Synced across devices
- Survives restarts
- Use for: user preferences, saved documents, game state

**Example:**
```typescript
const todoList = await moduleAPI.statesAPI.createPersistentState('todos', {
  items: [] as Todo[]
});

// Changes persist to database
todoList.setStateImmer(draft => {
  draft.items.push({ id: uuid(), text: 'New todo', done: false });
});
```

## createUserAgentState

```typescript
const uiState = await moduleAPI.statesAPI.createUserAgentState('ui', {
  sidebarOpen: true,
  lastViewedTab: 'home'
});
```

**Behavior:**
- Stored in localStorage (browser) or local file (node)
- Never synced to server or other devices
- Device-specific
- Use for: collapsed panels, scroll positions, local drafts

**Example:**
```typescript
const localPrefs = await moduleAPI.statesAPI.createUserAgentState('localPrefs', {
  volume: 0.8,
  recentSearches: [] as string[]
});

// Only affects this device
localPrefs.setStateImmer(draft => {
  draft.recentSearches.unshift(query);
  draft.recentSearches = draft.recentSearches.slice(0, 10);
});
```

## StateSupervisor API

All state types return a `StateSupervisor<T>`:

```typescript
// Get current value
const value = state.getState();

// Set new value (immutable)
state.setState(newValue);
state.setState(prev => ({ ...prev, count: prev.count + 1 }));

// Mutate with Immer (mutable syntax, immutable result)
state.setStateImmer(draft => {
  draft.count += 1;
  draft.items.push(newItem);
});

// React hook (auto-subscribes component)
function MyComponent() {
  const value = state.useState();
  return <div>{value.count}</div>;
}

// RxJS Subject for manual subscriptions
const subscription = state.subject.subscribe(newValue => {
  console.log('State changed:', newValue);
});

// Cleanup in onDestroy
moduleAPI.onDestroy(() => subscription.unsubscribe());
```

## Choosing the Right State Type

**Use SharedState when:**
- Changes need immediate sync (< 100ms)
- Data is ephemeral (OK to lose on restart)
- Examples: cursor positions, typing status, live reactions

**Use PersistentState when:**
- Data must survive restarts
- Changes should sync but don't need instant delivery
- Examples: documents, settings, user profiles

**Use UserAgentState when:**
- Data is device-specific
- No need to sync across devices
- Examples: UI state, local preferences, cached data
