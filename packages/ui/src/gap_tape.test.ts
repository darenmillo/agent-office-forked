/** rc-audit R1 — Zone04 gap chart + Zone08 tape logic (rows 15–23, 45).
 *  Pure-logic tests for the new gapTape module: win-chip memory (row 18),
 *  honest gap trend (17), drawn-only legend (20), death-mark clustering (19),
 *  teach-once state (16), deterministic tape label layout (21), late-game
 *  classes (22), and the compressed-tape signal (23). */
import {
    winBucket,
    pushWinSample,
    winDelta,
    sparkPoints,
    gapTrend,
    legendEntries,
    clusterByX,
    teachState,
    layoutTapeLabels,
    tapeLabelWidthPct,
    isTapeCompressed,
    roshClosesIn,
    buybackTapeEvent,
    WinSample,
} from './gapTape';
import { GapPoint, TapeEvent } from './console';
import { TimerRailData } from './raijinTypes';

// ── row 18 · win chip memory ───────────────────────────────────────────

describe('winBucket (row 18 — Stratz Playbook vocabulary)', () => {
    test('buckets at the winnabilityTone thresholds', () => {
        expect(winBucket(0.08)).toBe('LIKELY LOSS');
        expect(winBucket(0.34)).toBe('LIKELY LOSS');
        expect(winBucket(0.35)).toBe('COIN FLIP');
        expect(winBucket(0.45)).toBe('COIN FLIP');
        expect(winBucket(0.55)).toBe('LIKELY WIN');
        expect(winBucket(0.9)).toBe('LIKELY WIN');
    });
});

describe('pushWinSample / winDelta / sparkPoints (row 18)', () => {
    test('appends only when the reading moved; same ref otherwise', () => {
        let ring: WinSample[] = [];
        ring = pushWinSample(ring, 0.39);
        expect(ring).toHaveLength(1);
        const same = pushWinSample(ring, 0.39);
        expect(same).toBe(ring); // referential stability for memos
        ring = pushWinSample(ring, 0.08);
        expect(ring).toHaveLength(2);
    });

    test('ring caps at 20 samples, dropping the oldest', () => {
        let ring: WinSample[] = [];
        for (let i = 0; i < 25; i++) ring = pushWinSample(ring, (i % 2 ? 0.2 : 0.7) + i * 0.001);
        expect(ring).toHaveLength(20);
    });

    test('delta is percentage points vs the previous sample', () => {
        let ring: WinSample[] = [];
        ring = pushWinSample(ring, 0.39);
        expect(winDelta(ring)).toBeNull();
        ring = pushWinSample(ring, 0.16);
        expect(winDelta(ring)).toBe(-23);
    });

    test('sparkline needs two samples; emits one point per sample', () => {
        let ring: WinSample[] = [];
        ring = pushWinSample(ring, 0.4);
        expect(sparkPoints(ring, 60, 16)).toBeNull();
        ring = pushWinSample(ring, 0.2);
        ring = pushWinSample(ring, 0.6);
        const pts = sparkPoints(ring, 60, 16)!;
        expect(pts.split(' ')).toHaveLength(3);
    });
});

// ── row 17 · honest gap trend ──────────────────────────────────────────

function gp(min: number, you: number | null, enemy: number | null, death = false): GapPoint {
    return { min, you, enemy, death };
}

describe('gapTrend (row 17 — measured window, never a fabricated rate)', () => {
    test('measures the delta over a real ~3-minute window', () => {
        const s = [gp(10, 5000, 6000), gp(11, 5400, 6700), gp(12, 5800, 7300), gp(13, 6000, 7800)];
        // |gap| goes 1000 → 1800 across 3 minutes
        expect(gapTrend(s)).toEqual({ direction: 'GROWING', deltaGold: 800, spanMin: 3 });
    });

    test('closing gap over the window reads CLOSING', () => {
        const s = [gp(20, 5000, 8000), gp(22, 6800, 8600), gp(23, 8000, 8500)];
        // |gap| 3000 → 500 over 3 min
        expect(gapTrend(s)).toEqual({ direction: 'CLOSING', deltaGold: 2500, spanMin: 3 });
    });

    test('no 2–5 min window → direction only, no number', () => {
        const s = [gp(12, 5000, 6000), gp(13, 5100, 6400)];
        const t = gapTrend(s)!;
        expect(t.direction).toBe('GROWING');
        expect(t.deltaGold).toBeNull();
        expect(t.spanMin).toBeNull();
    });

    test('fewer than two dual-reading buckets → null; ~flat within dead-zone → FLAT', () => {
        expect(gapTrend([gp(5, 1000, null), gp(6, null, 900)])).toBeNull();
        const flat = [gp(10, 5000, 6000), gp(13, 6020, 7040)]; // |gap| 1000 → 1020
        expect(gapTrend(flat)!.direction).toBe('FLAT');
    });
});

