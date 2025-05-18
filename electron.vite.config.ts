import react from '@vitejs/plugin-react';
import { externalizeDepsPlugin, UserConfig } from 'electron-vite';
import { resolve } from 'path';

const config: UserConfig = {
    main: {
        plugins: [externalizeDepsPlugin()],
    },
    preload: {
        plugins: [externalizeDepsPlugin()],
    },
    renderer: {
        css: {
            modules: {
                generateScopedName: '[name]__[local]__[hash:base64:5]',
                localsConvention: 'camelCase',
            },
        },
        plugins: [react()],
        resolve: {
            alias: {
                '/@/i18n': resolve('src/i18n'),
                '/@/main': resolve('src/main'),
                '/@/renderer': resolve('src/renderer'),
                '/@/renderer/api': resolve('src/renderer/api'),
                '/@/renderer/components': resolve('src/renderer/components'),
                '/@/renderer/features': resolve('src/renderer/features'),
                '/@/renderer/hooks': resolve('src/renderer/hooks'),
                '/@/shared': resolve('src/shared'),
            },
        },
    },
};

export default config;
