# React Provider Ranking Example

## How Provider Ranking Works

Providers are stacked by **rank** (highest rank = outermost wrapper).

### Named Ranks
- `'top'` → rank **100** (outermost)
- default → rank **0** (normal)
- `'bottom'` → rank **-100** (innermost, closest to app)

### Example Code

```typescript
// Module A
moduleAPI.ui.registerReactProvider(ErrorBoundary, { rank: 'top' });
moduleAPI.ui.registerReactProvider(ThemeProvider);  // default rank 0

// Module B
moduleAPI.ui.registerReactProvider(AuthProvider);   // default rank 0
moduleAPI.ui.registerReactProvider(I18nProvider, { rank: 'bottom' });

// Module C
moduleAPI.ui.registerReactProvider(ToastProvider, { rank: 50 });
```

### Resulting Stack

```tsx
<ErrorBoundary>              {/* rank 100 (top) */}
  <ToastProvider>            {/* rank 50 */}
    <ThemeProvider>          {/* rank 0 - registered first */}
      <AuthProvider>         {/* rank 0 - registered second */}
        <I18nProvider>       {/* rank -100 (bottom) */}
          <YourApp />
        </I18nProvider>
      </AuthProvider>
    </ThemeProvider>
  </ToastProvider>
</ErrorBoundary>
```

### Ordering Rules

1. **Sort by rank** (descending): Higher rank = outer wrapper
2. **Within same rank**: Registration order (first registered = outer)
3. **Cross-module**: All modules' providers are pooled and sorted together

## Use Cases

### Top Rank (`rank: 'top'` = 100)
- **Error boundaries** - Must catch all errors
- **Global state providers** - Redux, Zustand store
- **Performance monitoring** - Sentry, logging

```typescript
moduleAPI.ui.registerReactProvider(ErrorBoundary, { rank: 'top' });
```

### Default Rank (0)
- **Most providers** - Theme, Auth, Router
- **No rank needed** - Order doesn't matter much

```typescript
moduleAPI.ui.registerReactProvider(ThemeProvider);  // implicit rank: 0
```

### Bottom Rank (`rank: 'bottom'` = -100)
- **Internationalization** - Needs theme colors
- **Feature flags** - Needs auth context
- **Things that depend on outer providers**

```typescript
moduleAPI.ui.registerReactProvider(I18nProvider, { rank: 'bottom' });
```

### Custom Ranks
Fine-tune when 'top'/'bottom' aren't enough:

```typescript
moduleAPI.ui.registerReactProvider(ToastProvider, { rank: 50 });    // Between top and default
moduleAPI.ui.registerReactProvider(ModalProvider, { rank: -50 });   // Between default and bottom
```

## Common Patterns

### Error Boundary at Top
```typescript
moduleAPI.ui.registerReactProvider(({ children }) => (
  <ErrorBoundary fallback={<ErrorPage />}>
    {children}
  </ErrorBoundary>
), { rank: 'top' });
```

### Theme in Middle
```typescript
moduleAPI.ui.registerReactProvider(({ children }) => (
  <MantineProvider theme={theme}>
    {children}
  </MantineProvider>
));  // Default rank: 0
```

### I18n at Bottom
```typescript
moduleAPI.ui.registerReactProvider(({ children }) => (
  <I18nextProvider i18n={i18n}>
    {children}
  </I18nextProvider>
), { rank: 'bottom' });
```

## Legacy Support

Old `Provider` property is treated as rank 0:

```typescript
// These are equivalent:
module.Provider = MyProvider;
moduleAPI.ui.registerReactProvider(MyProvider);  // rank: 0
```
