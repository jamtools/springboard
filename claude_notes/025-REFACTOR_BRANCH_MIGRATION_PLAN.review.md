# Review of 024-REFACTOR_BRANCH_MIGRATION_PLAN.md

## Findings (ordered by severity)

### High risk / correctness gaps
- **Package naming and imports are inconsistent**: the plan alternates between `springboard/server`, `springboard-server`, and `springboard-server/src/hono_app`. That will break consumers unless the package name and exports are defined and used consistently. Decide on one public import path and update all references accordingly. Also avoid `.../src/...` imports in published packages.
- **Missing re-exports or migration shims for moved files**: the plan only adds a re-export for `register.ts`. `hono_app.ts`, `services/server_json_rpc.ts`, and other moved modules are not shimmed. Existing imports under `packages/springboard/src/server/...` will break unless you add re-exports or update all call sites.

> We're going to use `springboard/server`, as we've moved everything into one package on *this* branch. we'll funnel in changes from the refactor branch, but will keep *our* new pattern of having everything in one package

> The plan should be thorough and correct with regards to where files will go, and how they will be imported from which other files. Please provide the correct solution for this entirely. Every file that needs to be ported over or included, and exactly where it will go, and exactly how it will be imported from which other files. you can check the git history on *this* branch to see what other things we've fundamentally changed here, that will need to be taken into account with the refactor branch's contents. Keep in mind we've migrated from esbuild to vite, and we need to support this file that an app was using to build with this framework and esbuild /var/folders/1j/j9tl30f930d27ck98gv5jpg80000gn/T/vibe-kanban/worktrees/de3c-make-tauri-file/ffmpeg-songdrive/build/esbuild.ts. we should migrate both the server-side and client-side stuff from the refactor branch, as it's relevant to porting the linked esbuild app config file here. what does the original plan say about the client-side stuff? be thorough with corrections and concerns with the original plan



### Medium risk / completeness gaps
- **Build/exports config is incomplete**: new packages (`packages/springboard/server`, `packages/springboard/platforms/node`, `packages/springboard/platforms/webapp`, `packages/springboard/platforms/cf-workers`) need `package.json` `name`, `main`, `types`, `exports`, and build scripts. The plan only calls out `exports` in the root `springboard` package. If these packages are published, they need their own build outputs and exports.

> Please go in detail with the correct solution for all of this

- **Monorepo tooling not updated**: new packages likely need updates in `turbo.json`, `pnpm-workspace.yaml` (if it is not already globbing `packages/**`), and any build/test pipelines to ensure they are built and type-checked.

> Sure, ensure this is all setup correctly. We're really going for a mono-package for everything in the springboard umbrella

- **Node platform services list is incomplete**: the architecture section lists `node_json_rpc.ts` and `node_file_storage_service.ts`, but the migration steps do not copy or verify those files. Either add steps or confirm they are unused.

> Plan to make the correct changes here and go in detail

- **Core API changes need call-site updates**: `initApp` signature changes and `ServerJsonRpcClientAndServer` naming changes will require updates in every consumer. The plan only updates the Vite template; it does not include edits in other packages or apps that import those APIs.

> Yes please go in detail with the correct solution here

### Low risk / clarity issues
- **Rollback commands may not work**: `git checkout HEAD -- packages/springboard/server/` will fail if the new package is untracked. If rollback is needed, note `git restore --staged` + `git clean -fd` (with caution) or simply `git checkout -b backup` before changes.

> let's just leave this out of the plan I think

- **Commit timeline dates are in the future**: if the refactor branch has those commits, it is fine, but the dates could confuse readers. Consider removing dates or clarifying they are from that branch, not the current timeline.

> not sure what you mean. the refactor branch's commits are fairly old compared to this branch. I don't think there's any issue here. omit this from your new review

- **Testing checklist omits the Vite template**: the plan calls for a large change to `node-entry.template.ts` but does not explicitly test template generation or a clean `apps/vite-test` dev run.

> Provide necessary steps that should be included in the plan

## Suggested corrections / additions
- Define the new package names and exports upfront. Example: if the new package is `springboard-server`, ensure `packages/springboard/server/package.json` sets `name: "springboard-server"` and includes proper `exports` for `./hono_app`, `./register`, etc.

> The only springboard package will be `springboard`. Though `create-springboard-app` will be published as its own package. Should we get rid of all package.json files that are acting like their own package like packages/springboard/vite-plugin/package.json? Should packages/springboard/create-springboard-app be moved outside of the springboard folder? We should probably get rid of packages/springboard/cli or move it. Review the packages/springboard/package.json file for a clear understanding of the new way we're positioning the single package approach, compared to the package.json's in the refactor branch. we'll move refactor branch code in, and keep the single package approach

- Add a dedicated “Call-site migration” step that enumerates which packages/apps import `springboard/src/server/...` today and how those imports will be updated or shimmed.

> look at /var/folders/1j/j9tl30f930d27ck98gv5jpg80000gn/T/vibe-kanban/worktrees/de3c-make-tauri-file/ffmpeg-songdrive for the main example of springboard being used in the wild. pretty much all features of the framework are exercised there

- Add explicit steps for:
  - Updating `turbo.json` pipelines for new packages.
  - Adding build configs (`tsconfig.json` + build script) and ensuring `dist/` output matches export maps.
  - Updating dependency graphs in `package.json` (e.g., `springboard` depending on `springboard-server`, `@springboardjs/platforms-node`, etc.).

> I mentioned in earlier, but this will all be one package now

- Add a brief note at the top that `copy-lines` is available and preferred for tracing provenance, so readers don't assume it's a missing helper.

> sure we can say it's available. there are plenty of examples in the plan. can you trace them and make sure they are accurate and are copying the correct information?

- Include a “verify imports/exports” checklist: `tsc -p packages/springboard/server`, `pnpm -w lint` (if available), and a quick search for stale imports.

> Yeah we need good typechecks and test setups for different "sub-packages" (all one package though)

## Overall assessment
The plan is directionally solid and covers the major moving parts, but it is not executable as-is due to inconsistent package naming, missing shims for moved modules, and unclear build/export setup for new packages. Tightening those areas and adding explicit call-site migration steps will substantially reduce breakage risk.
