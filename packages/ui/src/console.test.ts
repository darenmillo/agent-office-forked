/** Tests for the CONSOLE board logic (tape math, gold target, gap series). */
import {
    tapePct,
    tapeRightAnchor,
    tapeEventVisible,
    fmtMSS,
    extrapolatedClock,
    extractGoldTarget,
    goldEtaSeconds,
    bucketMinute,
    goldEarnedProxy,
    upsertGapPoint,
    latestGap,
    gapSlopePerMin,
    roshTapeState,
    deriveTapeEvents,
    selectBuildSlots,
    GapPoint,
} from './console';
import { Recommendation, TimerRailData } from './raijinTypes';

function rec(partial: Partial<Recommendation>): Recommendation {
    return {
        category: 'ITEM',
        priority: 4,
        tier: 'FAST',
        title: 'Item call',
        body: '',
        timestamp: 0,
        receivedAt: 1_000_000,
        ...partial,
    };
}

describe('selectBuildSlots (B5)', () => {
    const slotRec = (title: string, slot?: 'next' | 'after' | 'pivot') =>
        rec({ title, meta: slot ? { item: title, build_slot: slot } : { item: title } });

    test('slot-aware: build_slot claims win regardless of position, >2 pivots truncate', () => {
        const s = selectBuildSlots([
            slotRec('pivot-a', 'pivot'),
            slotRec('after-x', 'after'),
            slotRec('next-x', 'next'),
            slotRec('pivot-b', 'pivot'),
            slotRec('pivot-c', 'pivot'),
        ]);
        expect(s.next?.title).toBe('next-x');
        expect(s.after?.title).toBe('after-x');
        expect(s.pivots.map(r => r.title)).toEqual(['pivot-a', 'pivot-b']);
    });

    test('positional fallback preserves legacy semantics when nothing is slotted', () => {
        const s = selectBuildSlots([slotRec('a'), slotRec('b'), slotRec('c'), slotRec('d'), slotRec('e')]);
        expect(s.next?.title).toBe('a');
        expect(s.after?.title).toBe('b');
        expect(s.pivots.map(r => r.title)).toEqual(['c', 'd']);
    });

    test('mixed: slotless recs fill only unclaimed slots, in order, never displacing a claimant', () => {
        const s = selectBuildSlots([slotRec('legacy-1'), slotRec('next-x', 'next'), slotRec('legacy-2')]);
        expect(s.next?.title).toBe('next-x');
        expect(s.after?.title).toBe('legacy-1');
        expect(s.pivots.map(r => r.title)).toEqual(['legacy-2']);
    });

    test('empty input -> all slots empty', () => {
        expect(selectBuildSlots([])).toEqual({ next: null, after: null, pivots: [] });
    });
});

describe('tape math', () => {
    test('position is a linear % of the 180s horizon', () => {
        expect(tapePct(0)).toBe(0);
        expect(tapePct(90)).toBe(50);
        expect(tapePct(180)).toBe(100);
        expect(tapePct(999)).toBe(100);
        expect(tapePct(-5)).toBe(0);
    });

    test('labels right-anchor past 82%', () => {
        expect(tapeRightAnchor(147)).toBe(false); // 81.7%
        expect(tapeRightAnchor(149)).toBe(true);  // 82.8%
    });

    test('events hide until they enter the 175s horizon', () => {
        expect(tapeEventVisible(176)).toBe(false);
        expect(tapeEventVisible(175)).toBe(true);
        expect(tapeEventVisible(1)).toBe(true);
        expect(tapeEventVisible(0)).toBe(false);
        expect(tapeEventVisible(-10)).toBe(false);
    });

    test('fmtMSS clamps and pads', () => {
        expect(fmtMSS(0)).toBe('0:00');
        expect(fmtMSS(-3)).toBe('0:00');
        expect(fmtMSS(61)).toBe('1:01');
        expect(fmtMSS(600)).toBe('10:00');
    });

    test('clock extrapolates whole seconds from the snapshot', () => {
        expect(extrapolatedClock(1200, 10_000, 14_900)).toBe(1204);
    });
});

