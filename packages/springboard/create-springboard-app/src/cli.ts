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
        'node-linker=hoisted',
    ];

    if (process.env.NPM_CONFIG_REGISTRY) {
        npmRcContent.push(`registry=${process.env.NPM_CONFIG_REGISTRY}`);
    }

    execSync('npm init -y', {cwd: process.cwd()});
    writeFileSync('./.npmrc', npmRcContent.join('\n'), {flag: 'w'});

    const gitIgnore = [
        'node_modules',
        'dist',
        'data/kv_data.json',
    ];

    writeFileSync('./.gitignore', gitIgnore.join('\n'), {flag: 'a'});

    const jamToolsPackage = template === 'jamtools' ? `@jamtools/core@${version}` : '';

    const installDepsCommand = `${packageManager} install springboard@${version} springboard-server@${version} @springboardjs/platforms-node@${version} @springboardjs/platforms-browser@${version} ${jamToolsPackage} react react-dom react-router`;
    console.log(installDepsCommand);
    execSync(installDepsCommand, {cwd: process.cwd(), stdio: 'inherit'});

    const installDevDepsCommand = `${packageManager} install -D springboard-cli@${version} typescript @types/node @types/react @types/react-dom`;
    console.log(installDevDepsCommand);
    execSync(installDevDepsCommand, {cwd: process.cwd(), stdio: 'inherit'});

    execSync(`mkdir -p src`, {cwd: process.cwd()});
    writeFileSync(`${process.cwd()}/src/index.tsx`, exampleString);
    console.log('Created application entrypoint src/index.tsx');

    // Create CLAUDE.md for Claude Code agents
    const claudeMdContent = `# Springboard Development Guide

This application is built with the **Springboard framework**.

## Getting Started

**Before writing any code, run:**

\`\`\`bash
npx sb docs context
\`\`\`

This command outputs comprehensive framework information including all available
documentation sections. It's the single command you need to start working efficiently.

## Recommended Workflow

1. **Run \`sb docs context\`** at the start of your session
   - This gives you everything: framework overview, available docs, and workflow guidance
   - You don't need to run \`sb docs list\` separately

2. **Write code** using your knowledge + the context from step 1

3. **Fetch specific docs** only when needed:
   - \`sb docs get <section>\` - Use section names from the context output

4. **View examples** for reference code:
   - \`sb docs examples list\` - See available examples
   - \`sb docs examples show <name>\` - View example code

## Other Useful Commands

- \`sb docs --help\` - See all available commands
- \`sb docs types\` - Get TypeScript type definitions
`;
    writeFileSync(`${process.cwd()}/CLAUDE.md`, claudeMdContent);
    console.log('Created CLAUDE.md with AI agent instructions');

    // Create AGENTS.md for other AI coding assistants
    const agentsMdContent = `# AI Agent Instructions

This application is created with the **Springboard framework**.

## Before You Start

Run this command to get comprehensive framework information:

\`\`\`bash
npx sb docs context
\`\`\`

This single command provides:
- Framework overview and key concepts
- Full list of available documentation sections with use cases
- Recommended workflow for AI agents
- Everything you need to start coding

## Important

Please lean on the \`sb docs\` commands to make sure the code you're writing is correct and uses the framework as intended.

### Recommended Workflow

1. **Start with context**: Run \`sb docs context\` (includes full docs list)
2. **Write code**: Use your knowledge + the context from step 1
3. **Fetch docs when needed**: Use \`sb docs get <section>\` for specific topics
4. **View examples**: Use \`sb docs examples show <name>\` for reference code

### Other Commands

- \`sb docs --help\` - See all available commands
- \`sb docs types\` - Get TypeScript type definitions
- \`sb docs examples list\` - See available example modules
`;
    writeFileSync(`${process.cwd()}/AGENTS.md`, agentsMdContent);
    console.log('Created AGENTS.md with AI agent instructions');

    const packageJsonPath = `${process.cwd()}/package.json`;
    const packageJson = JSON.parse(readFileSync(packageJsonPath).toString());
    packageJson.scripts = {
        ...packageJson.scripts,
        'dev': 'sb dev src/index.tsx',
        'build': 'sb build src/index.tsx',
        'start': 'sb start',
    };

    writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

    console.log('Project created successfully! Run the following to start the development server:\n');
    console.log('npm run dev\n');
});

if (!(globalThis as any).AVOID_PROGRAM_PARSE) {
    program.parse();
}