// ── row 20 · drawn-only legend ─────────────────────────────────────────

describe('legendEntries (row 20 — legend renders drawn series only)', () => {
    test('undrawn enemy collapses to one dim awaiting note; median absent when not drawn', () => {
        const entries = legendEntries({
            you: true, youLabel: 'YOU · NET WORTH',
            enemy: false, enemyName: null,
            ghostLabel: null, median: false,
            teamGold: false, teamGoldLabel: 'TEAM GOLD ADV (DELAYED)',
        });
        expect(entries.map(e => e.id)).toEqual(['you', 'enemy-await']);
        expect(entries[1].kind).toBe('note');
        expect(entries.some(e => e.label.includes('MEDIAN'))).toBe(false);
        expect(entries.some(e => e.label.includes('NO INTEL'))).toBe(false);
    });

    test('all drawn → all listed with their labels', () => {
        const entries = legendEntries({
            you: true, youLabel: 'YOU · GOLD EARNED',
            enemy: true, enemyName: 'Mirana',
            ghostLabel: 'CRUSADER-ARCHON AXE AVG', median: true,
            teamGold: true, teamGoldLabel: 'TEAM GOLD ADV (DELAYED)',
        });
        expect(entries.map(e => e.id)).toEqual(['you', 'enemy', 'ghost', 'median', 'teamgold']);
        expect(entries[1].label).toBe('MIRANA · NET WORTH');
        expect(entries.every(e => e.kind !== 'note')).toBe(true);
    });
});

// ── row 19 · death-mark clustering ─────────────────────────────────────

describe('clusterByX (row 19)', () => {
    test('marks within the gap merge into one badge at the mean x', () => {
        const c = clusterByX([{ x: 100, min: 20 }, { x: 106, min: 21 }, { x: 400, min: 30 }], 12);
        expect(c).toHaveLength(2);
        expect(c[0]).toEqual({ x: 103, count: 2, mins: [20, 21] });
        expect(c[1].count).toBe(1);
    });

    test('chained proximity clusters transitively', () => {
        const c = clusterByX([{ x: 10, min: 1 }, { x: 20, min: 2 }, { x: 30, min: 3 }], 12);
        expect(c).toHaveLength(1);
        expect(c[0].count).toBe(3);
    });
});

// ── row 16 · teach-once ────────────────────────────────────────────────

describe('teachState (row 16 — teach on first death, then collapse)', () => {
    test('hidden with no deaths; full on the first death; collapses after the TTL', () => {
        expect(teachState(0, null, 50_000)).toBe('hidden');
        expect(teachState(1, null, 50_000)).toBe('full');
        expect(teachState(1, 50_000, 55_000)).toBe('full');
        expect(teachState(1, 50_000, 61_000)).toBe('collapsed');
    });

    test('a later first render (deaths already > 1) skips straight to collapsed', () => {
        expect(teachState(4, null, 50_000)).toBe('collapsed');
        expect(teachState(2, 50_000, 51_000)).toBe('collapsed');
    });
});

// ── rows 21/23 · tape label layout + compression ───────────────────────

function ev(key: string, label: string, tone: TapeEvent['tone'], secondsUntil: number): TapeEvent {
    return { key, label, tone, secondsUntil };
}

function overlaps(a: { labelPct: number; label: string }, b: { labelPct: number; label: string }): boolean {
    const aEnd = a.labelPct + tapeLabelWidthPct(a.label);
    const bEnd = b.labelPct + tapeLabelWidthPct(b.label);
    return a.labelPct < bEnd && b.labelPct < aEnd;
}

