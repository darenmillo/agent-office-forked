/** rc-audit R1 — Group A coherence arbiter + directive dwell + death-panel
 *  hygiene (rows 01, 02, 03, 04, 07, 13, 14, 25). Pure-logic suite. */
import {
    pickPriorityAction,
    DwellTracker,
    directiveIsStale,
    directiveOwnedKey,
    recKey,
    pruneQueued,
} from './pacing';
import { directiveIsGoldTarget, GoldTarget } from './console';
import { Recommendation, StanceData } from './raijinTypes';

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

function stance(s: StanceData['stance'], discipline = false): StanceData {
    return { stance: s, reason: 'r', confidence: 0.9, discipline };
}

const disciplineRec = () => rec({
    category: 'GENERAL',
    priority: 5,
    urgency: 'CRITICAL',
    title: 'DISCIPLINE: AFK farm your core item',
    tags: ['stance'],
});

describe('row 01 — the stance arbiter', () => {
    it('suppresses a FARM-order discipline directive when the live stance is FIGHT', () => {
        const lesser = rec({ title: 'second best', priority: 4, urgency: 'IMPORTANT' });
        const picked = pickPriorityAction([disciplineRec(), lesser], T0 + 1000, null, stance('FIGHT'));
        expect(picked?.title).toBe('second best');
    });

    it('keeps the discipline directive when the stance agrees (FARM)', () => {
        const picked = pickPriorityAction([disciplineRec()], T0 + 1000, null, stance('FARM', true));
        expect(picked?.title).toBe('DISCIPLINE: AFK farm your core item');
    });

    it('does not suppress non-stance CRITICALs under FIGHT', () => {
        const rapier = rec({ title: 'ENEMY RAPIER', priority: 5, urgency: 'CRITICAL' });
        const picked = pickPriorityAction([rapier], T0 + 1000, null, stance('FIGHT'));
        expect(picked?.title).toBe('ENEMY RAPIER');
    });

    it('row 04 guard: no TP special-casing — a TP CRITICAL without stance/event tags is picked normally', () => {
        const tp = rec({ category: 'ITEM', title: 'BUY TP SCROLL', priority: 5, urgency: 'CRITICAL' });
        const picked = pickPriorityAction([tp], T0 + 1000, null, stance('FIGHT'));
        expect(picked?.title).toBe('BUY TP SCROLL');
    });

    it('stays backward compatible without a stance argument', () => {
        const picked = pickPriorityAction([disciplineRec()], T0 + 1000, null);
        expect(picked?.title).toBe('DISCIPLINE: AFK farm your core item');
    });
});

describe('row 07 — event-tagged recs never own the directive', () => {
    it('excludes tags:[event]; falls through to the next best', () => {
        const evt = rec({ title: 'LEVEL 6 — ULTIMATE UNLOCKED', priority: 5, urgency: 'CRITICAL', tags: ['event'] });
        const other = rec({ title: 'real instruction', priority: 3 });
        const picked = pickPriorityAction([evt, other], T0 + 1000, null);
        expect(picked?.title).toBe('real instruction');
    });
});

describe('row 02 — CRITICAL red dwell budget', () => {
    it('holds red for 90s from onset, then decays to amber for the same key', () => {
        const t = new DwellTracker();
        expect(t.state('GENERAL|X', T0)).toBe('red');
        expect(t.state('GENERAL|X', T0 + 89_000)).toBe('red');
        expect(t.state('GENERAL|X', T0 + 91_000)).toBe('amber');
    });

    it('a NEW key re-arms red; the old key stays amber', () => {
        const t = new DwellTracker();
        t.state('GENERAL|X', T0);
        expect(t.state('GENERAL|X', T0 + 100_000)).toBe('amber');
        expect(t.state('GENERAL|Y', T0 + 100_000)).toBe('red');
        expect(t.state('GENERAL|X', T0 + 101_000)).toBe('amber');
    });

    it('re-fires of the SAME key do not reset the dwell clock', () => {
        const t = new DwellTracker();
        t.state('GENERAL|TP', T0);
        t.state('GENERAL|TP', T0 + 60_000); // nag re-fire, same key
        expect(t.state('GENERAL|TP', T0 + 95_000)).toBe('amber');
    });

    it('null key yields null', () => {
        const t = new DwellTracker();
        expect(t.state(null, T0)).toBeNull();
    });
});

