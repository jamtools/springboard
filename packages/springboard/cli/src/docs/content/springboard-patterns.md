# Common Patterns

Proven patterns from real Springboard applications.

## State Patterns

### Derived State with useMemo
Don't store computed values in state:

```typescript
// ❌ Wrong: Storing computed value
const [filteredItems, setFilteredItems] = useState([]);
useEffect(() => {
  setFilteredItems(items.filter(i => i.active));
}, [items]);

// ✅ Correct: Compute on render
function ItemList() {
  const items = itemsState.useState();
  const filter = filterState.useState();

  const filteredItems = useMemo(
    () => items.filter(i => i.active && i.name.includes(filter)),
    [items, filter]
  );

  return <List items={filteredItems} />;
}
```

### Optimistic Updates
Update UI immediately, then sync with server:

```typescript
const actions = moduleAPI.createActions({
  toggleLike: async (args: { postId: string }) => {
    // Optimistic update
    likesState.setStateImmer(draft => {
      draft[args.postId] = !draft[args.postId];
    });

    try {
      await api.toggleLike(args.postId);
    } catch (error) {
      // Rollback on failure
      likesState.setStateImmer(draft => {
        draft[args.postId] = !draft[args.postId];
      });
      throw error;
    }
  }
});
```

### State Selectors
Subscribe to specific parts of state:

```typescript
function UserName() {
  const user = userState.useState();
  // Re-renders on any user change

  return <span>{user.name}</span>;
}

// Better: Extract only what you need
function UserName() {
  const user = userState.useState();
  const name = useMemo(() => user.name, [user.name]);

  return <span>{name}</span>;
}
```

## Action Patterns

### Action Queuing
Prevent concurrent execution:

```typescript
let savePromise: Promise<void> | null = null;

const actions = moduleAPI.createActions({
  save: async (args: { data: Data }) => {
    // Wait for previous save
    if (savePromise) await savePromise;

    savePromise = (async () => {
      await api.save(args.data);
    })();

    await savePromise;
    savePromise = null;
  }
});
```

### Debounced Actions
Delay execution until activity stops:

```typescript
let debounceTimer: NodeJS.Timeout;

const actions = moduleAPI.createActions({
  search: async (args: { query: string }) => {
    return new Promise((resolve) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        const results = await api.search(args.query);
        searchResults.setState(results);
        resolve(results);
      }, 300);
    });
  }
});
```

### Batch Updates
Group multiple state changes:

```typescript
const actions = moduleAPI.createActions({
  importData: async (args: { items: Item[] }) => {
    // Single state update instead of many
    itemsState.setStateImmer(draft => {
      for (const item of args.items) {
        draft.push(item);
      }
    });
  }
});
```

## Navigation Patterns

### Navigation with Reason
Track why navigation happened:

```typescript
type NavReason =
  | { type: 'user_click' }
  | { type: 'form_submit'; formId: string }
  | { type: 'auto_redirect' }
  | { type: 'deep_link' };

const navReasonState = await moduleAPI.statesAPI.createUserAgentState<NavReason | null>(
  'navReason',
  null
);

function navigateWithReason(path: string, reason: NavReason) {
  navReasonState.setState(reason);
  navigate(path);
}

// Usage
navigateWithReason('/dashboard', { type: 'user_click' });
```

### Breadcrumb Trail
Track navigation history:

```typescript
const breadcrumbState = await moduleAPI.statesAPI.createUserAgentState<string[]>(
  'breadcrumbs',
  []
);

function pushBreadcrumb(path: string) {
  breadcrumbState.setStateImmer(draft => {
    draft.push(path);
    if (draft.length > 10) draft.shift(); // Keep last 10
  });
}
```

## Module Communication Patterns

### Event Bus
Loose coupling between modules:

```typescript
// events module
type AppEvent =
  | { type: 'user:login'; userId: string }
  | { type: 'document:saved'; docId: string };

const eventBus = new Subject<AppEvent>();

springboard.registerModule('events', {}, async () => {
  return {
    emit: (event: AppEvent) => eventBus.next(event),
    subscribe: (handler: (event: AppEvent) => void) => eventBus.subscribe(handler)
  };
});

// In other module
const events = moduleAPI.getModule('events');
const sub = events.subscribe(event => {
  if (event.type === 'user:login') {
    // Handle login
  }
});
moduleAPI.onDestroy(() => sub.unsubscribe());
```

### Hook System
Let modules extend functionality:

```typescript
type Hook<T> = (value: T) => T | Promise<T>;

const hooks = new Map<string, Hook<any>[]>();

springboard.registerModule('hooks', {}, async () => {
  return {
    register: <T>(name: string, hook: Hook<T>) => {
      if (!hooks.has(name)) hooks.set(name, []);
      hooks.get(name)!.push(hook);
    },
    run: async <T>(name: string, value: T): Promise<T> => {
      const hookList = hooks.get(name) || [];
      let result = value;
      for (const hook of hookList) {
        result = await hook(result);
      }
      return result;
    }
  };
});

// Usage: before-save hook
hooks.register('document:before-save', async (doc) => {
  return { ...doc, updatedAt: Date.now() };
});
```

## Error Handling Patterns

### Global Error Boundary
```typescript
moduleAPI.registerRoute('/', {}, () => {
  return (
    <ErrorBoundary fallback={<ErrorPage />}>
      <App />
    </ErrorBoundary>
  );
});
```

### Action Error Wrapper
```typescript
function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  action: T,
  errorMessage: string
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await action(...args);
    } catch (error) {
      moduleAPI.deps.core.showError(errorMessage);
      throw error;
    }
  }) as T;
}

const actions = moduleAPI.createActions({
  save: withErrorHandling(
    async (args: { data: Data }) => await api.save(args.data),
    'Failed to save'
  )
});
```

## Loading State Pattern

```typescript
interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

const dataState = await moduleAPI.statesAPI.createSharedState<AsyncState<Data>>(
  'data',
  { data: null, loading: false, error: null }
);

const actions = moduleAPI.createActions({
  fetchData: async () => {
    dataState.setState({ data: null, loading: true, error: null });
    try {
      const data = await api.fetchData();
      dataState.setState({ data, loading: false, error: null });
    } catch (error) {
      dataState.setState({ data: null, loading: false, error: error.message });
    }
  }
});
```
