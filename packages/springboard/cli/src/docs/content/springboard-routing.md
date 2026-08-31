# Routing & Navigation

Springboard uses React Router under the hood. Routes are registered via `moduleAPI.registerRoute()`.

## Registering Routes

### Basic Route
```typescript
moduleAPI.registerRoute('/', {}, HomePage);
```

### Route with Parameters
```typescript
moduleAPI.registerRoute('items/:itemId', {}, ItemDetailPage);

function ItemDetailPage() {
  const { itemId } = useParams();
  return <div>Item: {itemId}</div>;
}
```

### Absolute vs Relative Paths

```typescript
// Absolute (starts with /)
moduleAPI.registerRoute('/admin', {}, AdminPage);
// → matches: /admin

// Relative (no leading /)
moduleAPI.registerRoute('settings', {}, SettingsPage);
// → matches: /modules/MyModule/settings

moduleAPI.registerRoute('', {}, ModuleHomePage);
// → matches: /modules/MyModule
```

## Route Options

### hideApplicationShell
```typescript
moduleAPI.registerRoute('/fullscreen', {
  hideApplicationShell: true
}, FullscreenPage);
```
Hides the app shell (navigation, sidebar, etc.) for this route. Use for:
- Presentation modes
- Embedded views
- Login pages

### documentMeta
```typescript
moduleAPI.registerRoute('/product/:id', {
  documentMeta: {
    title: 'Product Details',
    description: 'View product information',
    'og:type': 'product'
  }
}, ProductPage);
```

### Dynamic documentMeta
```typescript
moduleAPI.registerRoute('/product/:id', {
  documentMeta: async ({ params }) => {
    const product = await getProduct(params.id);
    return {
      title: product.name,
      description: product.description,
      'og:image': product.imageUrl
    };
  }
}, ProductPage);
```

## Application Shell

### Registering Custom Shell
```typescript
moduleAPI.registerApplicationShell(({ children, modules }) => (
  <div className="app-layout">
    <Sidebar modules={modules} />
    <main>{children}</main>
  </div>
));
```

The shell wraps all routes except those with `hideApplicationShell: true`.

## Navigation

### Programmatic Navigation
```typescript
import { useNavigate } from 'react-router';

function MyComponent() {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate('/modules/MyModule/items/123');
  };

  return <button onClick={handleClick}>Go to Item</button>;
}
```

### Navigation with Reason (Pattern from SongDrive)
```typescript
// Define navigation reasons for type-safety
type NavigationReason =
  | { reason: 'user_click' }
  | { reason: 'action_complete'; actionId: string }
  | { reason: 'auto_redirect' };

// Track why navigation happened
function navigateWithReason(path: string, reason: NavigationReason) {
  // Store reason for analytics/debugging
  sessionStorage.setItem('nav_reason', JSON.stringify(reason));
  navigate(path);
}
```

### Link Component
```typescript
import { Link } from 'react-router';

function Navigation() {
  return (
    <nav>
      <Link to="/">Home</Link>
      <Link to="/modules/MyModule/settings">Settings</Link>
    </nav>
  );
}
```

## Route Component Props

Route components receive a `navigate` prop:

```typescript
type RouteComponentProps = {
  navigate: (routeName: string) => void;
};

function MyPage({ navigate }: RouteComponentProps) {
  return (
    <button onClick={() => navigate('/home')}>
      Go Home
    </button>
  );
}
```

## Common Patterns

### Protected Routes
```typescript
function ProtectedPage() {
  const user = authState.useState();

  if (!user) {
    return <Navigate to="/login" />;
  }

  return <Dashboard user={user} />;
}
```

### Route Guards in Module
```typescript
springboard.registerModule('Admin', {}, async (moduleAPI) => {
  const authModule = moduleAPI.getModule('auth');

  moduleAPI.registerRoute('/admin', {}, () => {
    const user = authModule.userState.useState();

    if (!user?.isAdmin) {
      return <div>Access Denied</div>;
    }

    return <AdminDashboard />;
  });
});
```

### Nested Routes
```typescript
moduleAPI.registerRoute('dashboard', {}, DashboardLayout);
moduleAPI.registerRoute('dashboard/overview', {}, Overview);
moduleAPI.registerRoute('dashboard/settings', {}, Settings);
```
