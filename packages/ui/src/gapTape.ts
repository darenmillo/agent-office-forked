/** rc-audit R1 — pure logic for the Zone04 gap chart + Zone08 tape fixes.
 *
 *  Rows 15–23 + 45 of the R1 ledger. Data honesty carries over from
 *  console.ts: nothing here invents a reading — the gap trend is measured
 *  over a real bucket window (never an extrapolated per-minute rate), the
 *  legend describes only drawn series, and the win chip's memory ring only
 *  holds values that arrived over the wire.
 */
import { GapPoint, TapeEvent, RoshTapeState, tapePct, fmtMSS } from './console';
import { TimerRailData } from './raijinTypes';

// ── row 18 · win chip memory ───────────────────────────────────────────

/** Stratz-Playbook bucket vocabulary; thresholds match winnabilityTone. */
export type WinBucket = 'LIKELY LOSS' | 'COIN FLIP' | 'LIKELY WIN';

export function winBucket(p: number): WinBucket {
    if (p < 0.35) return 'LIKELY LOSS';
    if (p < 0.55) return 'COIN FLIP';
    return 'LIKELY WIN';
}

export interface WinSample {
    /** Monotonic sample index (x on the sparkline). */
    x: number;
    p: number;
}

export const WIN_RING_CAP = 20;
/** Readings closer than this are the same sample (winnability re-broadcasts). */
const WIN_EPSILON = 0.005;

/** Append a reading to the ring when it actually moved; same ref otherwise
 *  (referential stability for React memos). Oldest sample drops at the cap. */
export function pushWinSample(ring: WinSample[], p: number, cap = WIN_RING_CAP): WinSample[] {
    const last = ring[ring.length - 1];
    if (last && Math.abs(last.p - p) < WIN_EPSILON) return ring;
    const next = [...ring, { x: last ? last.x + 1 : 0, p }];
    return next.length > cap ? next.slice(next.length - cap) : next;
}

/** Δ in percentage points vs the previous sample; null until two samples. */
export function winDelta(ring: WinSample[]): number | null {
    if (ring.length < 2) return null;
    return Math.round((ring[ring.length - 1].p - ring[ring.length - 2].p) * 100);
}

/** Polyline points for the micro-sparkline; null until two samples. */
export function sparkPoints(ring: WinSample[], w: number, h: number): string | null {
    if (ring.length < 2) return null;
    const x0 = ring[0].x;
    const span = Math.max(1, ring[ring.length - 1].x - x0);
    return ring
        .map(s => `${(((s.x - x0) / span) * w).toFixed(1)},${((1 - s.p) * (h - 2) + 1).toFixed(1)}`)
        .join(' ');
}

// ── row 17 · honest gap trend ──────────────────────────────────────────

export interface GapTrend {
    direction: 'GROWING' | 'CLOSING' | 'FLAT';
    /** Measured |gap| change in gold over spanMin — null when no honest window. */
    deltaGold: number | null;
    spanMin: number | null;
}

/** Below this |gap| change the trend reads FLAT (noise floor). */
const TREND_DEAD_ZONE_G = 60;
const WINDOW_MIN = 2;
const WINDOW_MAX = 5;
const WINDOW_TARGET = 3;

/** Trend measured over a real 2–5 minute bucket window (closest to 3).
 *  Without such a window: direction from the last two buckets, no number.
 *  Never renders a per-minute rate — that was ledger row 17's fabrication. */
export function gapTrend(series: GapPoint[]): GapTrend | null {
    const dual = series.filter(p => p.you !== null && p.enemy !== null);
    if (dual.length < 2) return null;
    const b = dual[dual.length - 1];
    const gapOf = (p: GapPoint) => Math.abs(p.enemy! - p.you!);

    let best: GapPoint | null = null;
    for (let i = dual.length - 2; i >= 0; i--) {
        const span = b.min - dual[i].min;
        if (span < WINDOW_MIN || span > WINDOW_MAX) continue;
        if (best === null
            || Math.abs(span - WINDOW_TARGET) < Math.abs(b.min - best.min - WINDOW_TARGET)) {
            best = dual[i];
        }
    }

    const a = best ?? dual[dual.length - 2];
    const delta = gapOf(b) - gapOf(a);
    const direction: GapTrend['direction'] =
        Math.abs(delta) <= TREND_DEAD_ZONE_G ? 'FLAT' : delta > 0 ? 'GROWING' : 'CLOSING';
    if (best === null) return { direction, deltaGold: null, spanMin: null };
    return { direction, deltaGold: Math.round(Math.abs(delta)), spanMin: b.min - best.min };
}

// ── row 20 · drawn-only legend ─────────────────────────────────────────

