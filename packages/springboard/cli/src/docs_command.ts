import { Command } from 'commander';

/**
 * Creates the `sb docs` command with all subcommands for AI agent support.
 *
 * Provides documentation discovery and context for AI coding agents
 * working with Springboard applications.
 */
export function createDocsCommand(): Command {
    const docs = new Command('docs')
        .description('Documentation and AI agent support tools')
        .addHelpText('after', `
Getting Started:
  For AI agents: Run 'sb docs context' first to get comprehensive framework
  information and available documentation sections. This provides everything
  you need to start working with Springboard.

  The 'context' command includes the full list of available docs, so you
  don't need to run 'list' separately.

Workflow:
  1. sb docs context       # Get full framework context (run this first)
  2. sb docs get <section> # Fetch specific docs only when needed
  3. sb docs examples show <name> # View example code
`)
        .action(() => {
            // When `sb docs` is called without subcommand, show help
            docs.help();
        });

    // sb docs list
    docs.command('list')
        .description('List available documentation sections with use cases')
        .option('--json', 'Output as JSON')
        .action(async (options: { json?: boolean }) => {
            const { listSections } = await import('./docs/index.js');
            const sections = listSections();

            if (options.json) {
                console.log(JSON.stringify(sections, null, 2));
            } else {
                console.log('Available Springboard Documentation Sections:\n');
                for (const section of sections) {
                    console.log(`${section.slug}`);
                    console.log(`  ${section.title}`);
                    console.log(`  Use cases: ${section.use_cases}`);
                    console.log();
                }
            }
        });

    // sb docs get
    docs.command('get')
        .description('Fetch documentation for specific sections')
        .argument('<sections...>', 'Documentation section(s) to fetch')
        .action(async (sections: string[]) => {
            const { getDocContent, getSection } = await import('./docs/index.js');

            for (const slug of sections) {
                const section = getSection(slug);
                if (!section) {
                    console.error(`Section "${slug}" not found. Run 'sb docs list' to see available sections.\n`);
                    continue;
                }

                const content = getDocContent(slug);
                if (!content) {
                    console.error(`Content for "${slug}" not available.\n`);
                    continue;
                }

                console.log(content);
                console.log('\n---\n');
            }
        });

    // sb docs context
    docs.command('context')
        .description('Output full context prompt for AI agents')
        .action(async () => {
            const { formatSectionsList } = await import('./docs/index.js');
            const { listExamples } = await import('./examples/index.js');

            const sectionsList = formatSectionsList();
            const examples = listExamples();

            const context = `# Springboard Development Context

Springboard apps are isomorphic React applications with server-capable actions, Hono-backed HTTP/WebSocket routes, JSON-RPC, and synced state supervisors. Treat code as shared between browser and node unless a platform guard says otherwise.

After changing application code, run the project's type check, usually:

\`\`\`bash
npm run check-types
\`\`\`

## Practical Module Pattern

\`\`\`tsx
import springboard, {generateId} from 'springboard';
import {defineRoute, defineRoutes} from 'springboard/router';
import type {StateSupervisor} from 'springboard/services/states/shared_state_service';

type ItemsState = {
  version: 1;
  items: Array<{id: string; name: string}>;
};

type LocalUiState = {
  selectedId: string | null;
};

springboard.registerModule('ItemsModule', {}, async (moduleAPI) => {
  const shared = await moduleAPI.statesAPI.createSharedState<ItemsState>('items', {
    version: 1,
    items: [],
  });

  const persistent = await moduleAPI.createStates({
    settings: {
      version: 1,
      sortBy: 'name' as 'name' | 'createdAt',
    },
  });

  const localUi = await moduleAPI.statesAPI.createUserAgentState<LocalUiState>('ui', {
    selectedId: null,
  });

  const actions = moduleAPI.createActions({
    addItem: async (args: {name: string}) => {
      const item = {id: generateId(), name: args.name};

      shared.setStateImmer(state => {
        state.items.push(item);
      });

      return {data: item};
    },

    selectItem: async (args: {id: string | null}) => {
      localUi.setState({selectedId: args.id});
      return null;
    },
  });

  const ExampleRoute = () => {
    const liveShared = shared.useState();
    const liveUi = localUi.useState();

    return (
      <main>
        {liveShared.items.map(item => (
          <button
            key={item.id}
            data-selected={item.id === liveUi.selectedId}
            onClick={() => actions.selectItem({id: item.id})}
          >
            {item.name}
          </button>
        ))}
      </main>
    );
  };

  return {routes: defineRoutes([defineRoute({path: '/', component: ExampleRoute})])};

  moduleAPI.onDestroy(() => {
    // Unsubscribe timers, subjects, DOM listeners, or external resources here.
  });

  return {shared, persistent, localUi, actions};
});

declare module 'springboard/register' {
  interface RegisteredModules {
    ItemsModule: {
      shared: StateSupervisor<ItemsState>;
      persistent: {
        settings: StateSupervisor<{
          version: 1;
          sortBy: 'name' | 'createdAt';
        }>;
      };
      localUi: StateSupervisor<LocalUiState>;
      actions: {
        addItem: (args: {name: string}) => Promise<{data: {id: string; name: string}}>;
        selectItem: (args: {id: string | null}) => Promise<null>;
      };
    };
  }
}
\`\`\`

## Accessing Modules From Components

\`\`\`tsx
import {useModule} from 'springboard/engine/engine';

export const ItemCount = () => {
  const itemsModule = useModule('ItemsModule');
  const state = itemsModule.shared.useState();

  return <span>{state.items.length}</span>;
};
\`\`\`

Use \`moduleAPI.getModule('OtherModule')\` inside module setup, actions, and route callbacks. Use \`useModule('OtherModule')\` inside React components. If a module may be absent in a platform build, model that in \`RegisteredModules\` and use optional chaining.

## State Choices

- \`statesAPI.createSharedState\`: ephemeral synced state for live collaboration and current runtime state.
- \`statesAPI.createPersistentState\`: synced state backed by remote storage.
- \`moduleAPI.createStates\`: shorthand for multiple persistent states.
- \`statesAPI.createUserAgentState\`: localStorage-backed state for one browser/device.
- \`statesAPI.createLocalSessionState\`: sessionStorage-backed state for one browser tab/session.

State supervisors expose:

\`\`\`typescript
state.getState();
state.setState(nextValue);
state.setState(prev => nextValue);
state.setStateImmer(draft => {
  // mutate draft
});
state.useState();
\`\`\`

## Actions And Platform Code

\`moduleAPI.createActions\` creates functions that can be called locally or over RPC. In server-driven apps, action bodies normally run on node, but the source file is still parsed for browser builds. Guard node-only imports and code:

\`\`\`tsx
const actions = moduleAPI.createActions({
  readConfig: async () => {
    // @platform "node"
    const fs = await import('node:fs/promises');
    const text = await fs.readFile('config.json', 'utf-8');
    return {text};
    // @platform end

    return {text: ''};
  },
});

// @platform "node"
import './modules/ServerOnlyModule';
// @platform end

// @platform "browser"
window.addEventListener('load', () => {
  // browser-only setup
});
// @platform end
\`\`\`

## Working Rules

- Prefer Springboard state supervisors over ad hoc global state.
- Do not mutate state returned by \`getState()\` or \`useState()\`; use \`setState\` or \`setStateImmer\`.
- Keep derived values out of state; compute them in render or memoized selectors.
- Register cleanup with \`moduleAPI.onDestroy\` for subscriptions, timers, and listeners.
- Fetch focused docs only when needed: \`sb docs get springboard/module-api springboard/state-management\`.

## Available Documentation Sections

${sectionsList}

## Available Examples

${examples.map(e => `- ${e.name}: ${e.description}`).join('\n')}
`;

            console.log(context);
        });

    // sb docs types
    docs.command('types')
        .description('Output core TypeScript type definitions')
        .action(async () => {
            const types = `# Springboard Core Type Definitions

## ModuleAPI

\`\`\`typescript
interface ModuleAPI {
  moduleId: string;
  fullPrefix: string;

  statesAPI: {
    createSharedState<T>(name: string, initial: T): Promise<StateSupervisor<T>>;
    createPersistentState<T>(name: string, initial: T): Promise<StateSupervisor<T>>;
    createUserAgentState<T>(name: string, initial: T): Promise<StateSupervisor<T>>;
    createLocalSessionState<T>(name: string, initial: T): Promise<StateSupervisor<T>>;
  };

  createStates<T extends Record<string, any>>(states: T): Promise<{
    [K in keyof T]: StateSupervisor<T[K]>;
  }>;
  createActions<T extends Record<string, ActionFn>>(actions: T): T;
  createAction<Args, Return>(name: string, opts: {}, cb: ActionCallback<Args, Return>): ActionFn;

  routes?: readonly SpringboardRouteDescriptor[];
  registerApplicationShell(component: React.ComponentType): void;

  getModule<K extends keyof RegisteredModules>(id: K): RegisteredModules[K];

  onDestroy(callback: () => void): void;
  setRpcMode(mode: 'local' | 'remote'): void;

  deps: {
    core: CoreDependencies;
    module: ModuleDependencies;
  };
}
\`\`\`

## StateSupervisor

\`\`\`typescript
interface StateSupervisor<T> {
  getState(): T;
  setState(value: T | ((prev: T) => T)): T;
  setStateImmer(callback: (draft: T) => void): T;
  useState(): T;  // React hook
  subject: Subject<T>;  // RxJS Subject
}
\`\`\`

## CoreDependencies

\`\`\`typescript
interface CoreDependencies {
  log: (...args: any[]) => void;
  showError: (error: string) => void;
  files: {
    saveFile: (name: string, content: string) => Promise<void>;
  };
  storage: {
    remote: KVStore;
    userAgent: KVStore;
    session?: KVStore;
  };
  rpc: {
    remote: Rpc;
    local?: Rpc;
  };
  isMaestro: () => boolean;
}
\`\`\`

## KVStore

\`\`\`typescript
interface KVStore {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  getAll(): Promise<Record<string, any> | null>;
}
\`\`\`

## RegisterRouteOptions

\`\`\`typescript
interface RegisterRouteOptions {
  hideApplicationShell?: boolean;
  documentMeta?: DocumentMeta | ((context: RouteContext) => DocumentMeta);
}

interface DocumentMeta {
  title?: string;
  description?: string;
  keywords?: string;
  'og:title'?: string;
  'og:description'?: string;
  'og:image'?: string;
  [key: string]: string | undefined;
}
\`\`\`

## Module Interface Merging

\`\`\`typescript
// Declare your module's exports for type-safe getModule()
declare module 'springboard/register' {
  interface RegisteredModules {
    myModule: {
      state: StateSupervisor<MyState>;
      actions: {
        doSomething: (args: Args) => Promise<Result>;
      };
    };
  }
}
\`\`\`

## React Module Access

\`\`\`typescript
import {useModule} from 'springboard/engine/engine';

const moduleApi = useModule('myModule');
\`\`\`
`;

            console.log(types);
        });

    // sb docs examples
    const examplesCmd = docs.command('examples')
        .description('View example modules');

    examplesCmd.command('list')
        .description('List all available examples')
        .option('--json', 'Output as JSON')
        .action(async (options: { json?: boolean }) => {
            const { listExamples } = await import('./examples/index.js');
            const examplesList = listExamples();

            if (options.json) {
                console.log(JSON.stringify(examplesList, null, 2));
            } else {
                console.log('Available Springboard Examples:\n');
                for (const ex of examplesList) {
                    console.log(`${ex.name}`);
                    console.log(`  ${ex.title}`);
                    console.log(`  ${ex.description}`);
                    console.log(`  Category: ${ex.category}`);
                    console.log(`  Tags: ${ex.tags.join(', ')}`);
                    console.log();
                }
            }
        });

    examplesCmd.command('show')
        .description('Show code for a specific example')
        .argument('<name>', 'Example name')
        .action(async (name: string) => {
            const { getExample } = await import('./examples/index.js');
            const example = getExample(name);

            if (!example) {
                console.error(`Example "${name}" not found. Run 'sb docs examples list' to see available examples.`);
                process.exit(1);
            }

            console.log(`# ${example.title}\n`);
            console.log(`${example.description}\n`);
            console.log(`Category: ${example.category}`);
            console.log(`Tags: ${example.tags.join(', ')}\n`);
            console.log('```tsx');
            console.log(example.code);
            console.log('```');
        });

    return docs;
}
