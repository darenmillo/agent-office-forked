import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Standalone Raijin board build (Track-4 D2/D3) — deployed to
// ai-agents/ui/raijin/ and served by bot_manager at :5050/raijin/raijin.html.
// base './' keeps asset URLs relative so the bundle works from any mount path.
// No playgroundWatcher here: that plugin is dev-server middleware only.
export default defineConfig({
    plugins: [react()],
    base: './',
    // Office sprites (public/) are not used by the Raijin board — hero
    // portraits come from the Steam CDN. Keep the bundle sprite-free.
    publicDir: false,
    build: {
        outDir: 'dist-raijin',
        emptyOutDir: true,
        rollupOptions: {
            input: 'raijin.html',
        },
    },
});
