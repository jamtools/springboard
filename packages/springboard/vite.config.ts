import path from 'path';
import {defineConfig} from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [
        react(),
    ],
    resolve: {
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    },
    ssr: {
        noExternal: ['@testing-library/jest-dom', 'redent'],
    },
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: path.resolve(__dirname, './vitest.setup.ts'),
        testTimeout: 1000 * 60,
        cache: false,
        server: {
            deps: {
                inline: true,
            },
        },
    },
});
