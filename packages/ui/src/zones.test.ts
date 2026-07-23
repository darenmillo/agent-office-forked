/** rc-audit R1 — U3 zone-logic tests (rows 09/11/12/13/14/28/30/33/34/35/36/38).
 *  Pure-logic suite (node env): every behavior under test lives in console.ts
 *  helpers consumed by Zone03/05/06/07 + ConsoleHeader. */
import {
    cardSpecies, itemChips, filterDirectiveOwned, mergeNextEcho,
    logLayout, LOG_FOOTNOTE_AGE_MS, normalizeDashes, mapCaption,
    laneMatchupRows, laneRowLine, laneHonestLine, likelyNextLine,
    rosterTail, zone07Mode,
} from './console';
import { EnemyPlayerData, Recommendation } from './raijinTypes';

const T0 = 1_700_000_000_000;

function rec(partial: Partial<Recommendation>): Recommendation {
    return {
        category: 'ITEM',
        priority: 3,
        tier: 'FAST',
        title: 'Next item: Vanguard',
        body: 'body',
        timestamp: T0 / 1000,
        receivedAt: T0,
        ...partial,
    } as Recommendation;
}

function enemy(partial: Partial<EnemyPlayerData>): EnemyPlayerData {
    return {
        hero_id: 6, hero_name: 'npc_dota_hero_drow_ranger', team: 'dire',
        level: 8, kills: 2, deaths: 1, assists: 3, items: [], net_worth: 5000,
        ...partial,
    } as EnemyPlayerData;
}

// ── row 09: card anatomy = provenance ───────────────────────────────────

describe('cardSpecies (row 09)', () => {
    it('slotted rec with an item slug is the build species', () => {
        const r = rec({ meta: { build_slot: 'next', item: 'vanguard', cost: 1700 } });
        expect(cardSpecies(r)).toBe('build');
    });
    it('a slotless CRITICAL nag can never wear build-card clothes', () => {
        const tp = rec({ title: 'BUY TP SCROLL', priority: 5, urgency: 'CRITICAL' });
        expect(cardSpecies(tp)).toBe('nag');
    });
    it('slotted without an item slug degrades to nag (no icon → no card frame)', () => {
        expect(cardSpecies(rec({ meta: { build_slot: 'next' } }))).toBe('nag');
    });
    it('null passes through', () => {
        expect(cardSpecies(null)).toBeNull();
    });
});

// ── rows 11/12: chips render whole; AFTER compacts MED before N ─────────

describe('itemChips (rows 11/12)', () => {
    const meta = { item: 'vanguard', cost: 1700, median_minute: 10.2, win_rate: 0.53, matches: 49_300 };
    it('full chip order is cost · MED · WR · N', () => {
        expect(itemChips(meta)).toEqual(['1700G', "MED 10'", '53% WR', 'N=49.3K']);
    });
    it('compact drops MED before N (row 12)', () => {
        expect(itemChips(meta, { compact: true })).toEqual(['1700G', '53% WR', 'N=49.3K']);
    });
    it('only real values render — empty meta yields no chips', () => {
        expect(itemChips({})).toEqual([]);
    });
    it('sub-1000 sample renders unabbreviated', () => {
        expect(itemChips({ matches: 640 })).toEqual(['N=640']);
    });
});

// ── rows 13/14: directive ownership + merged echo ───────────────────────

describe('directive dedupe (rows 13/14)', () => {
    it('filterDirectiveOwned removes exactly the owned key', () => {
        const a = rec({ title: 'BUY TP SCROLL', category: 'ITEM' });
        const b = rec({ title: 'Black King Bar pivot', category: 'ITEM' });
        expect(filterDirectiveOwned([a, b], 'ITEM|BUY TP SCROLL')).toEqual([b]);
    });
    it('null directive key filters nothing', () => {
        const a = rec({});
        expect(filterDirectiveOwned([a], null)).toEqual([a]);
        expect(filterDirectiveOwned([a], undefined)).toEqual([a]);
    });
    // 07-23 hunt uilogic-2 contract change: the merge requires the directive
    // key to BE the NEXT rec — the old gold-target flag produced false
    // "IN DIRECTIVE" claims for any costed pickup owning Zone01.
    it('mergeNextEcho fires only when the directive IS the NEXT rec', () => {
        const next = rec({ category: 'ITEM', title: 'Next item: Vanguard' });
        expect(mergeNextEcho('ITEM|Next item: Vanguard', next)).toBe(true);
        expect(mergeNextEcho('ITEM|Buy BKB now', next)).toBe(false);
        expect(mergeNextEcho(null, next)).toBe(false);
        expect(mergeNextEcho('ITEM|Next item: Vanguard', null)).toBe(false);
    });
});

