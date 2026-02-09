import { Command } from 'commander';

/**
 * Creates the `sb docs` command with all subcommands for AI agent support.
 *
 * Provides documentation discovery, code validation, scaffolding, and context
 * for AI coding agents working with Springboard applications.
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
  2. sb docs validate      # Check your code follows Springboard patterns
  3. sb docs get <section> # Fetch specific docs only when needed
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

    // sb docs validate
    docs.command('validate')
        .description('Validate a module file for common issues')
        .argument('[file]', 'Module file to validate')
        .option('--stdin', 'Read code from stdin instead of file')
        .option('--json', 'Output as JSON (default)')
        .option('--quiet', 'Only output errors')
        .action(async (file: string | undefined, options: { stdin?: boolean; json?: boolean; quiet?: boolean }) => {
            // TODO: Implement validation with TypeScript AST analysis
            // For now, output a placeholder that explains what will be checked
            const result = {
                issues: [],
                suggestions: [
                    'Validation not yet implemented. Will check for:',
                    '- getModule called at module level (should be in routes/actions)',
                    '- Missing optional chaining on module access',
                    '- Direct state mutation (should use setState/setStateImmer)',
                    '- Missing onDestroy cleanup for subscriptions',
                    '- Computed values stored in state (should use useMemo)'
                ],
                hasErrors: false
            };
            console.log(JSON.stringify(result, null, 2));
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

You are working on a Springboard application. Springboard is a full-stack JavaScript framework built on React, Hono, JSON-RPC, and WebSockets for building real-time, multi-device applications.

## Available Documentation Sections

${sectionsList}

## Key Concepts

### Module Structure
\`\`\`typescript
import springboard from 'springboard';

springboard.registerModule('ModuleName', {}, async (moduleAPI) => {
  // Create state (pick the right type!)
  const state = await moduleAPI.statesAPI.createSharedState('name', initialValue);

  // Create actions (automatically RPC-enabled)
  const actions = moduleAPI.createActions({
    actionName: async (args) => { /* ... */ }
  });

  // Register routes
  moduleAPI.registerRoute('/', {}, MyComponent);

  // Cleanup
  moduleAPI.onDestroy(() => { /* cleanup */ });

  // Return public API
  return { state, actions };
});
\`\`\`

### State Types
- **createSharedState**: Real-time sync across devices (ephemeral)
- **createPersistentState**: Database-backed, survives restarts
- **createUserAgentState**: Local only (localStorage)

### StateSupervisor Methods
\`\`\`typescript
state.getState()                 // Get current value
state.setState(newValue)         // Immutable update
state.setStateImmer(draft => {}) // Mutable update with Immer
state.useState()                 // React hook
\`\`\`

## Workflow

1. **Use this context** + your React/TypeScript knowledge to write code
2. **Run \`sb docs validate <file>\`** to check for common issues
3. **Fetch specific docs** with \`sb docs get <section>\` only when needed
4. **See examples** with \`sb docs examples list\` and \`sb docs examples show <name>\`

## Available Examples

${examples.map(e => `- ${e.name}: ${e.description}`).join('\n')}

## Common Mistakes to Avoid

1. **Don't call getModule at module level** - call inside routes/actions
2. **Use optional chaining** for module access: \`maybeModule?.actions?.doSomething()\`
3. **Don't mutate state directly** - use setState or setStateImmer
4. **Clean up subscriptions** in onDestroy
5. **Don't store computed values** in state - use useMemo

## Getting Specific Documentation

If you need detailed documentation on a topic, run:
\`\`\`bash
sb docs get springboard/module-api
sb docs get springboard/state-management
sb docs get springboard/patterns
\`\`\`
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
  };

  createActions<T extends Record<string, ActionFn>>(actions: T): T;
  createAction<Args, Return>(name: string, opts: {}, cb: ActionCallback<Args, Return>): ActionFn;

  registerRoute(path: string, options: RegisterRouteOptions, component: React.ComponentType): void;
  registerApplicationShell(component: React.ComponentType): void;

  getModule<K extends keyof AllModules>(id: K): AllModules[K];

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
declare module 'springboard/module_registry/module_registry' {
  interface AllModules {
    myModule: {
      state: StateSupervisor<MyState>;
      actions: {
        doSomething: (args: Args) => Promise<Result>;
      };
    };
  }
}
\`\`\`
`;

            console.log(types);
        });

    // sb docs scaffold (keeping for now - may remove in favor of examples)
    const scaffold = docs.command('scaffold')
        .description('Generate module templates (use "examples show" for reference code)')
        .action(() => {
            console.log('For module templates, use examples instead:');
            console.log('  sb docs examples list');
            console.log('  sb docs examples show basic-feature-module');
            console.log('\nExamples provide complete, working code you can copy and modify.');
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