describe('gold target extraction', () => {
    test('parses a cost stated in the rec text', () => {
        const target = extractGoldTarget(
            [rec({ title: 'Blade Mail next', body: 'Reflect answers their dive — 2100g total.' })],
            1_000_000,
        );
        expect(target).toEqual({
            label: 'Blade Mail next',
            cost: 2100,
            recKey: 'ITEM|Blade Mail next',
        });
    });

    test('returns null when no rec states a cost (never invents a price)', () => {
        expect(
            extractGoldTarget([rec({ title: 'Blade Mail next', body: 'Reflect answers the dive.' })], 1_000_000),
        ).toBeNull();
    });

    test('ignores non-ITEM recs and stale recs', () => {
        const stale = rec({ title: 'Old — 2100g', receivedAt: 0 });
        const fight = rec({ category: 'FIGHT', title: 'Go — 2000 gold swing' });
        expect(extractGoldTarget([stale, fight], 10_000_000)).toBeNull();
    });

    test('prefers the higher-priority ITEM rec', () => {
        const low = rec({ title: 'Wand — 450g', priority: 2 });
        const high = rec({ title: 'BKB — 4050g', priority: 5 });
        expect(extractGoldTarget([low, high], 1_000_000)?.cost).toBe(4050);
    });

    test('eta is 0 when affordable, null without income, minutes otherwise', () => {
        const t = { label: 'X', cost: 2100, recKey: 'ITEM|X' };
        expect(goldEtaSeconds(t, 2200, 400)).toBe(0);
        expect(goldEtaSeconds(t, 1000, 0)).toBeNull();
        expect(goldEtaSeconds(t, 1385, 420)).toBeCloseTo(((2100 - 1385) / 420) * 60);
    });
});

describe('gap series', () => {
    test('minute bucketing', () => {
        expect(bucketMinute(0)).toBe(0);
        expect(bucketMinute(59)).toBe(0);
        expect(bucketMinute(60)).toBe(1);
        expect(bucketMinute(1319)).toBe(21);
    });

    test('gold-earned proxy is gpm × minutes', () => {
        expect(goldEarnedProxy(420, 1200)).toBe(8400);
        expect(goldEarnedProxy(0, 1200)).toBe(0);
    });

    test('upsert creates sorted buckets and keeps latest reading', () => {
        let s: GapPoint[] = [];
        s = upsertGapPoint(s, 2, { you: 800 });
        s = upsertGapPoint(s, 1, { you: 400 });
        s = upsertGapPoint(s, 2, { you: 850, enemy: 1200 });
        expect(s.map(p => p.min)).toEqual([1, 2]);
        expect(s[1]).toEqual({ min: 2, you: 850, enemy: 1200, death: false });
    });

    test('death marks are sticky and unchanged patches keep the reference', () => {
        let s: GapPoint[] = [];
        s = upsertGapPoint(s, 3, { you: 900, death: true });
        const s2 = upsertGapPoint(s, 3, { you: 900 });
        expect(s2).toBe(s); // no change → same reference
        expect(s2[0].death).toBe(true);
    });

    test('latestGap uses the newest dual-reading bucket; slope needs two', () => {
        let s: GapPoint[] = [];
        s = upsertGapPoint(s, 10, { you: 4000, enemy: 6000 });
        s = upsertGapPoint(s, 12, { you: 5000, enemy: 7800 });
        s = upsertGapPoint(s, 13, { you: 5400 }); // enemy intel not landed yet
        expect(latestGap(s)).toEqual({ min: 12, gap: 2800 });
        expect(gapSlopePerMin(s)).toBeCloseTo((2800 - 2000) / 2);
        expect(gapSlopePerMin(s.slice(1))).toBeNull();
    });
});

