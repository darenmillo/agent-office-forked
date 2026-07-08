/** Strip-state selection — the caster bug's only logic, fully unit-tested. */

import {
    ACTION_WINDOW_MS,
    OFFLINE_AFTER_MS,
    computeStrip,
    fmtClock,
    nextObjective,
    pickAction,
    pruneRecs,
} from './strip';
import { Recommendation, StanceData, TimerRailData, stanceColor } from './types';

const NOW = 1_800_000_000_000;

function rec(over: Partial<Recommendation> = {}): Recommendation {
    return {
        category: 'GENERAL',
        priority: 3,
        tier: 'FAST',
        title: 'Do the thing',
        body: '',
        reason: 'because',
        timestamp: NOW / 1000,
        receivedAt: NOW - 1_000,
        ...over,
    };
}

describe('pickAction', () => {
    it('returns null with no fresh recs', () => {
        expect(pickAction([], NOW)).toBeNull();
        expect(pickAction([rec({ receivedAt: NOW - ACTION_WINDOW_MS - 1 })], NOW)).toBeNull();
    });

    it('urgency outranks raw priority', () => {
        const critical = rec({ title: 'BACK OFF', urgency: 'CRITICAL', priority: 1 });
        const routine = rec({ title: 'farm more', urgency: 'ROUTINE', priority: 9 });
        expect(pickAction([routine, critical], NOW)?.title).toBe('BACK OFF');
    });

    it('priority breaks urgency ties, recency breaks priority ties', () => {
        const a = rec({ title: 'A', priority: 4, receivedAt: NOW - 50_000 });
        const b = rec({ title: 'B', priority: 6, receivedAt: NOW - 50_000 });
        expect(pickAction([a, b], NOW)?.title).toBe('B');
        const older = rec({ title: 'older', priority: 4, receivedAt: NOW - 90_000 });
        const newer = rec({ title: 'newer', priority: 4, receivedAt: NOW - 5_000 });
        expect(pickAction([older, newer], NOW)?.title).toBe('newer');
    });

    it('derives urgency from priority when the field is absent (>=5 CRITICAL)', () => {
        const derivedCritical = rec({ title: 'derived', priority: 5 });
        const explicitImportant = rec({ title: 'imp', urgency: 'IMPORTANT', priority: 9 });
        expect(pickAction([explicitImportant, derivedCritical], NOW)?.title).toBe('derived');
    });
});

describe('nextObjective', () => {
    const base: TimerRailData = { clock: 1200 };

    it('null on no rail / nothing upcoming', () => {
        expect(nextObjective(null)).toBeNull();
        expect(nextObjective(base)).toBeNull();
        expect(nextObjective({ clock: 1200, next_stack: 1100 })).toBeNull(); // past
    });

    it('picks the soonest among candidates', () => {
        const t: TimerRailData = {
            clock: 1200,
            next_stack: 1253,
            next_power_rune: 1320,
            tormentor: { status: 'pending', at: 1260 },
        };
        expect(nextObjective(t)).toEqual({ label: 'STACK', at: 1253 });
    });

    it('roshan window states map to early/late edges; up/unknown are silent', () => {
        expect(
            nextObjective({ clock: 1500, roshan: { status: 'dead', early: 1980, late: 2160 } }),
        ).toEqual({ label: 'ROSH EARLY', at: 1980 });
        expect(
            nextObjective({ clock: 2000, roshan: { status: 'window', early: 1980, late: 2160 } }),
        ).toEqual({ label: 'ROSH LATE', at: 2160 });
        expect(nextObjective({ clock: 2000, roshan: { status: 'up', early: null, late: null } })).toBeNull();
    });

    it('tormentor up is not a countdown', () => {
        expect(nextObjective({ clock: 1200, tormentor: { status: 'up', at: 1200 } })).toBeNull();
    });
});

describe('computeStrip', () => {
    const stance: StanceData = { stance: 'FIGHT', reason: 'item lead', confidence: 0.8, discipline: false };

    it('offline when the engine has been silent (or never spoke)', () => {
        expect(computeStrip({ recs: [], stance, timers: null, lastMessageAt: null, now: NOW }).connected).toBe(false);
        const silent = computeStrip({
            recs: [rec()],
            stance,
            timers: null,
            lastMessageAt: NOW - OFFLINE_AFTER_MS - 1,
            now: NOW,
        });
        expect(silent.connected).toBe(false);
        expect(silent.action).toBeNull(); // offline strip renders nothing stale
    });

    it('critical flag follows the picked action urgency', () => {
        const calm = computeStrip({
            recs: [rec({ urgency: 'IMPORTANT' })],
            stance,
            timers: null,
            lastMessageAt: NOW - 1000,
            now: NOW,
        });
        expect(calm.connected).toBe(true);
        expect(calm.critical).toBe(false);
        const hot = computeStrip({
            recs: [rec({ urgency: 'CRITICAL', title: 'GO' })],
            stance,
            timers: null,
            lastMessageAt: NOW - 1000,
            now: NOW,
        });
        expect(hot.critical).toBe(true);
        expect(hot.action?.title).toBe('GO');
    });

    it('countdown is clock-relative and floored at zero', () => {
        const s = computeStrip({
            recs: [],
            stance,
            timers: { clock: 1240, next_stack: 1253 },
            lastMessageAt: NOW,
            now: NOW,
        });
        expect(s.nextTimer).toEqual({ label: 'STACK', at: 1253 });
        expect(s.countdown).toBe(13);
    });
});

describe('housekeeping + tokens', () => {
    it('pruneRecs drops everything outside the NOW window', () => {
        const keep = rec({ receivedAt: NOW - 10_000 });
        const drop = rec({ receivedAt: NOW - ACTION_WINDOW_MS - 10 });
        expect(pruneRecs([keep, drop], NOW)).toEqual([keep]);
    });

    it('fmtClock handles pre-horn negatives and zero-pads', () => {
        expect(fmtClock(75)).toBe('1:15');
        expect(fmtClock(-30)).toBe('-0:30');
        expect(fmtClock(600)).toBe('10:00');
    });

    it('stance colors match the Direction-C bcast tokens', () => {
        expect(stanceColor('FARM')).toBe('#4FA3FF');
        expect(stanceColor('FIGHT')).toBe('#FF6A3D');
        expect(stanceColor('PUSH')).toBe('#F5C518');
        expect(stanceColor(null)).toBe('#8A94A6');
    });
});
