# Springboard `sb docs` Implementation Questionnaire

This document contains questions that need answers to implement each `sb docs` command. Please fill in the answers to guide implementation.

---

## General Architecture Questions

### Q1: Documentation Source Location

Where should the documentation content come from?

**Options:**
- [ ] A. Bundle markdown files directly in the CLI npm package (like examples)
- [ ] B. Read from `/doks/content/docs/` at runtime (requires doks to be present)
- [ ] C. Host documentation at a URL (e.g., `docs.springboard.dev/llms.txt`) and fetch at runtime
- [ ] D. Other: _______________

**Your Answer:**

---

### Q2: Documentation Format

What format should docs be in for AI consumption?

**Options:**
- [ ] A. Raw markdown files from doks (as-is)
- [ ] B. LLM-optimized condensed format (like svelte-mcp's `/llms.txt`)
- [ ] C. Both - raw for humans, condensed for `sb docs get`
- [ ] D. Other: _______________

**Your Answer:**

---

### Q3: Use Cases Metadata

svelte-mcp pre-generates "use_cases" keywords for each doc section using Claude Batch API. Should we do the same?

**Options:**
- [ ] A. Yes, generate `use_cases.json` via Claude Batch API
- [ ] B. Manually write use cases for each section
- [ ] C. Skip use cases, just use doc titles
- [ ] D. Use categories/tags instead of free-form keywords

**Your Answer:**

---

## Command-Specific Questions

---

## `sb docs list` Command

### Q4: What documentation sections should be listed?

Based on the doks content, I found these potential sections:

**Springboard Core:**
- [ ] `springboard/overview` - Framework introduction
- [ ] `springboard/module-development` - Module types (feature/utility/initializer)
- [ ] `springboard/state-management` - createSharedState, createPersistentState, createUserAgentState
- [ ] `springboard/actions` - createAction, createActions, RPC behavior
- [ ] `springboard/routing` - registerRoute, documentMeta, hideApplicationShell
- [ ] `springboard/lifecycle` - onDestroy, initialization order
- [ ] `springboard/module-communication` - getModule, interface merging
- [ ] `springboard/core-dependencies` - log, showError, files, storage, rpc, isMaestro
- [ ] `springboard/platforms` - browser, node, react-native, desktop, partykit
- [ ] `springboard/conditional-compilation` - @platform directives
- [ ] `springboard/server-modules` - serverRegistry, Hono routes, RPC middleware

**Guides:**
- [ ] `guides/registering-ui-routes` - Route registration patterns
- [ ] `guides/creating-feature-module` - Feature module walkthrough
- [ ] `guides/creating-utility-module` - Utility module walkthrough
- [ ] `guides/multi-module-apps` - Module dependencies and communication
- [ ] `guides/offline-first` - Offline mode patterns
- [ ] `guides/multi-workspace` - Workspace context patterns

**CLI:**
- [ ] `cli/commands` - sb dev, sb build, sb start
- [ ] `cli/plugins` - Plugin system

**JamTools (if applicable):**
- [ ] `jamtools/overview` - MIDI/IO extensions
- [ ] `jamtools/macros` - Macro system

**Which sections should be included?** (Check all that apply or add more)

**Your Answer:**

---

### Q5: Section Metadata Format

What metadata should each section have in `sb docs list`?

```
Option A (svelte-mcp style):
springboard/state-management
  Use cases: shared state, persistent state, user agent state, createSharedState, cross-device sync...

Option B (Category-based):
springboard/state-management
  Category: core
  Tags: state, sync, persistence

Option C (Minimal):
springboard/state-management - State management with createSharedState, createPersistentState, createUserAgentState
```

**Your Answer:**

---

## `sb docs get` Command

### Q6: Documentation Fetching Behavior

When `sb docs get springboard/state-management` is called:

**Options:**
- [ ] A. Output raw markdown file content
- [ ] B. Output condensed LLM-optimized version
- [ ] C. Output with examples included inline
- [ ] D. Other: _______________

**Your Answer:**

---

### Q7: Multiple Section Fetching

Should `sb docs get` support fetching multiple sections at once?

```bash
# Option A: Multiple arguments
sb docs get springboard/state-management springboard/actions

# Option B: Single section only
sb docs get springboard/state-management

# Option C: Category/tag based
sb docs get --category=core
```

**Your Answer:**

---

## `sb docs context` Command

### Q8: Context Prompt Content

What should `sb docs context` include?

**Options (check all that apply):**
- [ ] Framework overview (what is Springboard)
- [ ] Full list of available doc sections with use cases
- [ ] Key APIs summary (ModuleAPI methods)
- [ ] Common patterns and anti-patterns
- [ ] Workflow instructions (when to use each command)
- [ ] TypeScript type definitions
- [ ] Example code snippets
- [ ] Link to examples command

**Your Answer:**

---

### Q9: Context Length

How long should the context output be?

**Options:**
- [ ] A. Minimal (~500 tokens) - just workflow + doc list
- [ ] B. Medium (~2000 tokens) - workflow + doc list + key APIs
- [ ] C. Comprehensive (~5000 tokens) - everything including examples
- [ ] D. Configurable via flag (e.g., `--full`, `--minimal`)

**Your Answer:**

---

## `sb docs validate` Command

### Q10: Validation Scope

What should `sb docs validate` check for?

**From songdrive analysis, common patterns/issues:**

**Module Structure:**
- [ ] Module has return type matching AllModules interface declaration
- [ ] Module uses proper state creation methods
- [ ] Module registers cleanup via onDestroy when needed

**State Patterns:**
- [ ] Using setState/setStateImmer correctly (not direct mutation)
- [ ] Correct state type chosen (shared vs persistent vs userAgent)
- [ ] State namespacing follows conventions

**Actions:**
- [ ] Actions are async functions
- [ ] Actions properly handle errors
- [ ] Actions have proper TypeScript types

**Routing:**
- [ ] Routes don't conflict
- [ ] Routes have proper components

**Module Communication:**
- [ ] getModule called inside routes/actions (not at module level)
- [ ] Optional chaining used for potentially undefined modules

**Anti-patterns:**
- [ ] Computed values stored in state (should use useMemo)
- [ ] Race conditions in initialization

**Which checks should be implemented?** (Prioritize)

**Your Answer:**

---

### Q11: Validation Output Format

How should validation results be formatted?

**Options:**
- [ ] A. JSON only (for programmatic use)
- [ ] B. Human-readable by default, JSON with `--json` flag
- [ ] C. ESLint-style output (file:line:col message)

**Your Answer:**

---

### Q12: Validation Strictness

Should validation have severity levels?

```
Option A: Binary (issues = errors, suggestions = warnings)
{
  "issues": ["Line 15: getModule called at module level"],
  "suggestions": ["Line 8: Consider using setStateImmer for complex updates"],
  "hasErrors": true
}

Option B: Severity levels
{
  "errors": [...],
  "warnings": [...],
  "info": [...],
  "hasErrors": true
}
```

**Your Answer:**

---

## `sb docs types` Command

### Q13: Which Types to Output

What TypeScript definitions should `sb docs types` output?

**Options (check all that apply):**
- [ ] ModuleAPI interface
- [ ] StatesAPI interface
- [ ] StateSupervisor interface
- [ ] CoreDependencies interface
- [ ] ModuleDependencies interface
- [ ] RegisterRouteOptions type
- [ ] ActionCallOptions type
- [ ] KVStore interface
- [ ] Rpc interface
- [ ] AllModules declaration pattern
- [ ] ServerModuleAPI interface

**Your Answer:**

---

### Q14: Types Format

How should types be output?

**Options:**
- [ ] A. Single concatenated TypeScript file
- [ ] B. Structured with headers/comments explaining each type
- [ ] C. Just the interface definitions (no explanations)
- [ ] D. Interactive (show list, pick which to output)

**Your Answer:**

---

## `sb docs scaffold` Command

### Q15: Should Scaffold Remain?

svelte-mcp does NOT have scaffolding. Should we keep it?

**Options:**
- [ ] A. Remove scaffold - follow svelte-mcp pattern exactly
- [ ] B. Keep scaffold - useful for Springboard's module structure
- [ ] C. Replace with examples only - agents copy from examples
- [ ] D. Keep scaffold but simplify to one command

**Your Answer:**

---

### Q16: Scaffold Templates (if keeping)

If keeping scaffold, what templates should be available?

**Options (check all that apply):**
- [ ] `sb docs scaffold module <name>` - Basic module
- [ ] `sb docs scaffold feature <name>` - Feature module with routes
- [ ] `sb docs scaffold utility <name>` - Utility module with exports
- [ ] `sb docs scaffold initializer <name>` - Initializer module
- [ ] `sb docs scaffold server <name>` - Server module

**Your Answer:**

---

## `sb docs examples` Command

### Q17: Example Categories

What example categories are most useful?

**Current examples:**
- [x] basic-feature-module (shared state + actions + routes)
- [x] persistent-state-module (database-backed state)
- [x] user-agent-state-module (localStorage state)

**Additional examples to add:**
- [ ] utility-module (exports for other modules)
- [ ] server-module (Hono routes + RPC middleware)
- [ ] module-communication (getModule patterns)
- [ ] modal-integration (using modals module)
- [ ] navigation-patterns (programmatic navigation)
- [ ] offline-first-module (offline mode handling)
- [ ] workspace-aware-module (multi-tenant patterns)
- [ ] platform-specific-module (@platform directives)

**Which examples should be included?**

**Your Answer:**

---

## Implementation Priority

### Q18: Command Priority

In what order should commands be implemented?

**Rank 1-7 (1 = highest priority):**
- [ ] `sb docs context` - Primary entry point for agents
- [ ] `sb docs list` - Documentation discovery
- [ ] `sb docs get` - Documentation fetching
- [ ] `sb docs validate` - Code validation
- [ ] `sb docs types` - TypeScript definitions
- [ ] `sb docs examples` - (Already implemented)
- [ ] `sb docs scaffold` - Template generation

**Your Answer:**

---

### Q19: MVP vs Full Implementation

What's the minimum viable implementation?

**Options:**
- [ ] A. Just `context` + `examples` (agents use examples as templates)
- [ ] B. `context` + `list` + `get` (documentation access)
- [ ] C. `context` + `list` + `get` + `validate` (full workflow)
- [ ] D. Everything (all commands fully implemented)

**Your Answer:**

---

## Integration Questions

### Q20: CLAUDE.md / AGENTS.md Updates

Should the generated CLAUDE.md/AGENTS.md files be updated to match what commands are actually implemented?

**Current content tells agents to:**
1. Run `sb docs context`
2. Use `sb docs validate`
3. Use `sb docs get`
4. Use `sb docs scaffold`

**Should we update these files as we implement each command?**

**Your Answer:**

---

### Q21: Documentation Hosting

If documentation is bundled in the npm package:

**Questions:**
1. Maximum acceptable package size? _____ MB
2. Should docs be compressed? Yes / No
3. Should docs auto-update somehow? Yes / No / How: _____

**Your Answer:**

---

### Q22: Versioning Strategy

How should documentation versioning work?

**Options:**
- [ ] A. Docs version matches CLI version (bundled)
- [ ] B. Docs fetched from latest (always current)
- [ ] C. Docs version configurable via flag
- [ ] D. Not concerned about versioning

**Your Answer:**

---

## Additional Questions

### Q23: Anything Missing?

Are there other commands or features that should be added?

**Suggestions from songdrive patterns:**
- `sb docs patterns` - Common patterns (navigation reasons, modal system)
- `sb docs anti-patterns` - Things to avoid
- `sb docs migrate` - Migration helpers between versions
- `sb docs debug` - Debugging tips

**Your Answer:**

---

### Q24: CLI Name Preference

Is `sb docs` the right namespace?

**Options:**
- [ ] A. `sb docs` (current)
- [ ] B. `sb ai` (explicit AI agent focus)
- [ ] C. `sb help` (general help system)
- [ ] D. `sb llm` (explicit LLM focus)
- [ ] E. Other: _______________

**Your Answer:**

---

### Q25: Additional Context

Anything else I should know about how you want this to work?

**Your Answer:**

---

## Summary of Key Decisions Needed

| Question | Topic | Options |
|----------|-------|---------|
| Q1 | Doc source | Bundle / Runtime / Hosted |
| Q3 | Use cases | Claude Batch / Manual / Skip |
| Q10 | Validation checks | Which patterns to detect |
| Q15 | Scaffold | Keep / Remove / Replace |
| Q18 | Priority | Implementation order |
| Q19 | MVP scope | Minimum viable set |
