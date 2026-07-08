/** THE CASTER BUG — pure strip-state selection (the tested core).
 *
 * Mirrors the dashboard's `pacing.ts` semantics for the priority pick
 * (urgency outranks priority outranks recency; NOW-window freshness) but is
 * deliberately lean: the strip renders at most five elements, so the whole
 * job is "one stance, one action + why, one next timer, one connection dot".
 * No DOM, no Electron, no network in this module — jest runs it as-is.
 */

import { Recommendation, StanceData, TimerRailData, effectiveUrgency } from './types';

/** Priority actions are NOW actions — same window as pacing.pickPriorityAction. */
export const ACTION_WINDOW_MS = 120_000;

/** Engine silence longer than this renders the offline state. */
export const OFFLINE_AFTER_MS = 15_000;

const URGENCY_RANK: Record<string, number> = { CRITICAL: 2, IMPORTANT: 1, ROUTINE: 0 };

function score(rec: Recommendation): number {
    // Urgency dominates, then backend priority, then recency (newest wins ties).
    return URGENCY_RANK[effectiveUrgency(rec)] * 1_000_000 + rec.priority * 10_000 + rec.receivedAt / 1e9;
}

/** Highest-value fresh rec, or null when nothing is worth the player's eyes. */
export function pickAction(recs: Recommendation[], now: number): Recommendation | null {
    const fresh = recs.filter(r => now - (r.receivedAt ?? now) < ACTION_WINDOW_MS);
    if (!fresh.length) return null;
    return fresh.reduce((a, b) => (score(b) > score(a) ? b : a));
}

export interface NextTimer {
    label: string;
    /** Absolute game-clock seconds of the event. */
    at: number;
}

/** The single next upcoming objective from the timer rail (absolute clocks). */
export function nextObjective(t: TimerRailData | null): NextTimer | null {
    if (!t) return null;
    const clock = t.clock ?? 0;
    const candidates: NextTimer[] = [];
    if (typeof t.next_stack === 'number' && t.next_stack > clock) {
        candidates.push({ label: 'STACK', at: t.next_stack });
    }
    if (typeof t.next_power_rune === 'number' && t.next_power_rune > clock) {
        candidates.push({ label: 'RUNE', at: t.next_power_rune });
    }
    if (t.tormentor && t.tormentor.at !== null && t.tormentor.status !== 'up' && t.tormentor.at > clock) {
        candidates.push({ label: 'TORMENTOR', at: t.tormentor.at });
    }
    if (t.roshan) {
        if (t.roshan.status === 'dead' && t.roshan.early !== null && t.roshan.early > clock) {
            candidates.push({ label: 'ROSH EARLY', at: t.roshan.early });
        } else if (t.roshan.status === 'window' && t.roshan.late !== null && t.roshan.late > clock) {
            candidates.push({ label: 'ROSH LATE', at: t.roshan.late });
        }
    }
    if (!candidates.length) return null;
    return candidates.reduce((a, b) => (b.at < a.at ? b : a));
}

/** MM:SS from game-clock seconds (handles pre-horn negatives). */
export function fmtClock(seconds: number): string {
    const sign = seconds < 0 ? '-' : '';
    const s = Math.abs(Math.round(seconds));
    return `${sign}${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export interface StripState {
    connected: boolean;
    stance: StanceData | null;
    action: Recommendation | null;
    /** True when the shown action is CRITICAL — the strip border flashes. */
    critical: boolean;
    nextTimer: NextTimer | null;
    /** Countdown seconds to the next timer (>= 0), null when unknown. */
    countdown: number | null;
}

export interface StripInputs {
    recs: Recommendation[];
    stance: StanceData | null;
    timers: TimerRailData | null;
    lastMessageAt: number | null;
    now: number;
}

/** The whole strip, derived in one place. */
export function computeStrip(inputs: StripInputs): StripState {
    const { recs, stance, timers, lastMessageAt, now } = inputs;
    const connected = lastMessageAt !== null && now - lastMessageAt < OFFLINE_AFTER_MS;
    if (!connected) {
        return { connected: false, stance: null, action: null, critical: false, nextTimer: null, countdown: null };
    }
    const action = pickAction(recs, now);
    const nextTimer = nextObjective(timers);
    const countdown =
        nextTimer && timers ? Math.max(0, Math.round(nextTimer.at - (timers.clock ?? 0))) : null;
    return {
        connected: true,
        stance,
        action,
        critical: action !== null && effectiveUrgency(action) === 'CRITICAL',
        nextTimer,
        countdown,
    };
}

/** Drop recs outside the NOW window so state can't grow unbounded. */
export function pruneRecs(recs: Recommendation[], now: number): Recommendation[] {
    return recs.filter(r => now - (r.receivedAt ?? now) < ACTION_WINDOW_MS);
}
