# CLI Integration Guide

This document explains how to integrate the React Native CAZ template with your Springboard CLI to replicate the functionality of `/workspaces/songdrive/build/esbuild.ts` but in a zero-config manner.

## CLI Integration Points

### 1. Template Generation
```typescript
// In react_native_project_generator.ts
import { execSync } from 'child_process';

export async function generateReactNativeProject(config: SpringboardConfig) {
  // Use CAZ to generate from template
  const templateName = '@springboardjs/template-react-native';
  const projectPath = `./apps/${config.ids.slug}-mobile`;
  
  await execSync(`npx caz ${templateName} ${projectPath}`, {
    input: JSON.stringify({
      ...config.ids,
      siteUrl: config.siteUrl,
      customRnMainPackage: '@acme/rn-main', // from your monorepo
      customRnSharedPackage: '@acme/rn-shared',
      customStorePackage: '@acme/store', 
      customFilesPackage: '@acme/files',
      injectCustomCode: true
    })
  });
}
```

### 2. Code Injection (Replicating esbuild.ts:358)
```typescript
export async function injectCustomCode(projectPath: string, monorepoRoot: string) {
  const configPath = path.join(projectPath, '.springboard.config.json');
  const springboardConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  
  // Copy built entrypoint (like esbuild.ts line 359)
  if (springboardConfig.injectionPoints?.entrypoint) {
    const sourcePath = path.join(monorepoRoot, springboardConfig.injectionPoints.entrypoint.sourceFile);
    const destPath = path.join(projectPath, springboardConfig.injectionPoints.entrypoint.file);
    await fs.copyFile(sourcePath, destPath);
  }
  
  // Copy TypeScript definitions (like esbuild.ts line 360)
  if (springboardConfig.injectionPoints?.entrypointTypes) {
    const sourcePath = path.join(monorepoRoot, springboardConfig.injectionPoints.entrypointTypes.sourceFile);
    const destPath = path.join(projectPath, springboardConfig.injectionPoints.entrypointTypes.file);
    await fs.copyFile(sourcePath, destPath);
  }
  
  // Run post-scaffold hooks
  await execSync('npm run post-scaffold', { cwd: projectPath });
}
```

### 3. Build Integration 
```typescript
export async function buildMobileApp(profile: 'development' | 'preview' | 'production') {
  const projectPath = './apps/mobile';
  
  switch (profile) {
    case 'development':
      await execSync('npm run dev', { cwd: projectPath });
      break;
    case 'preview':  
      await execSync('npm run build-android && npm run build-ios', { cwd: projectPath });
      break;
    case 'production':
      await execSync('npm run ci:build', { cwd: projectPath });
      break;
  }
}
```

## Example Workflow

### Scaffolding
```bash
# Your CLI command
sb scaffold mobile --config ./configs/songdrive.json

# Internally runs:
# 1. npx caz @springboardjs/template-react-native songdrive-mobile
# 2. Inject code from /workspaces/songdrive/platform-templates/react-native/app/entrypoints/rn_init_module.js
# 3. Add custom dependencies from @acme/* packages
# 4. Run post-scaffold setup
```

### Building 
```bash
# Zero-config CI builds
cd songdrive-mobile
npm run ci:build

# Or via CLI
sb build mobile --profile production
```

## Template Injection Points

The template provides these injection points:

1. **`app/entrypoints/rn_init_module.js`** - Between `INJECTION_POINT_START/END` markers
2. **`package.json`** - Custom dependencies via template variables
3. **`App.tsx`** - Conditional imports and providers
4. **`.springboard.config.json`** - Configuration for CLI detection

## Custom Code Sources

Your CLI should source custom code from:

- **Entrypoint**: `/workspaces/songdrive/platform-templates/react-native/app/entrypoints/rn_init_module.js`
- **Dependencies**: Automatically from `@acme/*` workspace packages  
- **Hooks**: From `@acme/rn-main/src/hooks/rn_main_init_hooks`

This replicates your `esbuild.ts` functionality but in a maintainable, zero-config way that works in CI/CD environments.