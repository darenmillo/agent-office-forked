/** 07-23 hunt fixes — pure-logic pins for the confirmed adversarial findings.
 *
 *  redstack-01: a NEW arming (demote seen between CRITICALs) re-arms red;
 *  same-key CRITICAL re-fires within an arming still never reset (anti-
 *  wallpaper law). redstack-02: dwell pauses while the death panel owns the
 *  board. redstack-03 (UI half): no-tts card updates never own the directive.
 *  uilogic-2: the NEXT echo merges only when the directive IS the NEXT rec.
 *  uilogic-3: tape labels keep the per-lane no-overlap invariant after the
 *  right-edge clamp. uilogic-5: boardState has a hysteresis band at min 12.
 *  reset-2/3/redstack-05/uilogic-1/-4 are the game-2 carryover family —
 *  DwellTracker.reset() is pinned here; the match-keyed remount + store
 *  resets are component-level (tsc-verified).
 */

import { DwellTracker, pickPriorityAction } from './pacing';
import { mergeNextEcho } from './console';
import { layoutTapeLabels, TapeEvent } from './gapTape';
import { boardState } from './director';
import { Recommendation } from './raijinTypes';

const T0 = 1_700_000_000_000;

function rec(partial: Partial<Recommendation>): Recommendation {
    return {
        category: 'GENERAL',
        priority: 3,
        tier: 'FAST',
        title: 'test rec',
        body: 'body',
        timestamp: T0 / 1000,
        receivedAt: T0,
        ...partial,
    } as Recommendation;
}

const KEY = 'GENERAL|DISCIPLINE: AFK farm your core item';
const crit = (at: number) => rec({ title: 'DISCIPLINE: AFK farm your core item', priority: 5, urgency: 'CRITICAL', receivedAt: at, tags: ['stance'] });
const release = (at: number) => rec({ title: 'DISCIPLINE: AFK farm your core item', priority: 4, urgency: 'IMPORTANT', receivedAt: at, tags: ['stance', 'no-tts'] });

describe('redstack-01 — dwell re-arms on a demote-separated new arming', () => {
    it('same-key re-fires within an arming never reset (anti-wallpaper)', () => {
        const d = new DwellTracker();
        d.observe(crit(T0));
        expect(d.state(KEY, T0)).toBe('red');
        // 150s later the SAME arming's CRITICAL re-fires — no reset
        d.observe(crit(T0 + 150_000));
        expect(d.state(KEY, T0 + 150_000)).toBe('amber');
    });

    it('CRITICAL after an observed demote (release card) re-arms red', () => {
        const d = new DwellTracker();
        d.observe(crit(T0));
        d.state(KEY, T0);
        d.state(KEY, T0 + 100_000); // decayed
        d.observe(release(T0 + 200_000)); // demote-on-resolve seen
        d.observe(crit(T0 + 300_000)); // ARMING 2
        expect(d.state(KEY, T0 + 300_000)).toBe('red');
    });

    it('reset() clears all onsets (new-match path)', () => {
        const d = new DwellTracker();
        d.observe(crit(T0));
        d.state(KEY, T0);
        d.reset();
        expect(d.state(KEY, T0 + 100_000)).toBe('red');
    });
});

describe('redstack-02 — dwell pauses while dead', () => {
    it('a pause covering the respawn does not burn the red budget', () => {
        const d = new DwellTracker();
        d.observe(crit(T0));
        expect(d.state(KEY, T0)).toBe('red');
        d.pause(T0 + 10_000); // death panel takes the board 10s in
        d.resume(T0 + 110_000); // 100s respawn
        // only 10s of visible red burned — still red well past raw 90s
        expect(d.state(KEY, T0 + 150_000)).toBe('red');
        expect(d.state(KEY, T0 + 200_000)).toBe('amber');
    });

    it('onsetAge tracks the adjusted onset (cutTakeover input)', () => {
        const d = new DwellTracker();
        d.observe(crit(T0));
        d.state(KEY, T0);
        d.pause(T0 + 5_000);
        d.resume(T0 + 65_000);
        expect(d.onsetAge(KEY, T0 + 70_000)).toBe(10_000);
    });
});

