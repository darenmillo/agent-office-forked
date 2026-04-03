import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { playgroundWatcher } from './plugins/playgroundWatcher';

export default defineConfig({
    plugins: [
        react(),
        playgroundWatcher(),
    ],
    server: {
        port: 5173,
        proxy: {
            '/api': 'http://localhost:3000',
        }
    },
    build: {
        outDir: 'dist'
    }
});