// ── row 28: log decay ordering + footnotes ──────────────────────────────

describe('logLayout (row 28)', () => {
    it('stale entries (>10 min) compress to footnotes', () => {
        const fresh = rec({ title: 'fresh', receivedAt: T0 - 30_000 });
        const stale = rec({ title: 'min-9 death at min 58', receivedAt: T0 - LOG_FOOTNOTE_AGE_MS - 1 });
        const out = logLayout([fresh, stale], T0);
        expect(out.full.map(r => r.title)).toEqual(['fresh']);
        expect(out.footnotes.map(r => r.title)).toEqual(['min-9 death at min 58']);
    });
    it('recency × severity: a fresh IMPORTANT outranks a decayed CRITICAL', () => {
        const oldCrit = rec({ title: 'old crit', urgency: 'CRITICAL', receivedAt: T0 - 9 * 60_000 });
        const freshImp = rec({ title: 'fresh imp', urgency: 'IMPORTANT', receivedAt: T0 - 10_000 });
        const out = logLayout([oldCrit, freshImp], T0);
        expect(out.full.map(r => r.title)).toEqual(['fresh imp', 'old crit']);
    });
    it('fresh CRITICAL still outranks fresh ROUTINE', () => {
        const crit = rec({ title: 'crit', urgency: 'CRITICAL', receivedAt: T0 - 20_000 });
        const routine = rec({ title: 'routine', urgency: 'ROUTINE', receivedAt: T0 - 10_000 });
        const out = logLayout([routine, crit], T0);
        expect(out.full[0].title).toBe('crit');
    });
    it('footnotes order newest-first', () => {
        const older = rec({ title: 'older', receivedAt: T0 - 20 * 60_000 });
        const newer = rec({ title: 'newer', receivedAt: T0 - 12 * 60_000 });
        const out = logLayout([older, newer], T0);
        expect(out.footnotes.map(r => r.title)).toEqual(['newer', 'older']);
    });
});

// ── row 30: dash normalization ──────────────────────────────────────────

describe('normalizeDashes (row 30)', () => {
    it('space-delimited double hyphens become em-dashes', () => {
        expect(normalizeDashes('reset -- spend your gold')).toBe('reset — spend your gold');
        expect(normalizeDashes('reset - - spend')).toBe('reset — spend');
    });
    it('negative numbers and compound tokens survive', () => {
        expect(normalizeDashes('gap -42 g')).toBe('gap -42 g');
        expect(normalizeDashes('flex--wrap')).toBe('flex--wrap');
    });
    it('trailing artifact normalizes', () => {
        expect(normalizeDashes('even trade --')).toBe('even trade —');
    });
});

// ── row 33: map caption honesty ─────────────────────────────────────────

describe('mapCaption (row 33)', () => {
    it('zero deaths', () => {
        expect(mapCaption(0, 0)).toBe('No deaths this game.');
    });
    it('marked spots state what IS shown — no cluster promise', () => {
        const c = mapCaption(3, 3);
        expect(c).toContain('3 deaths');
        expect(c).toContain('marked where they happened');
        expect(c.toLowerCase()).not.toContain('cluster');
    });
    it('deaths without spots stay honest about pending marks', () => {
        const c = mapCaption(1, 0);
        expect(c).toContain('1 death');
        expect(c.toLowerCase()).not.toContain('cluster');
    });
});

// ── rows 34/38: lane matchup card ───────────────────────────────────────

const LANE = {
    '6': { matches: 11_306, lane_win_rate: 0.2426, stomp_loss_rate: 0.1838 },
    '81': { matches: 8_200, lane_win_rate: 0.51, stomp_loss_rate: 0.09 },
    '9': { matches: 900, lane_win_rate: null, stomp_loss_rate: 0.12 },
};
const PLAYERS = [
    enemy({ hero_id: 6, hero_name: 'npc_dota_hero_drow_ranger' }),
    enemy({ hero_id: 81, hero_name: 'npc_dota_hero_chaos_knight' }),
    enemy({ hero_id: 9, hero_name: 'npc_dota_hero_mirana' }),
];