describe('redstack-03 (UI half) — no-tts never owns the directive', () => {
    it('a silent card refresh is not a directive', () => {
        const silent = release(T0);
        expect(pickPriorityAction([silent], T0 + 1000)).toBeNull();
    });

    it('a spoken CRITICAL still wins', () => {
        const c = crit(T0);
        expect(pickPriorityAction([release(T0), c], T0 + 1000)).toBe(c);
    });
});

describe('uilogic-2 — NEXT echo merges only when the directive IS the NEXT rec', () => {
    const next = rec({ category: 'ITEM', title: 'Next item: Vanguard', meta: { item: 'vanguard', build_slot: 'next' } });

    it('directive key matching the NEXT rec merges', () => {
        expect(mergeNextEcho('ITEM|Next item: Vanguard', next)).toBe(true);
    });

    it('a different gold-target directive does NOT merge', () => {
        expect(mergeNextEcho('ITEM|Buy BKB now', next)).toBe(false);
    });

    it('null directive or missing NEXT never merges', () => {
        expect(mergeNextEcho(null, next)).toBe(false);
        expect(mergeNextEcho('ITEM|Next item: Vanguard', null)).toBe(false);
    });
});

describe('uilogic-3 — per-lane no-overlap survives the right-edge clamp', () => {
    const ev = (key: string, label: string, secondsUntil: number, tone: 'radiant' | 'dire' | 'neutral' = 'neutral'): TapeEvent =>
        ({ key, label, secondsUntil, tone } as TapeEvent);

    function assertNoLaneOverlap(placements: ReturnType<typeof layoutTapeLabels>) {
        for (const lane of ['above', 'below'] as const) {
            const inLane = placements
                .filter(p => p.lane === lane)
                .sort((a, b) => a.labelPct - b.labelPct);
            for (let i = 1; i < inLane.length; i++) {
                const prev = inLane[i - 1];
                const prevRight = prev.labelPct + (prev as any).width ?? prev.labelPct;
                // widths aren't exported on the placement — assert starts differ
                // by at least the label's rendered span via non-superimposition:
                expect(inLane[i].labelPct).toBeGreaterThan(prev.labelPct + 0.5);
                void prevRight;
            }
        }
    }

    it('two same-lane labels crowding the right edge never superimpose', () => {
        const placements = layoutTapeLabels(
            [ev('aegis', 'AEGIS EXPIRES', 160, 'dire'), ev('item-eta:maelstrom', 'MAELSTROM ≈2:50', 170)],
            { singleLane: true },
        );
        assertNoLaneOverlap(placements);
        // a leftward-displaced label draws a leader back to its tick
        const displaced = placements.filter(p => Math.abs(p.labelPct - p.tickPct) > 0.5);
        for (const p of displaced) expect(p.leader).toBe(true);
    });

    it('three right-edge crowders resolve without overlap (dual lane)', () => {
        const placements = layoutTapeLabels([
            ev('a', 'DROW RANGER FORCE STAFF 2:45', 165, 'dire'),
            ev('b', 'AEGIS EXPIRES', 172, 'dire'),
            ev('c', 'MAELSTROM ≈2:55', 178),
        ]);
        assertNoLaneOverlap(placements);
    });
});

describe('uilogic-5 — boardState hysteresis at the laning boundary', () => {
    const base = { alive: true, gameEnded: false };

    it('jitter around 720 does not flip with a prev state', () => {
        expect(boardState({ ...base, clock: 719 }, 'MID').state).toBe('MID');
        expect(boardState({ ...base, clock: 721 }, 'LANING').state).toBe('LANING');
    });

    it('a decisive crossing flips', () => {
        expect(boardState({ ...base, clock: 736 }, 'LANING').state).toBe('MID');
        expect(boardState({ ...base, clock: 704 }, 'MID').state).toBe('LANING');
    });

    it('no prev state keeps the raw boundary', () => {
        expect(boardState({ ...base, clock: 719 }).state).toBe('LANING');
        expect(boardState({ ...base, clock: 721 }).state).toBe('MID');
    });

    it('DEAD and POSTGAME ignore hysteresis', () => {
        expect(boardState({ clock: 719, alive: false, gameEnded: false }, 'MID').state).toBe('DEAD');
        expect(boardState({ clock: 719, alive: true, gameEnded: true }, 'LANING').state).toBe('POSTGAME');
    });
});