describe('row 03 — stale-number directive belt', () => {
    it('flags a >60s-old directive whose body embeds digits', () => {
        const r = rec({ body: '5 deaths — hard cap breached', receivedAt: T0 });
        expect(directiveIsStale(r, T0 + 61_000)).toBe(true);
    });

    it('does not flag digit-free bodies or fresh recs', () => {
        const noDigits = rec({ body: 'farm your own half', receivedAt: T0 });
        const freshDigits = rec({ body: '5 deaths', receivedAt: T0 });
        expect(directiveIsStale(noDigits, T0 + 61_000)).toBe(false);
        expect(directiveIsStale(freshDigits, T0 + 30_000)).toBe(false);
        expect(directiveIsStale(null, T0)).toBe(false);
    });
});

describe('row 13 — cross-zone dedupe key', () => {
    it('recKey and directiveOwnedKey agree on category|title', () => {
        const r = rec({ category: 'ITEM', title: 'BUY TP SCROLL' });
        expect(recKey(r)).toBe('ITEM|BUY TP SCROLL');
        expect(directiveOwnedKey(r)).toBe('ITEM|BUY TP SCROLL');
        expect(directiveOwnedKey(null)).toBeNull();
    });
});

describe('row 14 — directive == gold target detection', () => {
    it('matches on the goldTarget recKey', () => {
        const r = rec({ category: 'ITEM', title: 'Next item: Vanguard' });
        const gt: GoldTarget = { label: 'Next item: Vanguard', cost: 1700, recKey: 'ITEM|Next item: Vanguard' };
        expect(directiveIsGoldTarget(r, gt)).toBe(true);
        expect(directiveIsGoldTarget(rec({ title: 'other' }), gt)).toBe(false);
        expect(directiveIsGoldTarget(null, gt)).toBe(false);
        expect(directiveIsGoldTarget(r, null)).toBe(false);
    });
});

describe('row 25 — death-panel queued list hygiene', () => {
    const base = { category: 'GENERAL' as const, urgency: 'IMPORTANT' as const };

    it('ages out items older than 2 minutes', () => {
        const old = rec({ ...base, title: 'min-5 relic', receivedAt: T0 - 150_000 });
        const fresh = rec({ ...base, title: 'fresh', receivedAt: T0 - 10_000 });
        const out = pruneQueued([old, fresh], T0);
        expect(out.map(r => r.title)).toEqual(['fresh']);
    });

    it('dedupes by key and caps at 3, newest first', () => {
        const items = [
            rec({ ...base, title: 'a', receivedAt: T0 - 1000 }),
            rec({ ...base, title: 'a', receivedAt: T0 - 5000 }), // duplicate
            rec({ ...base, title: 'b', receivedAt: T0 - 2000 }),
            rec({ ...base, title: 'c', receivedAt: T0 - 3000 }),
            rec({ ...base, title: 'd', receivedAt: T0 - 4000 }),
        ];
        const out = pruneQueued(items, T0);
        expect(out).toHaveLength(3);
        expect(out.map(r => r.title)).toEqual(['a', 'b', 'c']);
    });

    it('excludes death-tagged and CRITICAL recs (they have their own homes)', () => {
        const death = rec({ ...base, title: 'd', tags: ['death'], receivedAt: T0 });
        const crit = rec({ ...base, title: 'c', urgency: 'CRITICAL' as const, receivedAt: T0 });
        const ok = rec({ ...base, title: 'ok', receivedAt: T0 });
        expect(pruneQueued([death, crit, ok], T0).map(r => r.title)).toEqual(['ok']);
    });
});
