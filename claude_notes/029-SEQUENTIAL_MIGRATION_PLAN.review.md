# Review of 028-SEQUENTIAL_MIGRATION_PLAN.md

## Findings (ordered by severity)

### High severity (correctness / blocking)
- **Contradictory constraints about legacy/esbuild support**: The plan explicitly says “No legacy esbuild/CLI support needed” while also requiring “Must support all songdrive esbuild.ts use cases in Vite,” then defers those capabilities to a future phase. This is internally inconsistent and means the plan cannot satisfy its own constraints. `claude_notes/028-SEQUENTIAL_MIGRATION_PLAN.md:5-8`, `claude_notes/028-SEQUENTIAL_MIGRATION_PLAN.md:42`, `claude_notes/028-SEQUENTIAL_MIGRATION_PLAN.md:861-873`.

> We need to make it so that esbuild script's use cases are covered by the new vite-supported system. Mainly "this app needs to compile files and move them to some particular folder". So less about esbuild, and more about the exact things and outcomes it's producing in that file. Obviously the implementation will not be the exact same, as we are leaning on vite instead of esbuild now. The app needs to "work" though.

- **Incorrect import rewrites for refactor files**: The plan rewrites imports that don’t exist in the source files it cites (e.g., `server_json_rpc.ts` and `server_app_dependencies.ts` do not import `KVStore`; the refactor `browser_json_rpc.ts` does not import `KVStore`). These steps will not compile if applied literally. `claude_notes/028-SEQUENTIAL_MIGRATION_PLAN.md:142-166`, `claude_notes/028-SEQUENTIAL_MIGRATION_PLAN.md:286-297`.

> Please provide the correct steps here instead

- **Export map changes point at source files and wrong extensions**: The plan instructs adding exports to `./src/...` and uses `engine.tsx`, which conflicts with the current package pattern that exports compiled `dist` files. This will break package consumers or create mixed module resolution. `claude_notes/028-SEQUENTIAL_MIGRATION_PLAN.md:592-603`.

> Yeah we should export dist files like we are in this branch

- **RPC endpoint test is incorrect**: The server route is defined as `POST /rpc/*`, so the plan’s test call to `/rpc` will not match. This invalidates the acceptance criteria. `claude_notes/028-SEQUENTIAL_MIGRATION_PLAN.md:681-685`.

> Provide the correct steps here instead

### Medium severity (completeness / behavior)
- **Move of `ws_server_core_dependencies.ts` breaks existing entrypoints without updates**: The plan moves `packages/springboard/src/server/ws_server_core_dependencies.ts` but does not update `packages/springboard/src/server/entrypoints/local-server.entrypoint.ts` or other call sites that reference the old path, and later removes that entrypoint. This is a behavioral break unless the CLI/Vite generator is updated in the same phase. `claude_notes/028-SEQUENTIAL_MIGRATION_PLAN.md:227-271`, `claude_notes/028-SEQUENTIAL_MIGRATION_PLAN.md:767-771`.

> We mainly want to cherrypick things into this branch. Like the separation between generic server stuff, and node entrypoint. But also the client-specific stuff in the refactor branch

- **Port assumptions are hard-coded in validation**: The validation uses port 3001, but the template uses `__PORT__` and current defaults are 1337 in several entrypoints. The checks will be false negatives without a deterministic port. `claude_notes/028-SEQUENTIAL_MIGRATION_PLAN.md:503-504`, `claude_notes/028-SEQUENTIAL_MIGRATION_PLAN.md:670-675`.

> This should be injected through env var at server runtime

- **Node ESM resolution test is invalid**: `require.resolve` in Node ESM mode is not reliable for verifying export maps. Use `node --input-type=module -e "console.log(await import.meta.resolve(...))"` or a TS build check instead. `claude_notes/028-SEQUENTIAL_MIGRATION_PLAN.md:609-613`.

> Idk, this seems like a random verification step that's not necessary

- **Missing coverage for sub-packages under single-package constraint**: The plan claims single-package only, but does not address the existing `packages/springboard/cli` and `packages/springboard/vite-plugin` sub-package boundaries (their own `package.json` files), which still define separate packages. This leaves the “single package” constraint unfulfilled. `claude_notes/028-SEQUENTIAL_MIGRATION_PLAN.md:5-6`, `claude_notes/028-SEQUENTIAL_MIGRATION_PLAN.md:389-392`.

> What are the risks of having package.json files in subdirectories? I suppose we need to make sure any deps are defined in the main springboard package.json, which sort of defeats the purpose of the sub-packages. Though maybe turbo repo can help with npm run scripts like this though. But the springboard package.json build command should build everything needed to publish springboard I think

### Low severity (readability / maintainability)
- **Use of `! ls` in zsh is brittle**: `!` triggers history expansion in zsh; the command is not reliable. Prefer `test ! -f ...` for negative checks. `claude_notes/028-SEQUENTIAL_MIGRATION_PLAN.md:253-255`.

> Please provide a better strategy

- **Rollback guidance includes destructive command**: `git reset --hard` is explicitly destructive and not aligned with the non-destructive workflow in this repo. It should be avoided or flagged as “only if explicitly approved.” `claude_notes/028-SEQUENTIAL_MIGRATION_PLAN.md:879-883`.

> Let's not have this rollback plan at all

- **Acceptance criteria require “branch pushed” but no push command**: AC0.1 says the backup branch is pushed, but the steps only create a local branch. `claude_notes/028-SEQUENTIAL_MIGRATION_PLAN.md:60-76`.

> Let's not have this step at all

## Correctness & completeness fixes to apply to the plan
- **Resolve the legacy/esbuild contradiction**: Either (a) explicitly drop “must support songdrive esbuild.ts” from constraints and scope it as a later milestone, or (b) include the Vite equivalents for all songdrive requirements in this plan.

> Option b

- **Fix the import rewrite steps** to match actual refactor files:
  - `server_json_rpc.ts` should rewrite `springboard/types/module_types` to `../../core/types/module_types` (Rpc/RpcArgs), not KVStore.
  - `server_app_dependencies.ts` should rewrite `springboard/types/module_types` to `../../core/types/module_types` (CoreDependencies), not KVStore.
  - `browser_json_rpc.ts` should only update the module types import (already `Rpc, RpcArgs`).

> Yes let's make sure this is correct

- **Export map should continue to target `dist` outputs**, and `engine` should reference `.ts` source only for internal tooling, not runtime exports.

> Yes

- **Update entrypoint pathing and removals**: If `local-server.entrypoint.ts` is removed, update any config generators or templates that rely on it.

> Figure out the correct thing to do here

- **Correct the validation commands**: use the actual RPC route and ensure the chosen port is deterministic for tests.

## Readability & maintainability suggestions
- Consolidate import policy: decide whether internal code uses relative imports or package exports, and keep it consistent in all phases.
- Replace shell validation snippets that will fail in zsh (history expansion) or in ESM contexts (`require.resolve`).
- Move the acceptance criteria to check invariants that the plan actually changes (e.g., export map correctness, generated template content), not only runtime endpoints.

## Open questions
- Is the “no legacy CLI” constraint strict, or should the plan explicitly include a compatibility layer for existing esbuild users while Vite parity is built?

> Hard cutoff. Vite only. No backwards compatibility support for esbuild

- Should `packages/springboard/cli` and `packages/springboard/vite-plugin` be merged into `packages/springboard/src` in this migration, or later?

> yeah I think so, in this effort
