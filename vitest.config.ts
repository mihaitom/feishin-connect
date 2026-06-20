import path from 'path';
import { defineConfig } from 'vitest/config';

import { createReactPlugin } from './vite.react-plugin';

export default defineConfig({
    plugins: [createReactPlugin()],
    resolve: {
        alias: {
            '/@/i18n': path.resolve(__dirname, './src/i18n'),
            '/@/remote': path.resolve(__dirname, './src/remote'),
            '/@/renderer': path.resolve(__dirname, './src/renderer'),
            '/@/shared': path.resolve(__dirname, './src/shared'),
        },
    },
    test: {
        environment: 'jsdom',
        globals: true,
        include: ['src/**/*.test.{ts,tsx}'],
        setupFiles: ['./vitest.setup.ts'],
    },
});
