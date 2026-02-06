# Springboard MCP Server Analysis

This document analyzes the svelte-mcp architecture and patterns to guide the creation of a springboard-mcp server.

## Overview: svelte-mcp Architecture

The svelte-mcp server is a well-designed MCP server that helps AI coding agents work efficiently with Svelte by providing:

1. **Documentation discovery and retrieval** - Agents find relevant docs without fetching everything
2. **Code validation/autofixing** - Iterative code analysis catches errors before runtime
3. **Playground integration** - Shareable code previews
4. **Context-efficient workflow** - "Try knowledge first, validate, then fetch docs"

## Key Patterns from svelte-mcp

### 1. Tool Orchestration Pattern

```
list-sections → analyze use_cases → get-documentation
→ svelte-autofixer (iterative) → playground-link
```

**Why this matters:** Agents don't need to fetch all documentation upfront. They:
1. Get a lightweight list of what's available with use-case keywords
2. Selectively fetch only relevant sections
3. Validate code iteratively
4. Share results via playground links

### 2. Use Cases as Keywords

`svelte-mcp` pre-generates "use_cases" metadata for each doc section using Claude:

```json
{
  "docs/$state": "always, any svelte project, core reactivity, state management, counters...",
  "docs/logic-blocks": "conditional rendering, each loops, iteration, key blocks..."
}
```

This allows agents to make smart doc selection without semantic search or reading full docs.

### 3. Iterative Autofixer Pattern

```
Generate code → autofixer → Has issues? → Fix → autofixer again → Until clean
```

The `svelte-autofixer` tool returns:
- `issues[]` - Compilation/linting errors
- `suggestions[]` - Improvements (not errors)
- `require_another_tool_call_after_fixing` - Flag for iteration

**Three-layer validation:**
1. **Compilation** - Svelte compiler warnings/errors
2. **Custom visitors** - Domain-specific pattern detection via AST walking
3. **ESLint** - Standard linting rules

### 4. Prompt-Based Context Loading

The `svelte-task` prompt pre-loads:
- Full list of available documentation sections
- Instructions for using tools efficiently
- Workflow guidance ("try autofixer first, then docs")

This avoids repeated `list-sections` calls and guides agent behavior.

### 5. Multi-Transport Design

Same core server supports:
- **HTTP** (Vercel deployment) - Stateless
- **STDIO** (CLI) - Direct invocation via `npx @sveltejs/mcp`

---

## Springboard MCP Server Design

### Core Components to Build

#### 1. Documentation System

**Source files to expose:**
- `/doks/content/docs/springboard/` - Core springboard docs
- `/doks/content/docs/jamtools/` - Jamtools extension docs
- `/packages/springboard/cli/docs-out/CLI_DOCS_sb.md` - CLI reference

**Use cases to generate:**
```json
{
  "springboard/module-development": "creating modules, registerModule, feature modules, utility modules, initializer modules...",
  "springboard/state-management": "shared state, persistent state, user agent state, createSharedState, useState...",
  "springboard/guides/registering-ui-routes": "routing, routes, registerRoute, hideApplicationShell, documentMeta..."
}
```

#### 2. Autofixer / Validator Tool

**Springboard-specific patterns to detect:**

| Pattern | Detection | Suggestion |
|---------|-----------|------------|
| Direct state mutation | `state.value = x` outside setState | Use `state.setState()` or `state.setStateImmer()` |
| Missing module interface | registerModule without return type | Add interface merge to `AllModules` |
| Shared vs UserAgent state confusion | userAgent state used for cross-device data | Use `createSharedState` or `createPersistentState` |
| Missing cleanup | Subscriptions without `onDestroy` | Add `moduleAPI.onDestroy()` callback |
| Route conflicts | Duplicate route paths | Make route paths unique |
| getModule before ready | getModule in synchronous code | Move to async initialization |
| Missing error handling | Actions without try/catch | Use `coreDeps.showError()` |
| Platform directive issues | Mismatched @platform tags | Close @platform directives properly |

**Validation layers:**
1. **TypeScript compilation** - Type errors in module code
2. **Custom visitors** - Springboard-specific pattern detection
3. **ESLint** - Standard React/TypeScript rules

#### 3. Tools to Implement

| Tool | Purpose | Input | Output |
|------|---------|-------|--------|
| `list-sections` | Discover available docs | - | Section list with use_cases |
| `get-documentation` | Fetch doc content | Section name(s) | Markdown content |
| `springboard-validator` | Analyze module code | Code string, options | `{issues[], suggestions[], needsRerun}` |
| `scaffold-module` | Generate module template | Module type, name | Code template |
| `module-types` | Get TypeScript definitions | - | Core type definitions |

#### 4. Resources

| Resource | URI Pattern | Description |
|----------|-------------|-------------|
| `springboard-doc` | `springboard://{slug}.md` | Documentation sections |
| `module-api-reference` | `springboard://api/module-api` | ModuleAPI interface |
| `type-definitions` | `springboard://types/{type}` | Core TypeScript types |

#### 5. Prompts

