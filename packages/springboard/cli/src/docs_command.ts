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
            console.log('TODO: Implement list command');
            // Will list all documentation sections with their use_cases keywords
        });

    // sb docs get
    docs.command('get')
        .description('Fetch documentation for specific sections')
        .argument('<sections...>', 'Documentation section(s) to fetch')
        .action(async (sections: string[]) => {
            console.log('TODO: Implement get command for sections:', sections);
            // Will fetch and output documentation content
        });

    // sb docs validate
    docs.command('validate')
        .description('Validate a module file for common issues')
        .argument('[file]', 'Module file to validate')
        .option('--stdin', 'Read code from stdin instead of file')
        .option('--json', 'Output as JSON (default)')
        .option('--quiet', 'Only output errors')
        .action(async (file: string | undefined, options: { stdin?: boolean; json?: boolean; quiet?: boolean }) => {
            console.log('TODO: Implement validate command');
            // Will run TypeScript compilation + custom AST visitors + ESLint
            // Output: { issues: [], suggestions: [], hasErrors: boolean }
        });

    // sb docs scaffold
    const scaffold = docs.command('scaffold')
        .description('Generate module templates');

    scaffold.command('module')
        .description('Generate a basic module')
        .argument('<name>', 'Module name')
        .action(async (name: string) => {
            console.log('TODO: Implement scaffold module for:', name);
        });

    scaffold.command('feature')
        .description('Generate a feature module')
        .argument('<name>', 'Module name')
        .action(async (name: string) => {
            console.log('TODO: Implement scaffold feature for:', name);
        });

    scaffold.command('utility')
        .description('Generate a utility module')
        .argument('<name>', 'Module name')
        .action(async (name: string) => {
            console.log('TODO: Implement scaffold utility for:', name);
        });

    // sb docs context
    docs.command('context')
        .description('Output full context prompt for AI agents')
        .action(async () => {
            console.log('TODO: Implement context command');
            // Will output a comprehensive prompt with:
            // - Framework overview
            // - Available documentation sections
            // - Workflow instructions
            // - Key concepts
        });

    // sb docs types
    docs.command('types')
        .description('Output core TypeScript type definitions')
        .action(async () => {
            console.log('TODO: Implement types command');
            // Will output ModuleAPI, StateSupervisor, CoreDependencies, etc.
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
