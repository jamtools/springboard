import {program} from 'commander';

import {execSync} from 'child_process';
import {readFileSync, writeFileSync} from 'fs';

import packageJSON from '../package.json';

program
    .name('create-springboard-app')
    .description('Generate a new Springboard application')
    .version(packageJSON.version);

const version = packageJSON.version;

import exampleString from './example/index-as-string';
import viteString from './example/vite-as-string';

program
.option('--template <bare | jamtools>', 'Template to use for the app', 'bare')
.action((options: {template?: string}) => {
    const DEFAULT_APPLICATION_TEMPLATE = 'bare';

    if (options.template && options.template !== 'bare' && options.template !== 'jamtools') {
        console.error('Invalid template specified. Must be "bare" or "jamtools"');
        process.exit(1);
    }

    console.log(`Creating springboard app with template "${options.template}"\n`);

    const template = options.template || DEFAULT_APPLICATION_TEMPLATE;

    let packageManager = 'npm';
    try {
        execSync('pnpm --version', {cwd: process.cwd(), stdio: 'ignore'});
        console.log('Using pnpm as the package manager\n');
        packageManager = 'pnpm';
    } catch (error) {
    }

    const npmRcContent = [
        // 'node-linker=hoisted',
    ];

    if (process.env.NPM_CONFIG_REGISTRY) {
        npmRcContent.push(`registry=${process.env.NPM_CONFIG_REGISTRY}`);
    }

    const originalPackageJson = {
        "name": process.cwd().split('/').pop(),
        "version": "1.0.0",
        "type": "module",
        "scripts": {}
    };

    writeFileSync(`${process.cwd()}/package.json`, JSON.stringify(originalPackageJson, null, 2));

    if (npmRcContent.length > 0) {
        writeFileSync('./.npmrc', npmRcContent.join('\n'), {flag: 'w'});
    }

    const gitIgnore = [
        'node_modules',
        'dist',
        'data/kv_data.json',
        'data/kv.db',
        '.springboard',
        'index.html',
    ];

    writeFileSync('./.gitignore', gitIgnore.join('\n'), {flag: 'a'});

    const jamToolsPackage = template === 'jamtools' ? `@jamtools/core@${version}` : '';

    const installDepsCommand = [
        packageManager,
        'install',
        `springboard@${version}`,
        jamToolsPackage,
        'react',
        'react-dom',
        'react-router',
        '@hono/node-server',
        'better-sqlite3',
        'crossws',
        'hono',
        'immer',
        'kysely',
        'rxjs',
    ];
    console.log(installDepsCommand.join(' '));
    execSync(installDepsCommand.join(' '), {cwd: process.cwd(), stdio: 'inherit'});

    const installDevDepsCommand = `${packageManager} install -D vite typescript @types/node @types/react @types/react-dom`;
    console.log(installDevDepsCommand);
    execSync(installDevDepsCommand, {cwd: process.cwd(), stdio: 'inherit'});

    execSync(`npm rebuild better-sqlite3`, {cwd: process.cwd()});

    execSync(`mkdir -p src`, {cwd: process.cwd()});
    writeFileSync(`${process.cwd()}/src/index.tsx`, exampleString);
    console.log('Created application entrypoint src/index.tsx');

    writeFileSync(`${process.cwd()}/vite.config.ts`, viteString);
    console.log('Created vite config vite.config.ts');

    const agentDocsContent = `Keep the following info in mind *when working in the ./src directory only*

After making any changes, run \`npm run check-types\` to ensure types pass.

This application is built with the **Springboard framework**. All code is assumed to be isomorphic by default. Optionally run \`npx sb docs context\` for more info.

Example module:

\`\`\`tsx
import springboard from 'springboard';

type ExampleSharedState = {
  version: 1;
  items: [] as Array<{id: string; name: string}>;
}

springboard.registerModule('ModuleName', {}, async (moduleAPI) => {
  const sharedState = await moduleAPI.createStates({

    exampleSharedState: {
        version: 1; // Later we can do \`version: 1 | 2\` and perform data migrations as needed
        items: [],
    } as ExampleSharedState,
  });

  const myClientState = await moduleAPI.createUserAgentState('mySettings', {theme: null} as {theme: string | null});

  const myServerActions = moduleAPI.createActions({
    addItem: (args: {name: string}) => {
      const newItem = {id: generateid(), name: args.name};

      sharedState.exampleSharedState.setStateImmer(state => {
          state.push(newItem);
      });

      // or
      sharedState.exampleSharedState.setState(state => {
          return [...state, newItem];
      });

      const someOtherModule = moduleAPI.getModule('SomeOptionalModule');
      someOtherModule?.actions.doSomething(); // Optional chaining, since module was registered as optional in its own type declaration. Good for modules that only exist on certain platform builds.

      return {data: newItem};
    },
  })

  // Register UI routes
  moduleAPI.registerRoute('/', {}, (navigate) => {
    const liveState = sharedState.useState();

    return (
      <div>
        <button onClick={() => {
          myServerActions.addItem({name: 'me'});
        }}>
          Submit
        </button>
      </div>
    );
  });

  // Return public API
  return { sharedState, actions };
});

// Declare module return value for other files
declare module 'springboard/module_registry/module_registry' {
  interface AllModules {
    ModuleName: {
      sharedState: {
        exampleSharedState: StateSupervisor<ExampleSharedState>;
      };
      actions: {
         addItem: (args: {name: string}) => Promise<void>;
      };
    };
  }
}
\`\`\`

To access these values in another file

\`\`\`tsx
import {useModule} from '../hooks/useModule';

const MyComponent = () => {
  const myModule = useModule('ModuleName');
  const liveState = myModule.sharedState.exampleSharedState.useState();

  const doThing = async () => {
    await myModule.actions.addItem({name: 'example'});
  };
};
\`\`\`

If importing a node module in an action, you'll need to use conditional compilation. Springboard is written in a way so that actions *can* run on the client, but our application here is only deployed as a server-driven SPA, so all actions will run on the server in this app.

\`\`\`tsx
const myActions = moduleAPI.createActions({
  myAction: async () => {
    // @platform "node"
    const fs = await import ('fs');
    // ...
    // @platform end
  },
});

// Or import a server only module

// @platform "node"
import './modules/MyServerOnlyModule';
// @platform end

// More rarely, you may want to remove code from the server build that only runs on the frontend. It's necessary sometimes.

// @platform "browser"
window.addEventListener('load', () => {

});
// @platform end
\`\`\`

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **vibe-kanban-vscode-web** (940 symbols, 1601 relationships, 64 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run \`npx gitnexus analyze\` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run \`gitnexus_impact({target: "symbolName", direction: "upstream"})\` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run \`gitnexus_detect_changes()\` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use \`gitnexus_query({query: "concept"})\` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use \`gitnexus_context({name: "symbolName"})\`.

## Never Do

- NEVER edit a function, class, or method without first running \`gitnexus_impact\` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use \`gitnexus_rename\` which understands the call graph.
- NEVER commit changes without running \`gitnexus_detect_changes()\` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| \`gitnexus://repo/vibe-kanban-vscode-web/context\` | Codebase overview, check index freshness |
| \`gitnexus://repo/vibe-kanban-vscode-web/clusters\` | All functional areas |
| \`gitnexus://repo/vibe-kanban-vscode-web/processes\` | All execution flows |
| \`gitnexus://repo/vibe-kanban-vscode-web/process/{name}\` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | \`.claude/skills/gitnexus/gitnexus-exploring/SKILL.md\` |
| Blast radius / "What breaks if I change X?" | \`.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md\` |
| Trace bugs / "Why is X failing?" | \`.claude/skills/gitnexus/gitnexus-debugging/SKILL.md\` |
| Rename / extract / split / refactor | \`.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md\` |
| Tools, resources, schema reference | \`.claude/skills/gitnexus/gitnexus-guide/SKILL.md\` |
| Index, status, clean, wiki CLI commands | \`.claude/skills/gitnexus/gitnexus-cli/SKILL.md\` |

<!-- gitnexus:end -->
`;
    writeFileSync(`${process.cwd()}/CLAUDE.md`, agentDocsContent);
    writeFileSync(`${process.cwd()}/AGENTS.md`, agentDocsContent);
    console.log('Created CLAUDE.md and AGENTS.md with AI agent instructions');

    const packageJsonPath = `${process.cwd()}/package.json`;
    const packageJson = JSON.parse(readFileSync(packageJsonPath).toString());

    packageJson.type = 'module';

    packageJson.scripts = {
        ...packageJson.scripts,
        // 'dev': 'sb dev src/index.tsx',
        // 'build': 'sb build src/index.tsx',
        // 'start': 'sb start',
        dev: 'vite',
        start: 'node dist/node/node-entry.mjs',
        build: 'npm run build:web && npm run build:node',
        'build:web': 'SPRINGBOARD_PLATFORM=web vite build',
        'build:node': 'SPRINGBOARD_PLATFORM=node vite build --outDir dist/node',
        'check-types': 'tsc --noEmit',
    };

    writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

    console.log('Project created successfully! Run the following to start the development server:\n');
    console.log('npm run dev\n');
});

if (!(globalThis as any).AVOID_PROGRAM_PARSE) {
    program.parse();
}