describe('laneMatchupRows (rows 34/38)', () => {
    it('sorts worst lane first; null win rates sink to the end', () => {
        const rows = laneMatchupRows(LANE, PLAYERS, 3);
        expect(rows.map(r => r.name)).toEqual(['drow ranger', 'chaos knight', 'mirana']);
        expect(rows[0].winPct).toBe(24);
        expect(rows[2].winPct).toBeNull();
    });
    it('ids without a resolvable name are skipped — real-or-absent', () => {
        const rows = laneMatchupRows({ '999': LANE['6'] }, PLAYERS, 3);
        expect(rows).toEqual([]);
    });
    it('cold/absent input renders nothing', () => {
        expect(laneMatchupRows(undefined, PLAYERS, 3)).toEqual([]);
        expect(laneMatchupRows({}, PLAYERS, 3)).toEqual([]);
    });
    it('copy law: "win it only X%" — never the inverse, never "lose"', () => {
        const line = laneRowLine(laneMatchupRows(LANE, PLAYERS, 1)[0]);
        expect(line).toContain('win it only 24%');
        expect(line).not.toContain('76%');
        expect(line.toLowerCase()).not.toContain('lose');
    });
    it('null win rate line falls back to stomp risk only', () => {
        const row = laneMatchupRows({ '9': LANE['9'] }, PLAYERS, 1)[0];
        const line = laneRowLine(row);
        expect(line).not.toContain('win it only');
        expect(line).toContain('stomp risk 12%');
    });
    it('the honest line names the highest stomp risk', () => {
        const line = laneHonestLine(laneMatchupRows(LANE, PLAYERS, 3));
        expect(line).toContain('DROW RANGER');
        expect(line).toContain('18%');
    });
    it('honest line is null when no rows', () => {
        expect(laneHonestLine([])).toBeNull();
    });
});

// ── row 35: likely-next line ────────────────────────────────────────────

describe('likelyNextLine (row 35)', () => {
    it('top two predicted items, prettified, with the sample suffix', () => {
        const line = likelyNextLine([
            { item: 'black_king_bar', count: 3, n_builds: 3 },
            { item: 'blink', count: 2, n_builds: 3 },
            { item: 'shivas_guard', count: 1, n_builds: 3 },
        ]);
        expect(line).toBe('LIKELY NEXT: BLACK KING BAR · BLINK — HIGH-MMR n=3');
    });
    it('absent/empty → null (real-or-absent)', () => {
        expect(likelyNextLine(undefined)).toBeNull();
        expect(likelyNextLine([])).toBeNull();
    });
});

// ── row 36: roster tail ─────────────────────────────────────────────────

describe('rosterTail (row 36)', () => {
    const others = [
        enemy({ hero_name: 'npc_dota_hero_snapfire', net_worth: 7300 }),
        enemy({ hero_name: 'npc_dota_hero_vengefulspirit', net_worth: 7000 }),
        enemy({ hero_name: 'npc_dota_hero_chaos_knight', net_worth: 6100 }),
        enemy({ hero_name: 'npc_dota_hero_mirana', net_worth: 5800 }),
    ];
    it('top-2 by net worth + the +N MORE suffix', () => {
        expect(rosterTail(others)).toBe('SNAPFIRE 7.3k · VENGEFULSPIRIT 7.0k · +2 MORE');
    });
    it('two or fewer render without a suffix', () => {
        expect(rosterTail(others.slice(0, 2))).toBe('SNAPFIRE 7.3k · VENGEFULSPIRIT 7.0k');
        expect(rosterTail([])).toBe('');
    });
});

// ── rows 34/38: zone-07 mode ────────────────────────────────────────────

describe('zone07Mode (rows 34/38)', () => {
    it('lane leads 0:00–12:00 when matchup rows exist', () => {
        expect(zone07Mode(false, 2, 300)).toBe('lane');
        expect(zone07Mode(true, 2, 300)).toBe('lane');
    });
    it('yields to threat after 12:00', () => {
        expect(zone07Mode(true, 2, 800)).toBe('threat');
        expect(zone07Mode(false, 2, 800)).toBe('awaiting');
    });
    it('awaiting when nothing is real', () => {
        expect(zone07Mode(false, 0, 300)).toBe('awaiting');
        expect(zone07Mode(false, 0, null)).toBe('awaiting');
    });
    it('unwired clock: lane only pre-threat', () => {
        expect(zone07Mode(false, 2, null)).toBe('lane');
        expect(zone07Mode(true, 2, null)).toBe('threat');
    });
});
