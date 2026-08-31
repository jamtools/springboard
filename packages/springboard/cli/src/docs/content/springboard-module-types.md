# Module Types

Springboard has three module types, each with a specific purpose.

## Feature Module

**Purpose:** Implements user-facing features with UI.

**Characteristics:**
- Registers routes
- Has visual components
- May use other modules
- Most common type

**Example:**
```typescript
springboard.registerModule('TodoList', {}, async (moduleAPI) => {
  const todosState = await moduleAPI.statesAPI.createPersistentState('todos', []);

  const actions = moduleAPI.createActions({
    addTodo: async (args: { text: string }) => {
      todosState.setStateImmer(draft => {
        draft.push({ id: Date.now(), text: args.text, done: false });
      });
    },
    toggleTodo: async (args: { id: number }) => {
      todosState.setStateImmer(draft => {
        const todo = draft.find(t => t.id === args.id);
        if (todo) todo.done = !todo.done;
      });
    }
  });

  moduleAPI.registerRoute('/', {}, () => {
    const todos = todosState.useState();
    return (
      <div>
        <h1>Todos</h1>
        {todos.map(todo => (
          <div key={todo.id} onClick={() => actions.toggleTodo({ id: todo.id })}>
            {todo.done ? '✓' : '○'} {todo.text}
          </div>
        ))}
      </div>
    );
  });

  return { state: todosState, actions };
});
```

## Utility Module

**Purpose:** Provides shared functionality for other modules.

**Characteristics:**
- No routes or UI
- Exports APIs for other modules
- Uses interface merging for type-safety
- Examples: auth, notifications, analytics

**Example:**
```typescript
springboard.registerModule('notifications', {}, async (moduleAPI) => {
  const notificationsState = await moduleAPI.statesAPI.createSharedState('notifications', [] as Notification[]);

  const actions = moduleAPI.createActions({
    show: async (args: { message: string; type: 'info' | 'error' | 'success' }) => {
      const id = Date.now();
      notificationsState.setStateImmer(draft => {
        draft.push({ id, ...args });
      });

      // Auto-dismiss after 5s
      setTimeout(() => {
        notificationsState.setStateImmer(draft => {
          const idx = draft.findIndex(n => n.id === id);
          if (idx >= 0) draft.splice(idx, 1);
        });
      }, 5000);
    },

    dismiss: async (args: { id: number }) => {
      notificationsState.setStateImmer(draft => {
        const idx = draft.findIndex(n => n.id === args.id);
        if (idx >= 0) draft.splice(idx, 1);
      });
    }
  });

  // Expose for other modules
  return { state: notificationsState, actions };
});

// Type declaration for getModule
declare module 'springboard/module_registry/module_registry' {
  interface AllModules {
    notifications: {
      state: StateSupervisor<Notification[]>;
      actions: {
        show: (args: { message: string; type: 'info' | 'error' | 'success' }) => Promise<void>;
        dismiss: (args: { id: number }) => Promise<void>;
      };
    };
  }
}
```

**Using in another module:**
```typescript
springboard.registerModule('MyFeature', {}, async (moduleAPI) => {
  moduleAPI.registerRoute('/', {}, () => {
    const notifications = moduleAPI.getModule('notifications');

    const handleSave = async () => {
      try {
        await saveData();
        notifications.actions.show({ message: 'Saved!', type: 'success' });
      } catch (e) {
        notifications.actions.show({ message: 'Save failed', type: 'error' });
      }
    };

    return <button onClick={handleSave}>Save</button>;
  });
});
```

## Initializer Module

**Purpose:** Performs setup during app initialization.

**Characteristics:**
- Runs before other modules
- No UI or routes
- Platform-specific initialization
- Examples: theme setup, analytics init, feature flags

**Example:**
```typescript
springboard.registerModule('ThemeInitializer', {}, async (moduleAPI) => {
  const themeState = await moduleAPI.statesAPI.createUserAgentState('theme', {
    mode: 'light' as 'light' | 'dark'
  });

  // Apply theme on load
  const theme = themeState.getState();
  document.documentElement.setAttribute('data-theme', theme.mode);

  // Watch for changes
  themeState.subject.subscribe(({ mode }) => {
    document.documentElement.setAttribute('data-theme', mode);
  });

  return {
    state: themeState,
    setTheme: (mode: 'light' | 'dark') => {
      themeState.setState({ mode });
    }
  };
});
```

## When to Use Each Type

| Scenario | Module Type |
|----------|-------------|
| User-facing feature with pages | Feature |
| Shared service (auth, notifications) | Utility |
| App-wide setup (themes, analytics) | Initializer |
| API integration | Utility |
| Dashboard with routes | Feature |
| State shared across features | Utility |

## Module Organization Pattern

```
src/
  modules/
    features/
      todos/
        index.tsx         # Feature module
        components/       # UI components
      dashboard/
        index.tsx
    utilities/
      notifications/
        index.tsx         # Utility module
      auth/
        index.tsx
    initializers/
      theme.tsx           # Initializer module
      analytics.tsx
  index.tsx               # Register all modules
```
