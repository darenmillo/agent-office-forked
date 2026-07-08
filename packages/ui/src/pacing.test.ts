/** PacingController tests — the six retired mechanisms, now one tested model. */
import { ingestRecs, visibleRecs, pickPriorityAction, ageWindow, isLiveCoaching } from './pacing';
import type { Recommendation } from './raijinTypes';

const T0 = 1_720_000_000_000;

function rec(over: Partial<Recommendation>): Recommendation {
    return {
        category: 'GENERAL',
        priority: 3,
        tier: 'FAST',
        title: 'x',
        body: 'y',
        timestamp: T0 / 1000,
        receivedAt: T0,
        ...over,
    } as Recommendation;
}

describe('ingestRecs displacement', () => {
    it('replaces the previous live-coaching card WITHOUT title matching', () => {
        // The retired hack matched title.startsWith('Raijin says ') — the new
        // model is field-based, so a retitled backend voice still displaces.
        const old = rec({ tier: 'ANALYTICAL', title: 'Anything at all', receivedAt: T0 - 60_000 });
        const fresh = rec({ tier: 'ANALYTICAL', title: 'New live coaching', receivedAt: T0 });
        const out = ingestRecs([old], [fresh], T0);
        expect(out).toHaveLength(1);
        expect(out[0].title).toBe('New live coaching');
    });

    it('does NOT displace protected voices (death/matchup/knowledge)', () => {
        const death = rec({ tier: 'ANALYTICAL', title: 'Coach says', tags: ['death', 'llm'], receivedAt: T0 - 30_000 });
        const matchup = rec({ tier: 'ANALYTICAL', title: 'Game plan', tags: ['matchup'], receivedAt: T0 - 30_000 });
        const fresh = rec({ tier: 'ANALYTICAL', title: 'live', receivedAt: T0 });
        const out = ingestRecs([death, matchup], [fresh], T0);
        expect(out.map(r => r.title).sort()).toEqual(['Coach says', 'Game plan', 'live'].sort());
    });

    it('new SKILL displaces old SKILL; ITEM displacement keyed on priority', () => {
        const oldSkill = rec({ category: 'SKILL', title: 'old skill' });
        const lowItem = rec({ category: 'ITEM', title: 'boots', priority: 2 });
        const highItem = rec({ category: 'ITEM', title: 'bkb', priority: 5 });
        const out = ingestRecs(
            [oldSkill, lowItem, highItem],
            [rec({ category: 'SKILL', title: 'new skill' }), rec({ category: 'ITEM', title: 'kaya', priority: 4 })],
            T0,
        );
        const titles = out.map(r => r.title);
        expect(titles).not.toContain('old skill');
        expect(titles).not.toContain('boots'); // below min new item priority
        expect(titles).toContain('bkb'); // above it — survives
    });

    it('same category+title is an update, not a duplicate', () => {
        const out = ingestRecs(
            [rec({ title: 'Buy BKB', body: 'old', receivedAt: T0 - 9_000 })],
            [rec({ title: 'Buy BKB', body: 'new' })],
            T0,
        );
        expect(out).toHaveLength(1);
        expect(out[0].body).toBe('new');
    });
});

describe('age windows', () => {
    it('GENERAL is finite now (no immortal cards)…', () => {
        expect(ageWindow(rec({ category: 'GENERAL', priority: 1 }))).toBeLessThan(Infinity);
    });

    it('…but knowledge-tagged cards get the long window', () => {
        const k = rec({ tags: ['knowledge'], priority: 1 });
        expect(ageWindow(k)).toBeGreaterThan(ageWindow(rec({ priority: 1 })));
    });

    it('CRITICAL goes stale fast regardless of category', () => {
        const c = rec({ category: 'ITEM', urgency: 'CRITICAL' });
        expect(ageWindow(c)).toBe(90_000);
        const later = visibleRecs([c], T0 + 91_000);
        expect(later).toHaveLength(0);
    });
});

describe('visibleRecs budgets + role weighting', () => {
    it('caps each category at its budget, best first', () => {
        const items = Array.from({ length: 8 }, (_, i) =>
            rec({ category: 'ITEM', title: `item${i}`, priority: i }));
        const out = visibleRecs(items, T0);
        expect(out.filter(r => r.category === 'ITEM')).toHaveLength(4);
        expect(out[0].title).toBe('item7'); // highest priority survived
    });

    it('role reorders without filtering', () => {
        const fight = rec({ category: 'FIGHT', title: 'fight', priority: 3 });
        const item = rec({ category: 'ITEM', title: 'item', priority: 3 });
        const carryFirst = visibleRecs([fight, item], T0, 'carry');
        const suppFirst = visibleRecs([fight, item], T0, 'hard_support');
        expect(carryFirst[0].title).toBe('item');
        expect(suppFirst[0].title).toBe('fight');
        expect(carryFirst).toHaveLength(2); // nothing filtered by role
    });
});

describe('pickPriorityAction', () => {
    it('only considers the 2-minute NOW window', () => {
        const stale = rec({ title: 'stale', priority: 9, receivedAt: T0 - 130_000 });
        const fresh = rec({ title: 'fresh', priority: 2, receivedAt: T0 - 10_000 });
        expect(pickPriorityAction([stale, fresh], T0)?.title).toBe('fresh');
    });

    it('CRITICAL outranks priority', () => {
        const big = rec({ title: 'big', priority: 9, urgency: 'IMPORTANT' });
        const crit = rec({ title: 'crit', priority: 1, urgency: 'CRITICAL' });
        expect(pickPriorityAction([big, crit], T0)?.title).toBe('crit');
    });

    it('returns null when nothing is fresh', () => {
        expect(pickPriorityAction([rec({ receivedAt: T0 - 500_000 })], T0)).toBeNull();
    });
});

describe('isLiveCoaching', () => {
    it('is field-based, not title-based', () => {
        expect(isLiveCoaching(rec({ tier: 'ANALYTICAL', title: 'no prefix here' }))).toBe(true);
        expect(isLiveCoaching(rec({ tier: 'FAST', title: 'Raijin says hello' }))).toBe(false);
        expect(isLiveCoaching(rec({ tier: 'ANALYTICAL', tags: ['death'] }))).toBe(false);
    });
});
