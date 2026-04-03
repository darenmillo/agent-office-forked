// src/debug/ConsoleCapture.ts
// Intercepts console.error, console.warn, window.onerror, and unhandledrejection.
// Maintains a circular buffer of the last 50 entries.
// Exposes getErrors(), clearErrors(), and onError() hook.

export interface ErrorEntry {
    timestamp: number;
    level: 'error' | 'warn' | 'unhandled' | 'rejection';
    message: string;
    stack?: string;
    source?: string;
}

type ErrorHandler = (entry: ErrorEntry) => void;

const MAX_BUFFER = 50;

class ConsoleCapture {
    private buffer: (ErrorEntry | undefined)[] = new Array(MAX_BUFFER);
    private writePtr = 0;
    private count = 0;
    private handlers: ErrorHandler[] = [];

    constructor() {
        this._patchConsole();
        this._patchWindow();
    }

    private _push(entry: ErrorEntry): void {
        this.buffer[this.writePtr] = entry;
        this.writePtr = (this.writePtr + 1) % MAX_BUFFER;
        if (this.count < MAX_BUFFER) this.count++;
        for (const h of this.handlers) {
            try { h(entry); } catch (_) { /* never throw from within capture */ }
        }
    }

    private _patchConsole(): void {
        const origError = console.error.bind(console);
        const origWarn = console.warn.bind(console);

        console.error = (...args: unknown[]) => {
            origError(...args);
            const errObj = args.find((a): a is Error => a instanceof Error);
            const msg = args
                .map(a => (a instanceof Error ? a.message : String(a)))
                .join(' ');
            this._push({ timestamp: Date.now(), level: 'error', message: msg, stack: errObj?.stack });
        };

        console.warn = (...args: unknown[]) => {
            origWarn(...args);
            const msg = args
                .map(a => (a instanceof Error ? a.message : String(a)))
                .join(' ');
            this._push({ timestamp: Date.now(), level: 'warn', message: msg });
        };
    }

    private _patchWindow(): void {
        window.onerror = (message, source, lineno, colno, error) => {
            const msg = typeof message === 'string' ? message : String(message);
            this._push({
                timestamp: Date.now(),
                level: 'unhandled',
                message: msg,
                stack: error?.stack,
                source: source ? `${source}:${lineno}:${colno}` : undefined,
            });
            return false; // returning false keeps error visible in DevTools
        };

        window.onunhandledrejection = (event: PromiseRejectionEvent) => {
            const reason = event.reason;
            const msg = reason instanceof Error ? reason.message : String(reason);
            this._push({
                timestamp: Date.now(),
                level: 'rejection',
                message: msg,
                stack: reason instanceof Error ? reason.stack : undefined,
            });
        };
    }

    /** Returns all buffered entries, oldest first. */
    getErrors(): ErrorEntry[] {
        if (this.count < MAX_BUFFER) {
            return this.buffer.slice(0, this.count) as ErrorEntry[];
        }
        // Buffer has wrapped — stitch from writePtr
        const tail = this.buffer.slice(this.writePtr) as ErrorEntry[];
        const head = this.buffer.slice(0, this.writePtr) as ErrorEntry[];
        return [...tail, ...head];
    }

    clearErrors(): void {
        this.buffer = new Array(MAX_BUFFER);
        this.writePtr = 0;
        this.count = 0;
    }

    /**
     * Register a callback invoked for every new captured entry.
     * Returns an unsubscribe function.
     */
    onError(handler: ErrorHandler): () => void {
        this.handlers.push(handler);
        return () => {
            this.handlers = this.handlers.filter(h => h !== handler);
        };
    }
}

export const consoleCapture = new ConsoleCapture();

// Accessible from browser DevTools: window.__agentErrors.getErrors()
declare global {
    interface Window { __agentErrors: ConsoleCapture; }
}
window.__agentErrors = consoleCapture;
