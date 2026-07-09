/** CONSOLE board logic — pure, testable functions behind the zone components.
 *
 * Data honesty is the law here: nothing in this module invents a reading.
 * Gold targets are parsed out of real rec text (null when absent), the gap
 * series only accumulates values that arrived over the wire, and tape events
 * are derived from the same TimerRailData the old rail rendered.
 */
import { DeathVerdict, Recommendation, TimerRailData } from './raijinTypes';
import { ageWindow } from './pacing';

export const TAPE_HORIZON_S = 180;
/** Events further out than this are hidden until they enter the horizon. */
export const TAPE_VISIBLE_MAX_S = 175;
/** Labels past this % of the tape right-anchor so they never clip. */
export const TAPE_RIGHT_ANCHOR_PCT = 82;

/** Position on the tape as a 0–100 percentage of the 180s horizon. */
export function tapePct(secondsUntil: number): number {
    return Math.max(0, Math.min(100, (secondsUntil / TAPE_HORIZON_S) * 100));
}

/** Right-anchor labels near the tape's right edge (README §08). */
export function tapeRightAnchor(secondsUntil: number): boolean {
    return tapePct(secondsUntil) > TAPE_RIGHT_ANCHOR_PCT;
}

/** An event renders only while inside the visible horizon. */
export function tapeEventVisible(secondsUntil: number): boolean {
    return secondsUntil > 0 && secondsUntil <= TAPE_VISIBLE_MAX_S;
}

