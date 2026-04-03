// src/debug/ErrorOverlay.ts
// Lightweight DOM overlay — fixed bottom-right corner.
// Toggle with backtick (`) key or by clicking the badge.
// Shows last 10 errors: timestamp + message + first 2 stack frames.
// Appended to document.body (not #ui-root) so pointer-events stays independent.

import { consoleCapture, ErrorEntry } from './ConsoleCapture';

const MAX_DISPLAY = 10;

function formatTime(ts: number): string {
    const d = new Date(ts);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
}

function firstTwoFrames(stack?: string): string {
    if (!stack) return '';
    const lines = stack.split('\n').filter(l => l.trim().startsWith('at '));
    return lines.slice(0, 2).join('\n');
}

const LEVEL_COLOR: Record<string, string> = {
    error: '#ff6b6b',
    warn: '#ffd93d',
    unhandled: '#ff6b6b',
    rejection: '#ff6b6b',
};

class ErrorOverlay {
    private container: HTMLElement | null = null;
    private badge: HTMLElement | null = null;
    private panel: HTMLElement | null = null;
    private list: HTMLElement | null = null;
    private panelVisible = false;
    private mounted = false;

    /** Call once after the DOM is ready (after setupPhaser). */
    mount(): void {
        if (this.mounted) return;
        this.mounted = true;

        // Root container — sits outside #ui-root so Phaser and React don't touch it
        this.container = document.createElement('div');
        Object.assign(this.container.style, {
            position: 'fixed',
            bottom: '16px',
            right: '16px',
            zIndex: '9999',
            fontFamily: 'monospace',
            fontSize: '12px',
            pointerEvents: 'auto',
        });
        document.body.appendChild(this.container);

        // ----- Panel (sits above badge) -----
        this.panel = document.createElement('div');
        Object.assign(this.panel.style, {
            display: 'none',
            background: 'rgba(10,10,30,0.93)',
            border: '1px solid #6c3483',
            borderRadius: '6px',
            padding: '10px',
            width: '480px',
            maxHeight: '60vh',
            overflowY: 'auto',
            color: '#dfe6e9',
            marginBottom: '6px',
            boxShadow: '0 0 18px rgba(108,52,131,0.45)',
        });

        // Panel header row
        const header = document.createElement('div');
        Object.assign(header.style, {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px',
            borderBottom: '1px solid #6c3483',
            paddingBottom: '6px',
        });
        const title = document.createElement('span');
        title.textContent = '🔴 Error Log';
        title.style.fontWeight = 'bold';

        const controls = document.createElement('div');
        controls.style.display = 'flex';
        controls.style.gap = '6px';
        controls.appendChild(this._btn('🗑 Clear', () => {
            consoleCapture.clearErrors();
            this._render();
        }));
        controls.appendChild(this._btn('✕', () => this._closePanel()));
        header.appendChild(title);
        header.appendChild(controls);
        this.panel.appendChild(header);

        // Error list area
        this.list = document.createElement('div');
        this.panel.appendChild(this.list);
        this.container.appendChild(this.panel);

        // ----- Badge -----
        this.badge = document.createElement('div');
        Object.assign(this.badge.style, {
            display: 'none',
            background: 'rgba(10,10,30,0.92)',
            border: '1px solid #6c3483',
            borderRadius: '4px',
            padding: '4px 10px',
            color: '#ff6b6b',
            cursor: 'pointer',
            userSelect: 'none',
        });
        this.badge.title = 'Click to toggle error panel  (or press `)';
        this.badge.addEventListener('click', () => this._togglePanel());
        this.container.appendChild(this.badge);

        // Backtick key toggles the panel
        document.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === '`' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                e.preventDefault();
                this._togglePanel();
            }
        });

        // Subscribe: any new captured error re-renders badge + open panel
        consoleCapture.onError(() => this._render());

        this._render();
    }

    private _btn(label: string, onClick: () => void): HTMLElement {
        const btn = document.createElement('button');
        btn.textContent = label;
        Object.assign(btn.style, {
            background: 'rgba(108,52,131,0.3)',
            border: '1px solid #6c3483',
            borderRadius: '3px',
            color: '#dfe6e9',
            padding: '2px 8px',
            cursor: 'pointer',
            fontFamily: 'monospace',
            fontSize: '11px',
        });
        btn.addEventListener('click', onClick);
        return btn;
    }

    private _togglePanel(): void {
        this.panelVisible = !this.panelVisible;
        if (this.panel) {
            this.panel.style.display = this.panelVisible ? 'block' : 'none';
        }
        if (this.panelVisible) this._render();
    }

    private _closePanel(): void {
        this.panelVisible = false;
        if (this.panel) this.panel.style.display = 'none';
    }

    private _render(): void {
        const errors = consoleCapture.getErrors();
        const count = errors.length;

        // Badge
        if (this.badge) {
            this.badge.style.display = count === 0 ? 'none' : 'block';
            if (count > 0) {
                this.badge.textContent = `🔴 ${count} error${count !== 1 ? 's' : ''}`;
            }
        }

        // Panel list — only update DOM when panel is open
        if (!this.panelVisible || !this.list) return;
        this.list.innerHTML = '';

        if (count === 0) {
            const empty = document.createElement('div');
            empty.style.color = '#888';
            empty.textContent = 'No errors captured.';
            this.list.appendChild(empty);
            return;
        }

        // Show last MAX_DISPLAY entries, newest first
        const display = errors.slice(-MAX_DISPLAY).reverse();
        for (const entry of display) {
            this.list.appendChild(this._entryRow(entry));
        }
    }

    private _entryRow(entry: ErrorEntry): HTMLElement {
        const row = document.createElement('div');
        Object.assign(row.style, {
            borderBottom: '1px solid rgba(108,52,131,0.3)',
            paddingBottom: '6px',
            marginBottom: '6px',
        });

        // Headline: [HH:MM:SS] [LEVEL] message
        const headline = document.createElement('div');
        headline.style.color = LEVEL_COLOR[entry.level] ?? '#dfe6e9';
        headline.style.wordBreak = 'break-all';
        headline.textContent =
            `[${formatTime(entry.timestamp)}] [${entry.level.toUpperCase()}] ${entry.message}`;
        row.appendChild(headline);

        // Optional source (window.onerror path)
        if (entry.source) {
            const src = document.createElement('div');
            src.style.color = '#aaa';
            src.style.fontSize = '11px';
            src.textContent = `  at ${entry.source}`;
            row.appendChild(src);
        }

        // First 2 stack frames
        const frames = firstTwoFrames(entry.stack);
        if (frames) {
            const pre = document.createElement('pre');
            Object.assign(pre.style, {
                color: '#888',
                margin: '2px 0 0 10px',
                fontSize: '11px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
            });
            pre.textContent = frames;
            row.appendChild(pre);
        }

        return row;
    }
}

export const errorOverlay = new ErrorOverlay();
