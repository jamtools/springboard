import {beforeEach, describe, expect, it, vi} from 'vitest';

const fileSystemMock = vi.hoisted(() => {
    const files = new Map<string, string>();

    class MockFile {
        readonly uri: string;

        constructor(...uris: Array<string | {uri: string}>) {
            this.uri = joinUris(...uris.map((uri) => typeof uri === 'string' ? uri : uri.uri));
        }

        get exists() {
            return files.has(this.uri);
        }

        async text() {
            const value = files.get(this.uri);
            if (value === undefined) {
                throw new Error(`Missing mock file: ${this.uri}`);
            }

            return value;
        }

        write(contents: string) {
            files.set(this.uri, contents);
        }

        async copy(destination: MockFile, options?: {overwrite?: boolean}) {
            const value = files.get(this.uri);
            if (value === undefined) {
                throw new Error(`Missing mock file: ${this.uri}`);
            }
            if (files.has(destination.uri) && options?.overwrite !== true) {
                throw new Error(`Mock destination exists: ${destination.uri}`);
            }

            files.set(destination.uri, value);
        }
    }

    return {
        files,
        MockFile,
        documentUri: 'file:///mock/document/',
    };
});

const assetMock = vi.hoisted(() => ({
    fromModule: vi.fn((moduleId: 'html' | 'css' | 'js') => ({
        localUri: `file:///mock/assets/${moduleId}`,
        downloadAsync: vi.fn(async () => undefined),
    })),
}));

vi.mock('expo-file-system', () => ({
    File: fileSystemMock.MockFile,
    Paths: {
        get document() {
            return {uri: fileSystemMock.documentUri};
        },
    },
}));

vi.mock('expo-asset', () => ({
    Asset: assetMock,
}));

const joinUris = (...parts: string[]) => {
    const [first = '', ...rest] = parts;
    return rest.reduce((current, part) => `${current.replace(/\/*$/, '')}/${part.replace(/^\/+/, '')}`, first);
};

describe('loadBundledWebAppAssets', () => {
    beforeEach(() => {
        fileSystemMock.files.clear();
        fileSystemMock.files.set(
            'file:///mock/assets/html',
            '<html><head><link rel="stylesheet" href="/dist/index-abc123.css"></head><body><script src="/dist/index-def456.js"></script></body></html>',
        );
        fileSystemMock.files.set('file:///mock/assets/css', 'body { color: #123; }');
        fileSystemMock.files.set('file:///mock/assets/js', 'window.loaded = true;');
        assetMock.fromModule.mockClear();
    });

    it('uses the Expo FileSystem document directory and writes local web assets', async () => {
        const {loadBundledWebAppAssets} = await import('./expo_bundled_web_asset_loader');

        const result = await loadBundledWebAppAssets({
            assetModules: {
                html: 'html',
                css: 'css',
                js: 'js',
            },
        });

        expect(result.htmlFilePath).toBe('file:///mock/document/index.html');
        expect(result.cssFilePath).toBe('file:///mock/document/index.css');
        expect(result.jsFilePath).toBe('file:///mock/document/index.js');
        expect(fileSystemMock.files.get('file:///mock/document/index.css')).toBe('body { color: #123; }');
        expect(fileSystemMock.files.get('file:///mock/document/index.js')).toBe('window.loaded = true;');
        expect(fileSystemMock.files.get('file:///mock/document/index.html')).toContain('file:///mock/document/index.css');
        expect(fileSystemMock.files.get('file:///mock/document/index.html')).toContain('file:///mock/document/index.js');
    });

    it('allows an explicit destination directory override', async () => {
        const {loadBundledWebAppAssets} = await import('./expo_bundled_web_asset_loader');

        const result = await loadBundledWebAppAssets({
            assetModules: {
                html: 'html',
                css: 'css',
                js: 'js',
            },
            destinationDirectory: 'file:///custom/output',
        });

        expect(result.htmlFilePath).toBe('file:///custom/output/index.html');
        expect(fileSystemMock.files.get('file:///custom/output/index.html')).toContain('file:///custom/output/index.css');
    });
});
