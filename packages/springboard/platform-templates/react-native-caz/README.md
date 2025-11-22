# Springboard React Native Template

A CAZ template for creating React Native Springboard applications with Expo.

## Usage

### With CAZ CLI
```bash
npx caz @springboardjs/template-react-native my-app
```

### With Springboard CLI  
```bash
sb scaffold mobile --config springboard.json
```

## Configuration

The template accepts the following variables:

### Required
- `slug`: App slug (lowercase, no spaces) - used for Expo slug
- `title`: App display name - shown to users  
- `dot`: Bundle identifier in reverse domain format (e.g., `com.myorg.myapp`)
- `flat`: Flat identifier without dots (e.g., `myapp`) - used for package name
- `siteUrl`: Base URL for your Springboard web app

### Optional
- `springboardVersion`: Version of Springboard packages to use (default: `latest`)

## Example Configuration

```json
{
  "ids": {
    "slug": "my-app",
    "title": "My App", 
    "dot": "com.myorg.myapp",
    "flat": "myapp"
  },
  "siteUrl": "https://myapp.com",
  "springboardVersion": "latest"
}
```

## Features

- ✅ Generic React Native + Expo setup
- ✅ Springboard engine integration
- ✅ WebView component for hybrid apps
- ✅ EAS build configuration
- ✅ Configurable app identifiers
- ✅ TypeScript support
- ✅ Development and production build profiles
- ✅ **Code injection support** for custom packages
- ✅ **Zero-config CI builds** with `npm run ci:build`
- ✅ **Conditional dependency injection** (@acme/rn-main, @acme/rn-shared, etc.)

## Generated Structure

```
my-app/
├── App.tsx                 # Main app component
├── app.config.ts          # Expo configuration  
├── eas.json              # EAS build configuration
├── package.json          # Dependencies and scripts
├── app/
│   └── entrypoints/
│       ├── rn_init_module.js   # Springboard entrypoint
│       └── rn_init_module.d.ts # TypeScript declarations
├── assets/               # App icons and assets
└── babel.config.js       # Babel configuration
```

## Code Injection System

The template supports **zero-config code injection** for custom business logic:

### File Copy Injection Points (Matching esbuild.ts)
- **`rn_init_module.js`**: Copies `dist/rn-main/neutral/dist/index.js` → `app/entrypoints/rn_init_module.js`
- **`rn_init_module.d.ts`**: Copies `packages/rn-main/springboard_entrypoint.d.ts` → `app/entrypoints/rn_init_module.d.ts`  
- **Dependencies**: Conditional inclusion of `@acme/*` packages
- **Providers**: Automatic wrapping with custom RN providers

### Post-Scaffold Workflow (Zero-Config)
1. Template generates with placeholder files
2. CLI builds your monorepo packages
3. CLI detects `.springboard.config.json`
4. Built files get copied to injection points (exactly like esbuild.ts:358-360)
5. `npm run post-scaffold` executes additional setup

### CI/CD Integration  
```bash
# Zero-config production builds
npm run ci:build          # Build both platforms
npm run ci:build-android  # Android only
npm run ci:build-ios      # iOS only
```

## Next Steps

### For Generic Apps
1. Install dependencies: `npm install`
2. Start development server: `npm run dev`  
3. Customize your Springboard modules in `app/entrypoints/rn_init_module.js`
4. Update app icons in `assets/` directory
5. Configure EAS project ID for builds

### For Organization-Specific Apps  
1. Use Springboard CLI: `sb scaffold mobile --config myapp.json`
2. CLI automatically injects your custom code
3. Ready for CI/CD with `npm run ci:build`