/** m:ss with clamping — the console never shows negative countdowns. */
export function fmtMSS(sec: number): string {
    const s = Math.max(0, Math.round(sec));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Extrapolate the live game clock from the last absolute snapshot. */
export function extrapolatedClock(
    snapshotClock: number,
    receivedAtMs: number,
    nowMs: number,
): number {
    return snapshotClock + Math.floor((nowMs - receivedAtMs) / 1000);
}

// ── Gold-target tracking (Zone 01 progress + tape item ETA) ────────────

export interface GoldTarget {
    /** Item/directive label straight from the rec title. */
    label: string;
    /** Gold cost from the rec's meta (preferred) or its own text — never hardcoded. */
    cost: number;
    /** category|title key of the source rec. */
    recKey: string;
    /** CDN item slug when the engine supplied structured meta. */
    slug?: string;
}

const COST_RE = /(\d{3,5})\s*(?:g|gold)\b/i;

/** Track the top fresh ITEM rec. Wave 2: the engine's structured `meta.cost`
 *  is authoritative when present (also yields the CDN slug); the regex over
 *  the rec's own text remains as the fallback for meta-less engines. A gold
 *  target still only exists when the rec itself stated a cost — no invented
 *  prices, ever. */
export function extractGoldTarget(
    recs: Recommendation[],
    nowMs: number,
): GoldTarget | null {
    const items = recs
        .filter(r => r.category === 'ITEM')
        .filter(r => nowMs - (r.receivedAt ?? nowMs) < ageWindow(r))
        .sort((a, b) => b.priority - a.priority || (b.receivedAt ?? 0) - (a.receivedAt ?? 0));
    for (const rec of items) {
        const metaCost = typeof rec.meta?.cost === 'number' ? rec.meta.cost : null;
        if (metaCost !== null && metaCost >= 100) {
            return {
                label: rec.title,
                cost: metaCost,
                recKey: `${rec.category}|${rec.title}`,
                slug: typeof rec.meta?.item === 'string' ? rec.meta.item : undefined,
            };
        }
        const text = `${rec.title} ${rec.reason ?? ''} ${rec.body}`;
        const m = COST_RE.exec(text);
        if (m) {
            const cost = parseInt(m[1], 10);
            if (cost >= 100) {
                return { label: rec.title, cost, recKey: `${rec.category}|${rec.title}` };
            }
        }
    }
    return null;
}

/** Seconds until the target is affordable at the current income. Null when
 *  already affordable or income is unknown/zero. */
export function goldEtaSeconds(
    target: GoldTarget,
    gold: number,
    gpm: number,
): number | null {
    if (gold >= target.cost) return 0;
    if (!gpm || gpm <= 0) return null;
    return ((target.cost - gold) / gpm) * 60;
}

// ── Gap series (Zone 04) ───────────────────────────────────────────────

export interface GapPoint {
    /** Game minute bucket. */
    min: number;
    /** Cumulative gold earned proxy (gpm × minutes) — labeled honestly. */
    you: number | null;
    /** Enemy net worth from GC intel (null until intel covers the minute). */
    enemy: number | null;
    /** True when the player died during this minute (deaths counter moved). */
    death: boolean;
}

export function bucketMinute(clockTimeSeconds: number): number {
    return Math.max(0, Math.floor(clockTimeSeconds / 60));
}

/** GSI exposes gold + gpm, not net worth. gpm × elapsed minutes is the honest
 *  derivable curve — the chart labels it GOLD EARNED, not NET WORTH. */
export function goldEarnedProxy(gpm: number, gameTimeSeconds: number): number {
    if (!gpm || gpm <= 0 || gameTimeSeconds <= 0) return 0;
    return Math.round(gpm * (gameTimeSeconds / 60));
}

/** Append/refresh a minute bucket. Values only ever come from live payloads;
 *  within a minute the latest reading wins. Returns a new array only when
 *  something changed (referential stability for React memos). */
export function upsertGapPoint(
    series: GapPoint[],
    min: number,
    patch: Partial<Pick<GapPoint, 'you' | 'enemy'>> & { death?: boolean },
): GapPoint[] {
    const idx = series.findIndex(p => p.min === min);
    if (idx === -1) {
        const point: GapPoint = {
            min,
            you: patch.you ?? null,
            enemy: patch.enemy ?? null,
            death: patch.death ?? false,
        };
        return [...series, point].sort((a, b) => a.min - b.min);
    }
    const cur = series[idx];
    const next: GapPoint = {
        ...cur,
        you: patch.you ?? cur.you,
        enemy: patch.enemy ?? cur.enemy,
        death: cur.death || (patch.death ?? false),
    };
    if (next.you === cur.you && next.enemy === cur.enemy && next.death === cur.death) {
        return series;
    }
    const copy = [...series];
    copy[idx] = next;
    return copy;
}

/** Latest gap (enemy − you) across buckets where both readings exist.
 *  Mixed sources (NW vs gold-earned) — callers must caption it as approx. */
export function latestGap(series: GapPoint[]): { min: number; gap: number } | null {
    for (let i = series.length - 1; i >= 0; i--) {
        const p = series[i];
        if (p.you !== null && p.enemy !== null) return { min: p.min, gap: p.enemy - p.you };
    }
    return null;
}

/** Gap slope per minute over the last two dual-reading buckets. */
export function gapSlopePerMin(series: GapPoint[]): number | null {
    const dual = series.filter(p => p.you !== null && p.enemy !== null);
    if (dual.length < 2) return null;
    const a = dual[dual.length - 2];
    const b = dual[dual.length - 1];
    const dm = b.min - a.min;
    if (dm <= 0) return null;
    return ((b.enemy! - b.you!) - (a.enemy! - a.you!)) / dm;
}

// ── Tape events (Zone 08) ──────────────────────────────────────────────

export type TapeTone = 'blue' | 'amber' | 'gold' | 'dire';

export interface TapeEvent {
    key: string;
    label: string;
    tone: TapeTone;
    secondsUntil: number;
}

export interface RoshTapeState {
    state: 'pending' | 'open';
    secondsUntil: number; // 0 when open
}

/** Roshan on the tape: a pending window drifts in as a gold band; an open
 *  window re-anchors at NOW in dire. Unknown/up states render nothing. */
export function roshTapeState(
    rail: TimerRailData | null,
    clock: number,
): RoshTapeState | null {
    const r = rail?.roshan;
    if (!r) return null;
    if (r.status === 'window') return { state: 'open', secondsUntil: 0 };
    if (r.status === 'dead' && r.early !== null && r.early !== undefined) {
        const until = r.early - clock;
        if (until <= 0) return { state: 'open', secondsUntil: 0 };
        return { state: 'pending', secondsUntil: until };
    }
    return null;
}

/** Merge TimerRailData + the live item ETA into positioned tape events.
 *  Roshan is handled separately (band rendering) via roshTapeState. */
export function deriveTapeEvents(
    rail: TimerRailData | null,
    clock: number,
    itemEta: { label: string; seconds: number } | null,
): TapeEvent[] {
    const events: TapeEvent[] = [];
    if (rail) {
        if (rail.next_stack !== undefined) {
            events.push({ key: 'stack', label: 'STACK', tone: 'blue', secondsUntil: rail.next_stack - clock });
        }
        if (rail.next_power_rune !== undefined) {
            events.push({ key: 'rune', label: 'RUNE', tone: 'blue', secondsUntil: rail.next_power_rune - clock });
        }
        if (rail.next_bounty !== undefined) {
            events.push({ key: 'bounty', label: 'BOUNTY', tone: 'blue', secondsUntil: rail.next_bounty - clock });
        }
        if (rail.tormentor && rail.tormentor.status !== 'up' && rail.tormentor.at !== null && rail.tormentor.at !== undefined) {
            events.push({ key: 'tormentor', label: 'TORMENTOR', tone: 'blue', secondsUntil: rail.tormentor.at - clock });
        }
        if (rail.aegis?.expires_at !== undefined) {
            events.push({ key: 'aegis', label: 'AEGIS EXPIRES', tone: 'dire', secondsUntil: rail.aegis.expires_at - clock });
        }
    }
    if (itemEta && itemEta.seconds > 0) {
        events.push({
            key: 'item-eta',
            label: `${itemEta.label.toUpperCase()} ≈${fmtMSS(itemEta.seconds)}`,
            tone: 'amber',
            secondsUntil: itemEta.seconds,
        });
    }
    return events
        .filter(e => tapeEventVisible(e.secondsUntil))
        .sort((a, b) => a.secondsUntil - b.secondsUntil);
}

// ── Wave 2: LLM read kinds, death verdicts, winnability, CHECK-IN ──────

export type LlmKind = 'ambient' | 'checkin' | 'closing' | 'death-analysis';

/** Classify an LLM rec by its tags; null for rule-based recs. */
export function llmKind(rec: Recommendation): LlmKind | null {
    const tags = rec.tags ?? [];
    if (!tags.includes('llm')) return null;
    if (tags.includes('death') && tags.includes('analysis')) return 'death-analysis';
    if (tags.includes('checkin')) return 'checkin';
    if (tags.includes('closing')) return 'closing';
    if (tags.includes('ambient')) return 'ambient';
    return null;
}

export const LLM_KIND_LABEL: Record<LlmKind, string> = {
    ambient: 'AMBIENT READ',
    checkin: 'CHECK-IN',
    closing: 'CLOSING PLAN',
    'death-analysis': 'DEATH READ',
};

export interface VerdictBadge {
    label: string;
    /** console_ token name — TRADE is a win, never dire. */
    tone: 'radiant' | 'blue' | 'amber' | 'dire';
}

/** Trade-ledger verdict → badge. Unknown strings render nothing. */
export function verdictBadge(verdict: string | undefined | null): VerdictBadge | null {
    switch (verdict as DeathVerdict | undefined | null) {
        case 'TRADE': return { label: 'TRADE WON', tone: 'radiant' };
        case 'EVEN_TRADE': return { label: 'EVEN TRADE', tone: 'blue' };
        case 'FIGHT_DEATH': return { label: 'FIGHT DEATH', tone: 'amber' };
        case 'CAUGHT': return { label: 'CAUGHT', tone: 'dire' };
        default: return null;
    }
}

/** Winnability chip tone — informational, one alarm at a time (never pings). */
export function winnabilityTone(pWin: number): 'dire' | 'amber' | 'radiant' {
    if (pWin < 0.35) return 'dire';
    if (pWin < 0.55) return 'amber';
    return 'radiant';
}

export function fmtPct(p: number): string {
    return `${Math.round(Math.max(0, Math.min(1, p)) * 100)}%`;
}

/** CHECK-IN request lifecycle. `queued` flips back to idle when the answer
 *  rec lands or after the 90s give-up window — the button never wedges. */
export interface CheckinState {
    phase: 'idle' | 'queued';
    queuedAt: number | null;
}

export const CHECKIN_TIMEOUT_MS = 90_000;

export type CheckinEvent =
    | { type: 'fire'; now: number }
    | { type: 'landed' }
    | { type: 'error' }
    | { type: 'tick'; now: number };

export function checkinNext(state: CheckinState, ev: CheckinEvent): CheckinState {
    switch (ev.type) {
        case 'fire':
            return state.phase === 'queued' ? state : { phase: 'queued', queuedAt: ev.now };
        case 'landed':
        case 'error':
            return state.phase === 'idle' ? state : { phase: 'idle', queuedAt: null };
        case 'tick':
            if (state.phase === 'queued' && state.queuedAt !== null
                && ev.now - state.queuedAt > CHECKIN_TIMEOUT_MS) {
                return { phase: 'idle', queuedAt: null };
            }
            return state;
    }
}

// ── Wave 2: map projection (Zone 05) ───────────────────────────────────

/** Dota world-coordinate extent (both axes; symmetric around 0). */
export const WORLD_MIN = -8500;
export const WORLD_MAX = 8500;

/** Project world (x, y) onto a square map of `size` px. Dota's y points up;
 *  SVG's y points down — inverted here. Out-of-range values clamp to the edge. */
export function worldToMap(x: number, y: number, size: number): { x: number; y: number } {
    const norm = (v: number) => Math.max(0, Math.min(1, (v - WORLD_MIN) / (WORLD_MAX - WORLD_MIN)));
    return { x: norm(x) * size, y: (1 - norm(y)) * size };
}

/** Minute-indexed baseline array → chart points (nulls/gaps skipped). */
export function baselinePoints(series: ReadonlyArray<number | null> | null | undefined): Array<{ min: number; value: number }> {
    if (!series) return [];
    const out: Array<{ min: number; value: number }> = [];
    series.forEach((v, i) => {
        if (typeof v === 'number' && Number.isFinite(v)) out.push({ min: i, value: v });
    });
    return out;
}