export interface LegendEntry {
    id: 'you' | 'enemy' | 'enemy-await' | 'ghost' | 'median' | 'teamgold';
    kind: 'line' | 'dash' | 'strip' | 'note';
    label: string;
}

/** The legend describes only series that are actually drawn (row 20).
 *  An undrawn enemy line becomes one dim note — never a phantom swatch. */
export function legendEntries(input: {
    you: boolean; youLabel: string;
    enemy: boolean; enemyName: string | null;
    ghostLabel: string | null;
    median: boolean;
    teamGold: boolean; teamGoldLabel: string;
}): LegendEntry[] {
    const out: LegendEntry[] = [];
    if (input.you) out.push({ id: 'you', kind: 'line', label: input.youLabel });
    if (input.enemy) {
        out.push({ id: 'enemy', kind: 'line', label: `${(input.enemyName ?? 'ENEMY').toUpperCase()} · NET WORTH` });
    } else {
        out.push({ id: 'enemy-await', kind: 'note', label: 'AWAITING ENEMY INTEL' });
    }
    if (input.ghostLabel) out.push({ id: 'ghost', kind: 'dash', label: input.ghostLabel.toUpperCase() });
    if (input.median) out.push({ id: 'median', kind: 'dash', label: 'YOUR MEDIAN GAME' });
    if (input.teamGold) out.push({ id: 'teamgold', kind: 'strip', label: input.teamGoldLabel });
    return out;
}

// ── row 19 · death-mark clustering ─────────────────────────────────────

export interface MarkCluster {
    /** Mean x of the clustered marks (same units as the input). */
    x: number;
    count: number;
    mins: number[];
}

/** Transitive proximity clustering along x (input must be x-sorted or near). */
export function clusterByX(
    items: Array<{ x: number; min: number }>,
    minGap = 12,
): MarkCluster[] {
    const sorted = [...items].sort((a, b) => a.x - b.x);
    const clusters: Array<{ xs: number[]; mins: number[] }> = [];
    for (const it of sorted) {
        const cur = clusters[clusters.length - 1];
        if (cur && it.x - cur.xs[cur.xs.length - 1] <= minGap) {
            cur.xs.push(it.x);
            cur.mins.push(it.min);
        } else {
            clusters.push({ xs: [it.x], mins: [it.min] });
        }
    }
    return clusters.map(c => ({
        x: Math.round(c.xs.reduce((s, v) => s + v, 0) / c.xs.length),
        count: c.xs.length,
        mins: c.mins,
    }));
}

// ── row 16 · teach-once ────────────────────────────────────────────────

export type TeachState = 'hidden' | 'full' | 'collapsed';
export const TEACH_TTL_MS = 10_000;

/** The teaching annotation earns the plot exactly once: on the FIRST death,
 *  for TEACH_TTL_MS. Any later state (older game, more deaths, TTL passed)
 *  renders the collapsed ⓘ chip instead. */
export function teachState(
    deaths: number,
    fullShownAtMs: number | null,
    nowMs: number,
    ttlMs = TEACH_TTL_MS,
): TeachState {
    if (deaths <= 0) return 'hidden';
    if (deaths > 1) return 'collapsed';
    if (fullShownAtMs === null) return 'full';
    return nowMs - fullShownAtMs < ttlMs ? 'full' : 'collapsed';
}

// ── rows 21/22/23 · tape label layout ──────────────────────────────────

export interface TapeLabelPlacement {
    key: string;
    label: string;
    tone: TapeEvent['tone'];
    /** True event position — the tick never moves. */
    tickPct: number;
    /** Label left edge; > tickPct when crowd-shifted (leader tick drawn). */
    labelPct: number;
    lane: 'above' | 'below';
    leader: boolean;
    /** Dire threat classes (enemy spikes, aegis) get the band treatment. */
    band: boolean;
    secondsUntil: number;
}

/** Estimated label width in tape-% (11px mono on the ~1300px tape,
 *  deliberately conservative so narrow widths stay collision-free). */
export function tapeLabelWidthPct(label: string): number {
    return 2 + label.length * 0.65;
}

const LANE_MIN_GAP_PCT = 1.5;
/** Same-tone events this close in time merge into one label (row 21). */
const MERGE_WINDOW_PCT = 2.5;

function mergeCoTimed(events: TapeEvent[]): TapeEvent[] {
    const out: TapeEvent[] = [];
    for (const e of events) {
        const prev = out[out.length - 1];
        if (
            prev
            && prev.tone === e.tone
            && prev.key !== 'item-eta' && e.key !== 'item-eta'
            && Math.abs(tapePct(e.secondsUntil) - tapePct(prev.secondsUntil)) <= MERGE_WINDOW_PCT
        ) {
            out[out.length - 1] = {
                ...prev,
                key: `${prev.key}+${e.key}`,
                label: `${prev.label} + ${e.label}`,
            };
        } else {
            out.push({ ...e });
        }
    }
    return out;
}

