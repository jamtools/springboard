/**
 * Documentation system for Springboard CLI
 *
 * Provides documentation discovery and retrieval for AI coding agents.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

export interface DocSection {
    slug: string;
    title: string;
    use_cases: string;
}

export interface SectionsData {
    sections: DocSection[];
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const docsDir = __dirname;

/**
 * Load sections metadata
 */
export function getSections(): DocSection[] {
    const data = JSON.parse(
        readFileSync(join(docsDir, 'sections.json'), 'utf-8')
    ) as SectionsData;
    return data.sections;
}

/**
 * Get a section by slug
 */
export function getSection(slug: string): DocSection | undefined {
    const sections = getSections();
    return sections.find(s =>
        s.slug === slug ||
        s.slug.endsWith(`/${slug}`) ||
        s.title.toLowerCase() === slug.toLowerCase()
    );
}

/**
 * Get documentation content for a section
 */
export function getDocContent(slug: string): string | null {
    const section = getSection(slug);
    if (!section) return null;

    // Convert slug to filename: springboard/module-api -> springboard-module-api.md
    const filename = section.slug.replace(/\//g, '-') + '.md';

    try {
        return readFileSync(join(docsDir, 'content', filename), 'utf-8');
    } catch {
        return null;
    }
}

/**
 * List sections with their use_cases for display
 */
export function listSections(): { slug: string; title: string; use_cases: string }[] {
    return getSections().map(s => ({
        slug: s.slug,
        title: s.title,
        use_cases: s.use_cases
    }));
}

/**
 * Format sections list for output
 */
export function formatSectionsList(): string {
    const sections = listSections();
    return sections.map(s =>
        `${s.slug}\n  ${s.title}\n  Use cases: ${s.use_cases}`
    ).join('\n\n');
}
