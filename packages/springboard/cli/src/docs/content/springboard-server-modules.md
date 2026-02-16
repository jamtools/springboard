# Server Modules

Server modules run on the Node.js server and can register HTTP routes and RPC middleware.

## Server Module Registration

```typescript
import { serverRegistry } from 'springboard-server';

serverRegistry.registerServerModule((serverAPI) => {
  const { hono, hooks, getEngine } = serverAPI;

  // Register HTTP routes
  hono.get('/api/health', (c) => c.json({ status: 'ok' }));

  // Register RPC middleware
  hooks.registerRpcMiddleware(async (c) => {
    const authHeader = c.req.header('Authorization');
    return { userId: extractUserId(authHeader) };
  });
});
```

## ServerModuleAPI

```typescript
type ServerModuleAPI = {
  hono: Hono;              // Hono web framework instance
  hooks: ServerHooks;       // Server lifecycle hooks
  getEngine: () => Springboard;  // Access Springboard engine
};
```

## Hono Routes

Server modules use [Hono](https://hono.dev) for HTTP routing:

```typescript
serverRegistry.registerServerModule(({ hono }) => {
  // GET request
  hono.get('/api/items', async (c) => {
    const items = await db.getItems();
    return c.json(items);
  });

  // POST request
  hono.post('/api/items', async (c) => {
    const body = await c.req.json();
    const item = await db.createItem(body);
    return c.json(item, 201);
  });

  // URL parameters
  hono.get('/api/items/:id', async (c) => {
    const { id } = c.req.param();
    const item = await db.getItem(id);
    if (!item) return c.json({ error: 'Not found' }, 404);
    return c.json(item);
  });

  // Query parameters
  hono.get('/api/search', async (c) => {
    const query = c.req.query('q');
    const results = await db.search(query);
    return c.json(results);
  });
});
```

## RPC Middleware

Middleware runs before each RPC call and can inject context:

```typescript
serverRegistry.registerServerModule(({ hooks }) => {
  hooks.registerRpcMiddleware(async (c) => {
    // Extract user from request
    const token = c.req.header('Authorization')?.replace('Bearer ', '');

    if (token) {
      const user = await verifyToken(token);
      return { user };  // Available in RPC handlers
    }

    return {};
  });
});
```

The returned object is merged into RPC context:

```typescript
// In a module action
const actions = moduleAPI.createActions({
  getUserData: async (args, options) => {
    // Access middleware context (implementation specific)
    const userId = options?.context?.user?.id;
    return await db.getUserData(userId);
  }
});
```

## Accessing Springboard Engine

```typescript
serverRegistry.registerServerModule(({ getEngine }) => {
  // Access the Springboard engine for state/modules
  const engine = getEngine();

  // Example: Background task using engine
  setInterval(async () => {
    // Access registered modules
    const registry = engine.getModuleRegistry();
    // ... perform background sync
  }, 60000);
});
```

## File Uploads

```typescript
serverRegistry.registerServerModule(({ hono }) => {
  hono.post('/api/upload', async (c) => {
    const formData = await c.req.formData();
    const file = formData.get('file') as File;

    const buffer = await file.arrayBuffer();
    const filename = `uploads/${Date.now()}-${file.name}`;

    await writeFile(filename, Buffer.from(buffer));

    return c.json({ path: filename });
  });
});
```

## Static Files

```typescript
import { serveStatic } from 'hono/serve-static';

serverRegistry.registerServerModule(({ hono }) => {
  // Serve static files from 'public' directory
  hono.use('/static/*', serveStatic({ root: './' }));
});
```

## CORS Configuration

```typescript
import { cors } from 'hono/cors';

serverRegistry.registerServerModule(({ hono }) => {
  hono.use('/api/*', cors({
    origin: ['https://myapp.com'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowHeaders: ['Content-Type', 'Authorization']
  }));
});
```

## Error Handling

```typescript
serverRegistry.registerServerModule(({ hono }) => {
  // Global error handler
  hono.onError((err, c) => {
    console.error('Server error:', err);
    return c.json({
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    }, 500);
  });

  // Route-specific try/catch
  hono.get('/api/risky', async (c) => {
    try {
      const result = await riskyOperation();
      return c.json(result);
    } catch (error) {
      return c.json({ error: error.message }, 400);
    }
  });
});
```

## Database Integration

```typescript
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';

const sqlite = new Database('data.db');
const db = drizzle(sqlite);

serverRegistry.registerServerModule(({ hono }) => {
  hono.get('/api/users', async (c) => {
    const users = await db.select().from(usersTable);
    return c.json(users);
  });
});
```

## Common Patterns

### Auth-Protected Routes
```typescript
const requireAuth = async (c, next) => {
  const token = c.req.header('Authorization');
  if (!token) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const user = await verifyToken(token);
    c.set('user', user);
    await next();
  } catch {
    return c.json({ error: 'Invalid token' }, 401);
  }
};

serverRegistry.registerServerModule(({ hono }) => {
  hono.use('/api/protected/*', requireAuth);

  hono.get('/api/protected/me', (c) => {
    const user = c.get('user');
    return c.json(user);
  });
});
```

### Rate Limiting
```typescript
import { rateLimiter } from 'hono-rate-limiter';

serverRegistry.registerServerModule(({ hono }) => {
  hono.use('/api/*', rateLimiter({
    windowMs: 60 * 1000,  // 1 minute
    limit: 100,           // 100 requests per window
  }));
});
```