function isBandKey(key: string): boolean {
    return key.split('+').some(k => k.startsWith('spike-') || k === 'aegis');
}

/** Deterministic two-lane label layout (row 21): alternating above/below,
 *  per-lane min-gap with leader ticks when a label must shift right, merged
 *  co-timed same-tone events, and a reservable above-left slot for the
 *  rosh-open banner. Ticks always mark the true event time. */
export function layoutTapeLabels(
    events: TapeEvent[],
    opts: { reserveAboveLeftPct?: number; singleLane?: boolean } = {},
): TapeLabelPlacement[] {
    const sorted = [...events].sort((a, b) => a.secondsUntil - b.secondsUntil);
    const merged = mergeCoTimed(sorted);
    const laneEnd: Record<'above' | 'below', number> = {
        above: opts.reserveAboveLeftPct ?? 0,
        below: 0,
    };
    const placements: TapeLabelPlacement[] = [];

    merged.forEach((e, i) => {
        const tick = tapePct(e.secondsUntil);
        const width = tapeLabelWidthPct(e.label);
        const preferred: 'above' | 'below' = opts.singleLane ? 'below' : (i % 2 === 1 ? 'above' : 'below');
        const other: 'above' | 'below' = preferred === 'above' ? 'below' : 'above';

        const fits = (lane: 'above' | 'below') => tick >= laneEnd[lane] + (laneEnd[lane] > 0 ? LANE_MIN_GAP_PCT : 0);
        const lane: 'above' | 'below' = opts.singleLane
            ? 'below'
            : fits(preferred) ? preferred : fits(other) ? other : preferred;

        let labelPct = tick;
        if (!fits(lane)) labelPct = laneEnd[lane] + LANE_MIN_GAP_PCT;
        // Right-edge clamp (the old translateX right-anchor, made layout-aware):
        // a label never overflows the tape; clamping left of the tick is the
        // anchored case and draws no leader.
        labelPct = Math.max(0, Math.min(labelPct, 100 - width));
        const leader = labelPct - tick > 0.5;
        laneEnd[lane] = labelPct + width;

        placements.push({
            key: e.key,
            label: e.label,
            tone: e.tone,
            tickPct: tick,
            labelPct,
            lane,
            leader,
            band: e.tone === 'dire' && isBandKey(e.key),
            secondsUntil: e.secondsUntil,
        });
    });
    return placements;
}

// ── row 23 · compressed tape ───────────────────────────────────────────

/** Laning-quiet tape (row 23): under three events and no rosh band, the
 *  tape compresses and cedes its pixels. Exported for the Director pass —
 *  RaijinConsole can call this with the same inputs it hands Zone08Tape. */
export function isTapeCompressed(events: TapeEvent[], rosh: RoshTapeState | null): boolean {
    return events.length < 3 && rosh === null;
}

// ── row 22 · late-game classes (defensive — absent fields = today) ─────

/** Seconds until an OPEN rosh window closes (roshan.late), when known. */
export function roshClosesIn(rail: TimerRailData | null, clock: number): number | null {
    const r = rail?.roshan;
    if (!r || r.status !== 'window' || r.late === null || r.late === undefined) return null;
    const until = r.late - clock;
    return until > 0 ? until : null;
}

/** Optional buyback block the engine may ship on the timers payload. */
export interface TapeBuyback {
    ready_at?: number;
    cost?: number;
}

/** Buyback cooldown as a gold tape event; nothing when absent or past. */
export function buybackTapeEvent(
    rail: (TimerRailData & { buyback?: TapeBuyback }) | null,
    clock: number,
): TapeEvent | null {
    const at = rail?.buyback?.ready_at;
    if (at === undefined) return null;
    const until = at - clock;
    if (until <= 0) return null;
    return {
        key: 'buyback',
        label: rail?.buyback?.cost ? `BUYBACK RDY (${rail.buyback.cost}G)` : 'BUYBACK RDY',
        tone: 'gold',
        secondsUntil: until,
    };
}

/** Honest trend caption (row 17): measured window or direction-only. */
export function gapTrendCaption(trend: GapTrend | null): string {
    if (!trend) return 'GAP';
    if (trend.deltaGold === null || trend.spanMin === null) {
        return trend.direction === 'FLAT' ? 'GAP · HOLDING' : `GAP · ${trend.direction}`;
    }
    if (trend.direction === 'FLAT') return 'GAP · HOLDING';
    return `GAP · ${trend.direction} ${trend.deltaGold}G / ${trend.spanMin}MIN`;
}

export function fmtCloses(seconds: number): string {
    return `CLOSES ${fmtMSS(seconds)}`;
}
