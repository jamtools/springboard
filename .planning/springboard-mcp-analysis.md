# Springboard `sb docs` CLI for AI Agents

This document analyzes the svelte-mcp patterns and adapts them into a `sb docs` subcommand that AI coding agents can use when building springboard applications.

## Why CLI Instead of MCP?

- **Simpler integration** - Any AI agent can run shell commands
- **No protocol overhead** - Direct stdin/stdout communication
- **Easier testing** - Run commands manually to verify behavior
- **Portable** - Works with any AI tool, not just MCP-compatible ones
- **Unified CLI** - Extends existing `sb` command rather than adding new tool

## Key Patterns from svelte-mcp (Adapted for CLI)

### 1. Command Structure

svelte-mcp exposes these via MCP tools - we expose them as `sb docs` subcommands:

```bash
# Documentation discovery
sb docs list                     # List available docs with use_cases
sb docs get <section...>         # Fetch specific documentation

# Code validation
sb docs validate <file>          # Validate a module file
sb docs validate --stdin         # Validate code from stdin

# Scaffolding
sb docs scaffold module <name>   # Generate module template
sb docs scaffold feature <name>  # Generate feature module
sb docs scaffold utility <name>  # Generate utility module

# Context for agents
sb docs context                  # Output full context prompt for AI agents
sb docs types                    # Output core TypeScript definitions
```

### 2. Use Cases as Keywords

Pre-generated metadata lets agents select docs without semantic search:

```json
{
  "springboard/module-development": "creating modules, registerModule, feature modules, utility modules, initializer modules...",
  "springboard/state-management": "shared state, persistent state, user agent state, createSharedState, useState...",
  "springboard/guides/registering-ui-routes": "routing, routes, registerRoute, hideApplicationShell, documentMeta..."
}
```

**CLI output format:**
```bash
$ sb docs list
springboard/module-development
  Use cases: creating modules, registerModule, feature modules, utility modules...

springboard/state-management
  Use cases: shared state, persistent state, user agent state, createSharedState...
```

### 3. Iterative Validator Pattern

```bash
$ sb docs validate src/modules/my-module.ts
{
  "issues": [
    "Line 15: Direct state mutation detected. Use state.setState() or state.setStateImmer()"
  ],
  "suggestions": [
    "Line 8: Consider adding onDestroy() cleanup for the subscription on line 12"
  ],
  "hasErrors": true
}
```

Agents can iterate:
```
Generate code → sb docs validate → Fix issues → sb docs validate → Until clean
```

### 4. Context Prompt

```bash
$ sb docs context
You are working on a Springboard application. Springboard is a full-stack
JavaScript framework built on React, Hono, JSON-RPC, and WebSockets.

Available documentation sections:
- springboard/module-development (creating modules, registerModule...)
- springboard/state-management (shared state, persistent state...)
- springboard/guides/registering-ui-routes (routing, routes...)
...

Workflow:
1. Use your knowledge of React and TypeScript first
2. Run `sb docs validate <file>` to check your code
3. Only fetch docs with `sb docs get <section>` when needed
4. For new modules, use `sb docs scaffold module <name>`

Key concepts:
- Modules are registered with `springboard.registerModule()`
- State types: shared (cross-device), persistent (DB), userAgent (local)
- Actions are automatically RPC-enabled
- Routes use React Router under the hood
```

---

## CLI Design

### Commands

| Command | Purpose | Output |
|---------|---------|--------|
| `sb docs list` | List docs with use_cases | Text or JSON (`--json`) |
| `sb docs get <section...>` | Fetch documentation | Markdown content |
| `sb docs validate <file>` | Validate module code | JSON `{issues, suggestions, hasErrors}` |
| `sb docs validate --stdin` | Validate from stdin | JSON `{issues, suggestions, hasErrors}` |
| `sb docs scaffold <type> <name>` | Generate templates | File path created |
| `sb docs context` | Full agent context | Text prompt |
| `sb docs types` | Core type definitions | TypeScript definitions |

### Output Formats

```bash
# Default: human-readable
$ sb docs list

# JSON for programmatic use
$ sb docs list --json

# Quiet mode (errors only)
$ sb docs validate src/module.ts --quiet
```

---

## Validator Patterns to Detect