describe('tape events', () => {
    const rail: TimerRailData = {
        clock: 1200,
        next_stack: 1253,      // +53s
        next_power_rune: 1440, // +240s → beyond horizon, hidden
        roshan: { status: 'dead', early: 1290, late: 1470 }, // window in 90s
    };

    test('derives visible events sorted by time, hides beyond-horizon', () => {
        const events = deriveTapeEvents(rail, 1200, { label: 'Blade Mail', seconds: 102 });
        expect(events.map(e => e.key)).toEqual(['stack', 'item-eta']);
        expect(events[0].secondsUntil).toBe(53);
        expect(events[1].tone).toBe('amber');
    });

    test('rosh pending → gold band offset; open/expired → re-anchored at NOW', () => {
        expect(roshTapeState(rail, 1200)).toEqual({ state: 'pending', secondsUntil: 90 });
        expect(roshTapeState(rail, 1300)).toEqual({ state: 'open', secondsUntil: 0 });
        expect(roshTapeState({ ...rail, roshan: { status: 'window', early: null, late: null } }, 1200))
            .toEqual({ state: 'open', secondsUntil: 0 });
        expect(roshTapeState({ ...rail, roshan: undefined }, 1200)).toBeNull();
        expect(roshTapeState({ ...rail, roshan: { status: 'up', early: null, late: null } }, 1200)).toBeNull();
    });

    test('no rail and no eta → empty', () => {
        expect(deriveTapeEvents(null, 0, null)).toEqual([]);
    });
});

// ── Wave 2 additions ───────────────────────────────────────────────────
import {
    llmKind, verdictBadge, winnabilityTone, fmtPct,
    checkinNext, CheckinState, CHECKIN_TIMEOUT_MS,
    worldToMap, baselinePoints, activityTone,
} from './console';

describe('activityTone', () => {
    test('failures always read as danger, regardless of kind', () => {
        expect(activityTone('llm', false)).toBe('dire');
        expect(activityTone('bot', false)).toBe('dire');
        expect(activityTone('error', true)).toBe('dire');
    });
    test('kinds map to their console registers', () => {
        expect(activityTone('llm', true)).toBe('phos');
        expect(activityTone('bot', true)).toBe('chrome');
        expect(activityTone('stratz', true)).toBe('chrome');
        expect(activityTone('engine', true)).toBe('amber');
        expect(activityTone('rec', true)).toBe('body');
        expect(activityTone('unknown-future-kind', true)).toBe('body');
    });
});

describe('llmKind', () => {
    test('classifies by tags; rule recs are null', () => {
        expect(llmKind(rec({ tags: ['llm', 'ambient'] }))).toBe('ambient');
        expect(llmKind(rec({ tags: ['llm', 'checkin'] }))).toBe('checkin');
        expect(llmKind(rec({ tags: ['llm', 'closing'] }))).toBe('closing');
        expect(llmKind(rec({ tags: ['death', 'llm', 'analysis'] }))).toBe('death-analysis');
        expect(llmKind(rec({ tags: ['llm', 'read'] }))).toBe('read');
        // untyped legacy llm rec renders as a generic read — never unstyled
        expect(llmKind(rec({ tags: ['llm'] }))).toBe('read');
        expect(llmKind(rec({ tags: ['death'] }))).toBeNull();
        expect(llmKind(rec({}))).toBeNull();
    });
});

describe('verdictBadge', () => {
    test('TRADE is radiant — a won trade is never rendered as danger', () => {
        expect(verdictBadge('TRADE')).toEqual({ label: 'TRADE WON', tone: 'radiant' });
    });
    test('full mapping + unknown renders nothing', () => {
        expect(verdictBadge('EVEN_TRADE')?.tone).toBe('blue');
        expect(verdictBadge('FIGHT_DEATH')?.tone).toBe('amber');
        expect(verdictBadge('CAUGHT')?.tone).toBe('dire');
        expect(verdictBadge('WHATEVER')).toBeNull();
        expect(verdictBadge(undefined)).toBeNull();
    });
});

