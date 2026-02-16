# sb docs vs svelte-mcp Command Comparison

## What svelte-mcp Has (MCP Tools)

| Tool | Purpose | Status in sb docs |
|------|---------|-------------------|
| `list-sections` | List docs with use_cases | ✅ `sb docs list` |
| `get-documentation` | Fetch specific docs | ✅ `sb docs get` |
| `svelte-autofixer` | Validate component code | ✅ `sb docs validate` |
| `playground-link` | Generate svelte.dev playground URL | ❌ Not implemented |
| **Prompt: `svelte-task`** | Pre-load context + workflow | ✅ `sb docs context` |

## What sb docs Has (CLI Commands)

| Command | Purpose | Status in svelte-mcp |
|---------|---------|---------------------|
| `sb docs list` | List docs with use_cases | ✅ `list-sections` tool |
| `sb docs get` | Fetch specific docs | ✅ `get-documentation` tool |
| `sb docs validate` | Validate module code | ✅ `svelte-autofixer` tool |
| `sb docs context` | Full context prompt | ✅ `svelte-task` prompt |
| `sb docs types` | Output TypeScript types | ❌ Not in svelte-mcp |
| `sb docs scaffold` | Generate templates | ❌ Not in svelte-mcp |
| `sb docs --help` | Onboarding/workflow | ❌ Not in svelte-mcp (implicit in prompts) |

## Key Differences

### 1. Delivery Mechanism
- **svelte-mcp**: MCP protocol (tools + prompts)
- **sb docs**: CLI commands (shell execution)

### 2. Scaffold/Templates
- **svelte-mcp**: No scaffolding - uses `playground-link` to share code
- **sb docs**: Has `scaffold` subcommands (diverges from svelte-mcp)

### 3. Type Definitions
- **svelte-mcp**: No dedicated types command
- **sb docs**: `types` command to output ModuleAPI, StateSupervisor, etc.

### 4. Onboarding
- **svelte-mcp**: Implicit in prompts (agents get workflow via `svelte-task` prompt)
- **sb docs**: Explicit via `--help` text + CLAUDE.md/AGENTS.md files

### 5. Playground/Examples
- **svelte-mcp**: `playground-link` generates URLs to svelte.dev/playground
  - Compresses code with gzip + base64
  - Embeds in MCP UI resources
  - Requires `App.svelte` entry point
- **sb docs**: ❌ Not implemented yet

## Missing from sb docs

1. **Playground/Examples System** ❌
   - svelte-mcp has `playground-link` tool
   - We should add example bundling in npm package

2. **Live Documentation Fetching** ❌
   - svelte-mcp fetches from svelte.dev at runtime
   - We need to decide: bundle in package or fetch from doks site

3. **Use Cases Metadata** ❌
   - svelte-mcp has pre-computed `use_cases.json`
   - We need to generate this from springboard docs

4. **Actual Implementation** ❌
   - All commands currently return "TODO"
   - Need to implement each command

## Recommendations

### Must Have (Match svelte-mcp)
1. ✅ Remove `scaffold` - doesn't match svelte-mcp pattern
2. ❌ Add examples system (bundled in npm package)
3. ❌ Implement `list` with use_cases metadata
4. ❌ Implement `get` to fetch/bundle docs
5. ❌ Implement `validate` with AST visitors
6. ❌ Implement `context` with pre-loaded docs list

### Optional (Extensions)
- Keep `types` command (useful, not in svelte-mcp)
- Keep `scaffold` if valuable for Springboard (diverges)

### Architecture Decisions Needed
1. **Docs source**: Bundle in package or fetch at runtime?
2. **Examples**: In-package files or external URLs?
3. **Scaffold**: Remove or keep as Springboard-specific feature?
