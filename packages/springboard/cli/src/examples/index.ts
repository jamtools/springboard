/**
 * Springboard Example Modules
 *
 * These examples are bundled with the CLI package to help AI agents
 * understand common patterns in Springboard development.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

export interface Example {
    name: string;
    title: string;
    description: string;
    category: 'state' | 'actions' | 'routing' | 'patterns';
    tags: string[];
    code: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const examplesDir = __dirname;

export const examples: Example[] = [
    {
        name: 'basic-feature-module',
        title: 'Basic Feature Module',
        description: 'Simple feature module with shared state, actions, and routes. Good starting point for most features.',
        category: 'patterns',
        tags: ['shared-state', 'actions', 'routes', 'beginner'],
        code: readFileSync(join(examplesDir, 'basic-feature-module.txt'), 'utf-8'),
    },
    {
        name: 'persistent-state-module',
        title: 'Persistent State Module',
        description: 'Module using persistent state stored in database. Data survives app restarts and syncs across devices.',
        category: 'state',
        tags: ['persistent-state', 'database', 'settings'],
        code: readFileSync(join(examplesDir, 'persistent-state-module.txt'), 'utf-8'),
    },
    {
        name: 'user-agent-state-module',
        title: 'User Agent State Module',
        description: 'Module using localStorage-backed state. Perfect for device-specific UI preferences.',
        category: 'state',
        tags: ['user-agent-state', 'localStorage', 'ui-state'],
        code: readFileSync(join(examplesDir, 'user-agent-state-module.txt'), 'utf-8'),
    },
];

/**
 * Get an example by name
 */
export function getExample(name: string): Example | undefined {
    return examples.find((ex) => ex.name === name);
}

/**
 * Get examples by category
 */
export function getExamplesByCategory(category: Example['category']): Example[] {
    return examples.filter((ex) => ex.category === category);
}

/**
 * Get examples by tag
 */
export function getExamplesByTag(tag: string): Example[] {
    return examples.filter((ex) => ex.tags.includes(tag));
}

/**
 * List all examples with metadata (no code)
 */
export function listExamples(): Omit<Example, 'code'>[] {
    return examples.map(({ code, ...metadata }) => metadata);
}