describe('winnability', () => {
    test('tone bands', () => {
        expect(winnabilityTone(0.1)).toBe('dire');
        expect(winnabilityTone(0.349)).toBe('dire');
        expect(winnabilityTone(0.35)).toBe('amber');
        expect(winnabilityTone(0.549)).toBe('amber');
        expect(winnabilityTone(0.55)).toBe('radiant');
        expect(winnabilityTone(0.9)).toBe('radiant');
    });
    test('fmtPct clamps and rounds', () => {
        expect(fmtPct(0.19)).toBe('19%');
        expect(fmtPct(1.4)).toBe('100%');
        expect(fmtPct(-0.2)).toBe('0%');
    });
});

describe('checkinNext', () => {
    const idle: CheckinState = { phase: 'idle', queuedAt: null };
    test('fire → queued; double-fire is a no-op', () => {
        const q = checkinNext(idle, { type: 'fire', now: 1000 });
        expect(q).toEqual({ phase: 'queued', queuedAt: 1000 });
        expect(checkinNext(q, { type: 'fire', now: 2000 })).toBe(q);
    });
    test('landed/error return to idle', () => {
        const q = checkinNext(idle, { type: 'fire', now: 1000 });
        expect(checkinNext(q, { type: 'landed' }).phase).toBe('idle');
        expect(checkinNext(q, { type: 'error' }).phase).toBe('idle');
    });
    test('tick times the queue out at 90s — the button never wedges', () => {
        const q = checkinNext(idle, { type: 'fire', now: 1000 });
        expect(checkinNext(q, { type: 'tick', now: 1000 + CHECKIN_TIMEOUT_MS }).phase).toBe('queued');
        expect(checkinNext(q, { type: 'tick', now: 1001 + CHECKIN_TIMEOUT_MS }).phase).toBe('idle');
    });
});

describe('worldToMap', () => {
    test('center maps to center, y inverted', () => {
        expect(worldToMap(0, 0, 230)).toEqual({ x: 115, y: 115 });
        const topRight = worldToMap(8500, 8500, 230);
        expect(topRight.x).toBe(230);
        expect(topRight.y).toBe(0);
        const bottomLeft = worldToMap(-8500, -8500, 230);
        expect(bottomLeft.x).toBe(0);
        expect(bottomLeft.y).toBe(230);
    });
    test('out-of-range clamps to the frame', () => {
        expect(worldToMap(99999, -99999, 100)).toEqual({ x: 100, y: 100 });
    });
});

describe('baselinePoints', () => {
    test('skips nulls, keeps minute indices', () => {
        expect(baselinePoints([0, 320, null as unknown as number, 900])).toEqual([
            { min: 0, value: 0 }, { min: 1, value: 320 }, { min: 3, value: 900 },
        ]);
        expect(baselinePoints(null)).toEqual([]);
        expect(baselinePoints(undefined)).toEqual([]);
    });
});

describe('extractGoldTarget meta-first', () => {
    test('meta.cost beats the text regex and yields the slug', () => {
        const r = rec({
            title: 'Black King Bar',
            body: 'Get BKB for 9999g',
            meta: { item: 'black_king_bar', cost: 4050 },
        });
        const t = extractGoldTarget([r], 1_000_000);
        expect(t).not.toBeNull();
        expect(t!.cost).toBe(4050);
        expect(t!.slug).toBe('black_king_bar');
    });
    test('falls back to the rec text when meta is absent', () => {
        const r = rec({ title: 'Blade Mail', body: 'Blade Mail — 2100g next' });
        const t = extractGoldTarget([r], 1_000_000);
        expect(t!.cost).toBe(2100);
        expect(t!.slug).toBeUndefined();
    });
});
