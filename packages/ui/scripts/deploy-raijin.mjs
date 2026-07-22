// Copies the standalone Raijin build (dist-raijin/) into ai-agents/ui/raijin/,
// where bot_manager serves it as the :5050 RAIJIN tab. Run via `npm run deploy:raijin`.
import { cpSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, '..', 'dist-raijin');
const dest = resolve(here, '..', '..', '..', '..', 'ai-agents', 'ui', 'raijin');

if (!existsSync(src)) {
    console.error('dist-raijin/ not found — run `npm run build:raijin` first.');
    process.exit(1);
}

rmSync(dest, { recursive: true, force: true });
cpSync(src, dest, { recursive: true });
console.log(`Deployed standalone Raijin build -> ${dest}`);
