import path from 'path';
import {defineConfig, mergeConfig} from 'vitest/config';

import config from '../../../configs/vite.config';

export default mergeConfig(config, defineConfig({
    resolve: {
        alias: [
            {
                find: /^@jamtools\/core$/,
                replacement: path.resolve(__dirname, 'src/index.ts'),
            },
            {
                find: /^@jamtools\/core\/(.*)$/,
                replacement: path.resolve(__dirname, 'src/$1'),
            },
        ],
    },
}));
