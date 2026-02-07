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

    return docs;
}
