/** THE CASTER BUG — renderer: WS client + five DOM elements, nothing else.
 *
 * Connects to the engine's EXISTING broadcast (ws://localhost:4000/ws — the
 * same feed the dashboard consumes; zero backend change). Survives the
 * engine being down: reconnects with backoff and renders the offline chip.
 */

import { computeStrip, fmtClock, pruneRecs } from './strip';
import { RAIJIN_WS, Recommendation, StanceData, TimerRailData, UIUpdate, stanceColor } from './types';

const RECONNECT_MS = 3_000;
const RENDER_MS = 1_000;

let recs: Recommendation[] = [];
let stance: StanceData | null = null;
let timers: TimerRailData | null = null;
let lastMessageAt: number | null = null;

function el(id: string): HTMLElement {
    const node = document.getElementById(id);
    if (!node) throw new Error(`overlay.html is missing #${id}`);
    return node;
}

function onMessage(raw: string): void {
    let msg: UIUpdate;
    try {
        msg = JSON.parse(raw);
    } catch {
        return; // malformed frame — ignore, never crash the strip
    }
    lastMessageAt = Date.now();
    switch (msg.type) {
        case 'recommendations': {
            const incoming = (msg.data?.recommendations ?? msg.data) as unknown;
            const list = Array.isArray(incoming) ? incoming : [incoming];
            for (const r of list) {
                if (r && typeof r === 'object' && typeof (r as Recommendation).title === 'string') {
                    recs.push({ ...(r as Recommendation), receivedAt: Date.now() });
                }
            }
            recs = pruneRecs(recs, Date.now());
            break;
        }
        case 'stance':
            stance = msg.data as unknown as StanceData;
            break;
        case 'timers':
            timers = msg.data as unknown as TimerRailData;
            break;
        case 'game_ended':
            recs = [];
            stance = null;
            timers = null;
            break;
        default:
            break; // hero_status etc. only matter as liveness, captured above
    }
    render();
}

function connect(): void {
    let ws: WebSocket;
    try {
        ws = new WebSocket(RAIJIN_WS);
    } catch {
        setTimeout(connect, RECONNECT_MS);
        return;
    }
    ws.onmessage = ev => onMessage(String(ev.data));
    ws.onclose = () => setTimeout(connect, RECONNECT_MS);
    ws.onerror = () => {
        try {
            ws.close();
        } catch {
            /* already closed */
        }
    };
}

function render(): void {
    const state = computeStrip({ recs, stance, timers, lastMessageAt, now: Date.now() });
    const root = el('strip');
    const dot = el('dot');
    const stanceEl = el('stance');
    const directive = el('directive');
    const why = el('why');
    const timer = el('timer');

    root.classList.toggle('offline', !state.connected);
    root.classList.toggle('critical', state.critical);

    if (!state.connected) {
        dot.title = 'engine offline';
        stanceEl.textContent = '';
        directive.textContent = 'RAIJIN OFFLINE';
        why.textContent = 'waiting for the engine on :4000';
        timer.textContent = '';
        root.style.setProperty('--stance', '#8A94A6');
        return;
    }

    const color = stanceColor(state.stance?.stance ?? null);
    root.style.setProperty('--stance', color);
    stanceEl.textContent = state.stance?.stance ?? '';

    if (state.action) {
        directive.textContent = state.action.title;
        why.textContent = state.action.reason || state.action.body || '';
    } else {
        directive.textContent = state.stance?.stance ? `${state.stance.stance} — stay on plan` : 'No call right now';
        why.textContent = state.stance?.reason ?? '';
    }

    timer.textContent =
        state.nextTimer && state.countdown !== null
            ? `${state.nextTimer.label} ${fmtClock(state.countdown)}`
            : '';
}

connect();
render();
setInterval(render, RENDER_MS); // countdowns + freshness decay tick