| Pattern | Detection | Message |
|---------|-----------|---------|
| Direct state mutation | `state.value = x` | Use `state.setState()` or `state.setStateImmer()` |
| Missing module interface | registerModule without AllModules merge | Add interface merge for type-safe `getModule()` |
| Wrong state type | userAgent state for cross-device data | Use `createSharedState` or `createPersistentState` |
| Missing cleanup | Subscriptions without `onDestroy` | Add `moduleAPI.onDestroy()` callback |
| Route conflicts | Duplicate route paths | Make route paths unique |
| Sync getModule | getModule in synchronous code | Move to async initialization |
| Missing error handling | Actions without error handling | Use `coreDeps.showError()` |
| Platform directive issues | Unclosed @platform tags | Close `@platform` with `@platform end` |

### Validation Layers

1. **TypeScript** - Type errors via tsc
2. **Custom AST visitors** - Springboard-specific patterns
3. **ESLint** - React/TypeScript best practices

---

## Implementation Structure

Extends existing `sb` CLI in `/packages/springboard/cli/`:

```
packages/springboard/cli/
  src/
    commands/
      docs/                     # New `sb docs` subcommand
        index.ts                # Register docs subcommands
        list.ts
        get.ts
        validate.ts
        scaffold.ts
        context.ts
        types.ts
    validators/
      index.ts                  # Orchestrates validation layers
      visitors/
        state-mutation.ts
        missing-cleanup.ts
        route-conflicts.ts
        module-interface.ts
        platform-directives.ts
    docs-data/
      sections.json             # Doc metadata with use_cases
      content/                  # LLM-optimized doc content (or fetch from doks)
    templates/
      module.ts.template
      feature.ts.template
      utility.ts.template
```

### Key Dependencies to Add

```json
{
  "dependencies": {
    "@typescript-eslint/parser": "^7.0.0",
    "@typescript-eslint/typescript-estree": "^7.0.0"
  }
}
```

---

## Documentation Pipeline

### Source Files

- `/doks/content/docs/springboard/` - Core docs
- `/doks/content/docs/jamtools/` - Jamtools extension
- `/packages/springboard/cli/docs-out/CLI_DOCS_sb.md` - CLI reference

### LLM-Optimized Format

Convert markdown docs to condensed format:

```markdown
# State Management

## createSharedState(name, initialValue)
Creates state synchronized across all connected devices.
- Returns: StateSupervisor<T>
- Use when: multiplayer features, real-time collaboration

## createPersistentState(name, initialValue)
Creates state persisted to database.
- Returns: StateSupervisor<T>
- Use when: user preferences, saved data

## createUserAgentState(name, initialValue)
Creates state stored locally (localStorage).
- Returns: StateSupervisor<T>
- Use when: UI state, device-specific settings
```

### Use Cases Generation

Run Claude batch API on docs to generate `sections.json`:

```json
{
  "sections": [
    {
      "slug": "springboard/module-development",
      "title": "Module Development",
      "use_cases": "creating modules, registerModule, feature modules, utility modules, initializer modules, module lifecycle, module dependencies"
    }
  ]
}
```

---

## API Reference (for context command)

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
  createActions<T>(actions: T): Actions<T>

  // Routing
  registerRoute(path: string, options: RouteOptions, component: Component): void

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
  files: { saveFile(name: string, content: string): Promise<void> }
  storage: { remote: KVStore; userAgent: KVStore }
  rpc: { remote: Rpc; local?: Rpc }
  isMaestro: () => boolean
}
```

---

## Usage Examples

### Agent Workflow

```bash
# 1. Get context at start of session
sb docs context > /tmp/springboard-context.md

# 2. Find relevant docs for task
sb docs list | grep -i "state"

# 3. Fetch specific documentation
sb docs get springboard/state-management

# 4. Generate module scaffold
sb docs scaffold feature user-profile

# 5. Validate after writing code
sb docs validate src/modules/user-profile.ts

# 6. Fix issues and re-validate until clean
```

### Integration with AI Tools

**Claude Code CLAUDE.md:**
```markdown
## Springboard Development

When working on springboard modules:
1. Run `sb docs context` to understand the framework
2. Use `sb docs list` to find relevant docs
3. Validate code with `sb docs validate <file>` before finishing
4. Use `sb docs scaffold` for new modules
```

**Cursor rules:**
```
When creating springboard modules, always run `sb docs validate` on the file.
```

---

## Next Steps

1. **Add `docs` subcommand to `sb` CLI** - Extend `/packages/springboard/cli/`
2. **Implement `sb docs list`** - Parse doks content, generate use_cases
3. **Implement `sb docs get`** - Fetch doc content by section
4. **Implement `sb docs context`** - Output agent context prompt
5. **Implement `sb docs validate`** - TypeScript parsing + custom visitors
6. **Implement `sb docs scaffold`** - Module templates
7. **Generate use_cases.json** - Run Claude batch on docs for keyword metadata
