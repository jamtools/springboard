# Module Communication

Modules can access other modules' APIs using `getModule()` with type-safe interface merging.

## Basic Usage

```typescript
// In a route or action (NOT at module level)
const otherModule = moduleAPI.getModule('otherModuleId');
await otherModule.actions.doSomething();
```

## Interface Merging Pattern

For type-safe `getModule()`, declare your module's exports:

```typescript
// In auth module
springboard.registerModule('auth', {}, async (moduleAPI) => {
  const userState = await moduleAPI.statesAPI.createPersistentState('user', null as User | null);

  const actions = moduleAPI.createActions({
    login: async (args: { email: string; password: string }) => { /* ... */ },
    logout: async () => { /* ... */ }
  });

  return { userState, actions };
});

// Type declaration (usually at bottom of file or in types.ts)
declare module 'springboard/module_registry/module_registry' {
  interface AllModules {
    auth: {
      userState: StateSupervisor<User | null>;
      actions: {
        login: (args: { email: string; password: string }) => Promise<void>;
        logout: () => Promise<void>;
      };
    };
  }
}
```

Now in other modules:
```typescript
const auth = moduleAPI.getModule('auth');  // Type-safe!
const user = auth.userState.useState();    // TypeScript knows this is User | null
await auth.actions.login({ email, password });  // Autocomplete works
```

## Important: Where to Call getModule

### ❌ Wrong: At Module Level
```typescript
springboard.registerModule('MyModule', {}, async (moduleAPI) => {
  // DON'T DO THIS - module might not be registered yet
  const auth = moduleAPI.getModule('auth');

  // ...
});
```

### ✅ Correct: Inside Routes or Actions
```typescript
springboard.registerModule('MyModule', {}, async (moduleAPI) => {
  moduleAPI.registerRoute('/', {}, () => {
    // ✓ Safe - called after all modules registered
    const auth = moduleAPI.getModule('auth');
    const user = auth.userState.useState();

    return <div>Hello {user?.name}</div>;
  });

  const actions = moduleAPI.createActions({
    doSomething: async () => {
      // ✓ Safe - called at runtime
      const auth = moduleAPI.getModule('auth');
      const user = auth.userState.getState();
      // ...
    }
  });
});
```

## Optional Module Access

If a module might not be registered:

```typescript
const maybeModule = moduleAPI.getModule('optionalModule');

// Use optional chaining
maybeModule?.actions?.doSomething();

// Or check existence
if (maybeModule) {
  await maybeModule.actions.doSomething();
}
```

## Common Patterns

### Shared Notification System
```typescript
// In feature module
const handleError = (error: Error) => {
  const notifications = moduleAPI.getModule('notifications');
  notifications.actions.show({
    message: error.message,
    type: 'error'
  });
};
```

### Auth-Protected Actions
```typescript
const actions = moduleAPI.createActions({
  saveDocument: async (args: { content: string }) => {
    const auth = moduleAPI.getModule('auth');
    const user = auth.userState.getState();

    if (!user) {
      throw new Error('Must be logged in');
    }

    await saveToDatabase(user.id, args.content);
  }
});
```

### Cross-Module State Subscription
```typescript
springboard.registerModule('Dashboard', {}, async (moduleAPI) => {
  moduleAPI.registerRoute('/', {}, () => {
    const todos = moduleAPI.getModule('todos');
    const calendar = moduleAPI.getModule('calendar');

    // Subscribe to multiple modules' state
    const todoItems = todos.state.useState();
    const events = calendar.eventsState.useState();

    return (
      <div>
        <TodoWidget items={todoItems} />
        <CalendarWidget events={events} />
      </div>
    );
  });
});
```

## Module Dependencies

Modules are initialized in registration order. If module B depends on module A:

```typescript
// index.tsx - register in dependency order
import './modules/utilities/auth';        // First
import './modules/utilities/notifications';
import './modules/features/dashboard';    // Last (depends on above)
```

For circular dependencies, use lazy access via `getModule()` inside routes/actions.
