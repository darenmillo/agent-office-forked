/**
 * Vite plugin: Playground File Watcher
 *
 * Watches packages/ui/playground/ for file changes and exposes REST endpoints
 * so the Design Playground can list, load, and save files — plus get live
 * HMR notifications when another session writes a file to disk.
 *
 * Endpoints (dev-server only, prefix /_playground to avoid /api proxy):
 *   GET  /_playground/files          → JSON array of { name, modified }
 *   GET  /_playground/file/:name     → raw file content
 *   POST /_playground/save           → body: { name, content } → writes file
 */
import fs from 'fs';
import path from 'path';
import type { Plugin } from 'vite';

const PLAYGROUND_DIR = path.resolve(__dirname, '..', 'playground');
const ALLOWED_EXT = /\.(svg|html|css|tsx|jsx|json)$/i;

export function playgroundWatcher(): Plugin {
    return {
        name: 'playground-watcher',
        configureServer(server) {
            // Ensure directory exists
            if (!fs.existsSync(PLAYGROUND_DIR)) {
                fs.mkdirSync(PLAYGROUND_DIR, { recursive: true });
            }

            // ── Middleware ──
            server.middlewares.use((req, res, next) => {
                // List files
                if (req.method === 'GET' && req.url === '/_playground/files') {
                    try {
                        const files = fs.readdirSync(PLAYGROUND_DIR)
                            .filter(f => ALLOWED_EXT.test(f))
                            .map(f => {
                                const stat = fs.statSync(path.join(PLAYGROUND_DIR, f));
                                return { name: f, modified: stat.mtimeMs };
                            })
                            .sort((a, b) => b.modified - a.modified);
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify(files));
                    } catch (e: any) {
                        res.statusCode = 500;
                        res.end(JSON.stringify({ error: e.message }));
                    }
                    return;
                }

                // Get file content
                if (req.method === 'GET' && req.url?.startsWith('/_playground/file/')) {
                    const fileName = decodeURIComponent(req.url.slice('/_playground/file/'.length));
                    // Prevent directory traversal
                    if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
                        res.statusCode = 400;
                        res.end('Invalid filename');
                        return;
                    }
                    const filePath = path.join(PLAYGROUND_DIR, fileName);
                    if (!fs.existsSync(filePath)) {
                        res.statusCode = 404;
                        res.end('Not found');
                        return;
                    }
                    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                    res.end(fs.readFileSync(filePath, 'utf-8'));
                    return;
                }

                // Save file
                if (req.method === 'POST' && req.url === '/_playground/save') {
                    let body = '';
                    req.on('data', chunk => { body += chunk; });
                    req.on('end', () => {
                        try {
                            const { name, content } = JSON.parse(body);
                            if (!name || typeof content !== 'string') {
                                res.statusCode = 400;
                                res.end('Missing name or content');
                                return;
                            }
                            if (name.includes('..') || name.includes('/') || name.includes('\\')) {
                                res.statusCode = 400;
                                res.end('Invalid filename');
                                return;
                            }
                            fs.writeFileSync(path.join(PLAYGROUND_DIR, name), content, 'utf-8');
                            res.setHeader('Content-Type', 'application/json');
                            res.end(JSON.stringify({ ok: true, name }));
                        } catch (e: any) {
                            res.statusCode = 500;
                            res.end(JSON.stringify({ error: e.message }));
                        }
                    });
                    return;
                }

                next();
            });

            // ── File watcher → HMR custom event ──
            try {
                const watcher = fs.watch(PLAYGROUND_DIR, { recursive: false }, (event, filename) => {
                    if (filename && ALLOWED_EXT.test(filename)) {
                        server.ws.send({
                            type: 'custom',
                            event: 'playground:update',
                            data: { file: filename, event },
                        });
                    }
                });

                // Clean up on server close
                server.httpServer?.on('close', () => watcher.close());
            } catch {
                // fs.watch can fail on some platforms — non-fatal, polling fallback in UI
            }

            console.log(`  [playground] watching ${PLAYGROUND_DIR}`);
        },
    };
}
