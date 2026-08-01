import path from 'path';

import {defineConfig} from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
    plugins: [
        react(),
        tsconfigPaths(),
    ],
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: path.resolve(__dirname, 'vitest.setup.ts'),
        testTimeout: 1000 * 60,
        cache: false,
    },
});