describe('layoutTapeLabels (row 21 — deterministic collision layout)', () => {
    test('no two labels in the same lane overlap; crowded labels get a leader tick', () => {
        const placed = layoutTapeLabels([
            ev('stack', 'STACK', 'blue', 33),
            ev('spike-ck-yasha', 'CHAOS KNIGHT YASHA', 'dire', 45),
            ev('rune', 'RUNE', 'blue', 47),
            ev('bounty', 'BOUNTY', 'blue', 52),
            ev('spike-mirana-manta', 'MIRANA MANTA', 'dire', 88),
        ]);
        for (const lane of ['above', 'below'] as const) {
            const inLane = placed.filter(p => p.lane === lane);
            for (let i = 0; i < inLane.length; i++) {
                for (let j = i + 1; j < inLane.length; j++) {
                    expect(overlaps(inLane[i], inLane[j])).toBe(false);
                }
            }
        }
        // every tick stays at the true event time even when its label shifted
        for (const p of placed) {
            if (p.leader) expect(p.labelPct).toBeGreaterThan(p.tickPct);
            else expect(Math.abs(p.labelPct - p.tickPct)).toBeLessThan(tapeLabelWidthPct(p.label) + 0.01);
        }
    });

    test('co-timed same-tone events merge into one label', () => {
        const placed = layoutTapeLabels([
            ev('spike-ck-yasha', 'CHAOS KNIGHT YASHA', 'dire', 45),
            ev('spike-mirana-manta', 'MIRANA MANTA', 'dire', 46),
        ]);
        expect(placed).toHaveLength(1);
        expect(placed[0].label).toContain('CHAOS KNIGHT YASHA');
        expect(placed[0].label).toContain('+ MIRANA MANTA');
    });

    test('different tones never merge; the amber item-eta stays its own label', () => {
        const placed = layoutTapeLabels([
            ev('rune', 'RUNE', 'blue', 45),
            ev('item-eta', 'BLINK ≈0:45', 'amber', 45),
        ]);
        expect(placed).toHaveLength(2);
    });

    test('rosh-open reserves the above-left slot', () => {
        const placed = layoutTapeLabels(
            [ev('stack', 'STACK', 'blue', 4), ev('rune', 'RUNE', 'blue', 8)],
            { reserveAboveLeftPct: 20 },
        );
        for (const p of placed.filter(p => p.lane === 'above')) {
            expect(p.labelPct).toBeGreaterThanOrEqual(20);
        }
    });

    test('far-right labels clamp inside the tape (the right-anchor case)', () => {
        const placed = layoutTapeLabels([ev('spike-ck-yasha', 'CHAOS KNIGHT YASHA', 'dire', 172)]);
        const p = placed[0];
        expect(p.labelPct + tapeLabelWidthPct(p.label)).toBeLessThanOrEqual(100);
        // 07-23 hunt uilogic-3 contract change: a clamped label is displaced
        // from its tick, so it DRAWS a leader back to it — an unled displaced
        // label reads as belonging to the wrong moment (the superimposition
        // confusion the lane sweep fixes).
        expect(p.leader).toBe(Math.abs(p.labelPct - p.tickPct) > 0.5);
        expect(p.tickPct).toBeCloseTo((172 / 180) * 100, 1);
    });

    test('single-lane mode puts everything below (compressed tape)', () => {
        const placed = layoutTapeLabels(
            [ev('stack', 'STACK', 'blue', 30), ev('rune', 'RUNE', 'blue', 90)],
            { singleLane: true },
        );
        expect(placed.every(p => p.lane === 'below')).toBe(true);
    });

    test('dire spike/aegis events carry the band flag; blue does not', () => {
        const placed = layoutTapeLabels([
            ev('spike-ck-yasha', 'CHAOS KNIGHT YASHA', 'dire', 60),
            ev('aegis', 'AEGIS EXPIRES', 'dire', 100),
            ev('rune', 'RUNE', 'blue', 30),
        ]);
        expect(placed.find(p => p.key.startsWith('spike'))!.band).toBe(true);
        expect(placed.find(p => p.key === 'aegis')!.band).toBe(true);
        expect(placed.find(p => p.key === 'rune')!.band).toBe(false);
    });
});

describe('isTapeCompressed (row 23)', () => {
    test('compresses under three events with no rosh band', () => {
        const two = [ev('a', 'A', 'blue', 10), ev('b', 'B', 'blue', 20)];
        expect(isTapeCompressed(two, null)).toBe(true);
        expect(isTapeCompressed([...two, ev('c', 'C', 'blue', 30)], null)).toBe(false);
        expect(isTapeCompressed(two, { state: 'pending', secondsUntil: 90 })).toBe(false);
    });
});

// ── row 22 · late-game classes (defensive — absent fields = today) ─────

const RAIL: TimerRailData = {
    clock: 2400,
    roshan: { status: 'window', early: null, late: 2570 },
};

describe('roshClosesIn / buybackTapeEvent (row 22)', () => {
    test('an open window with a late bound reports its close countdown', () => {
        expect(roshClosesIn(RAIL, 2400)).toBe(170);
        expect(roshClosesIn({ ...RAIL, roshan: { status: 'window', early: null, late: null } }, 2400)).toBeNull();
        expect(roshClosesIn(null, 2400)).toBeNull();
    });

    test('a past close bound reports nothing (never a negative countdown)', () => {
        expect(roshClosesIn({ ...RAIL, roshan: { status: 'window', early: null, late: 2390 } }, 2400)).toBeNull();
    });

    test('buyback ready_at becomes a gold countdown event; absent field renders nothing', () => {
        const withBb = { ...RAIL, buyback: { ready_at: 2460, cost: 2540 } };
        const e = buybackTapeEvent(withBb, 2400)!;
        expect(e.tone).toBe('gold');
        expect(e.secondsUntil).toBe(60);
        expect(e.label).toContain('BUYBACK');
        expect(buybackTapeEvent(RAIL, 2400)).toBeNull();
        expect(buybackTapeEvent({ ...RAIL, buyback: { ready_at: 2390 } }, 2400)).toBeNull();
    });
});