**`springboard-task`** - Main context prompt:
```
You are working on a Springboard application. Springboard is a full-stack
JavaScript framework built on React, Hono, JSON-RPC, and WebSockets.

Available documentation sections:
{sections_list}

Workflow:
1. Use your knowledge of React and TypeScript first
2. Run `springboard-validator` to check your code
3. Only fetch documentation when validator issues reference unknown APIs
4. For new modules, use `scaffold-module` to start with correct structure

Key concepts:
- Modules are registered with `springboard.registerModule()`
- State: shared (cross-device), persistent (DB), userAgent (local)
- Actions are automatically RPC-enabled
- Routes use React Router under the hood
```

---

## Implementation Plan

### Phase 1: Core Server Setup

```
packages/
  springboard-mcp/
    src/
      mcp/
        index.ts              # McpServer initialization
        handlers/
          tools/
            list-sections.ts
            get-documentation.ts
            springboard-validator.ts
            scaffold-module.ts
          resources/
            doc-section.ts
          prompts/
            springboard-task.ts
      parse/
        parse.ts              # TypeScript/React AST parsing
      validators/
        visitors/             # Pattern detection visitors
          state-mutation.ts
          missing-cleanup.ts
          route-conflicts.ts
          module-interface.ts
      lib/
        schemas.ts            # Valibot schemas
      use_cases.json          # Pre-generated use cases
    package.json
```

### Phase 2: Validator Visitors

Key AST visitors to implement:

1. **`state-mutation.ts`** - Detect direct state mutations
2. **`missing-cleanup.ts`** - Find subscriptions without onDestroy
3. **`module-interface.ts`** - Check AllModules type merging
4. **`action-patterns.ts`** - Validate action definitions
5. **`route-patterns.ts`** - Check route registration
6. **`platform-directives.ts`** - Validate @platform tags

### Phase 3: Documentation Pipeline

1. Convert existing doks content to LLM-optimized format
2. Generate use_cases.json via Claude batch API
3. Implement documentation fetching (local files or hosted)

### Phase 4: Transport & Distribution

- STDIO transport for CLI usage
- HTTP transport for hosted deployment
- npm package: `@springboard/mcp`

---

## API Surface: ModuleAPI Reference

For the MCP server to be useful, it needs to understand and expose the ModuleAPI:

```typescript
interface ModuleAPI {
  // Lifecycle
  onDestroy(callback: () => void): void

  // State Management
  statesAPI: {
    createSharedState<T>(name: string, initial: T): StateSupervisor<T>
    createPersistentState<T>(name: string, initial: T): StateSupervisor<T>
    createUserAgentState<T>(name: string, initial: T): StateSupervisor<T>
  }

  // Actions
  createActions<T extends ActionDefinitions>(actions: T): Actions<T>

  // Routing
  registerRoute(
    path: string,
    options: { hideApplicationShell?: boolean, documentMeta?: DocumentMeta },
    component: React.ComponentType
  ): void

  // Module Interaction
  getModule<K extends keyof AllModules>(id: K): AllModules[K]

  // Core Dependencies
  coreDependencies: CoreDependencies
}

interface StateSupervisor<T> {
  getState(): T
  setState(newState: T): void
  setStateImmer(callback: (draft: T) => void): void
  useState(): T  // React hook
  subject: Subject<T>  // RxJS observable
}

interface CoreDependencies {
  log: (...args: any[]) => void
  showError: (error: string) => void
  files: { saveFile: (name: string, content: string) => Promise<void> }
  storage: {
    remote: KVStore
    userAgent: KVStore
  }
  rpc: {
    remote: Rpc
    local?: Rpc
  }
  isMaestro: () => boolean
}
```

---

## Key Differences from svelte-mcp

| Aspect | svelte-mcp | springboard-mcp |
|--------|------------|-----------------|
| Compilation | Svelte compiler | TypeScript + React |
| AST Parser | svelte-eslint-parser | TypeScript parser |
| Domain | Component framework | Full-stack app framework |
| State | Runes ($state, $derived) | StateSupervisor pattern |
| Focus | Component code validation | Module architecture validation |
| Playground | svelte.dev/playground | (future: stackblitz embed?) |

---

## Files to Reference in svelte-mcp

When implementing, refer to these key files:

| svelte-mcp File | Purpose |
|-----------------|---------|
| `packages/mcp-server/src/mcp/index.ts` | Server setup pattern |
| `packages/mcp-server/src/mcp/handlers/tools/svelte-autofixer.ts` | Validation tool structure |
| `packages/mcp-server/src/mcp/autofixers/visitors/` | Visitor pattern examples |
| `packages/mcp-server/src/parse/parse.ts` | Parser setup |
| `packages/mcp-server/src/use_cases.json` | Use cases format |
| `packages/mcp-server/src/mcp/handlers/prompts/svelte-task.ts` | Prompt structure |

---

## Next Steps

1. **Decide on hosting**: Fork svelte-mcp or build from scratch?
2. **Generate use_cases.json**: Run Claude batch on springboard docs
3. **Implement core validators**: Start with most common error patterns
4. **Set up documentation pipeline**: Local or hosted doc serving
5. **Create npm package**: `@springboard/mcp` or similar
