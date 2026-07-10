/** PacingController — the ONE pacing model for coaching recs (Phase 1, #6).
 *
 * Replaces six disjoint spam mechanisms that lived across RaijinRecs'
 * WS handler and per-component filters:
 *   1. the `title.startsWith('Raijin says ')` live-LLM GC (fragile string match)
 *   2. REC_MAX_AGE per-category map (GENERAL = Infinity -> immortal cards)
 *   3. LIVE_LLM_MAX_AGE 8-minute special case
 *   4. SKILL displacement on new SKILL
 *   5. ITEM displacement by min-new-priority
 *   6. RaijinActionBar's private 2-minute freshness window
 *
 * One model: ingest (merge + displacement) -> visibility (age windows keyed
 * on category AND urgency) -> budget (top-N per category) -> role-weighted
 * ordering. Everything is keyed on structured fields (category / tier / tags /
 * priority / urgency / receivedAt) — never on title text.
 */
import { Recommendation, RecUrgency, effectiveUrgency } from './raijinTypes';

export type Role = 'carry' | 'mid' | 'offlane' | 'soft_support' | 'hard_support';

/** Tags that mark a rec as a distinct voice — exempt from live-LLM displacement. */
const PROTECTED_TAGS = ['death', 'matchup', 'knowledge', 'patch', 'phase'];

function isProtected(r: Recommendation): boolean {
    return !!r.tags?.some(t => PROTECTED_TAGS.includes(t));
}

/** The live-LLM coaching voice: ANALYTICAL-tier GENERAL cards without a
 *  protected tag. Field-based — replaces the title.startsWith hack. */
export function isLiveCoaching(r: Recommendation): boolean {
    return r.tier === 'ANALYTICAL' && r.category === 'GENERAL' && !isProtected(r);
}

function isKnowledge(r: Recommendation): boolean {
    return !!r.tags?.some(t => t === 'knowledge' || t === 'patch' || t === 'phase');
}

/** Max cards kept in the store (was a bare .slice(0, 50)). */
const STORE_CAP = 50;

/** Merge incoming recs into the store with displacement semantics. */
export function ingestRecs(
    prev: Recommendation[],
    incoming: Recommendation[],
    now: number,
): Recommendation[] {
    if (!incoming.length) return prev;
    const stamped = incoming.map(r => ({ ...r, receivedAt: r.receivedAt ?? now }));

    const newSkill = stamped.some(r => r.category === 'SKILL');
    const newItemPriorities = stamped.filter(r => r.category === 'ITEM').map(r => r.priority);
    const minNewItemPrio = newItemPriorities.length ? Math.min(...newItemPriorities) : Infinity;
    const newLiveCoaching = stamped.some(isLiveCoaching);
    // Same-key replacement: a rec with the same category+title is an update.
    const incomingKeys = new Set(stamped.map(r => `${r.category}|${r.title}`));

    const kept = prev.filter(old => {
        if (incomingKeys.has(`${old.category}|${old.title}`)) return false;
        if (old.category === 'SKILL' && newSkill) return false;
        if (old.category === 'ITEM' && old.priority < minNewItemPrio) return false;
        if (newLiveCoaching && isLiveCoaching(old)) return false; // one live voice at a time
        return true;
    });

    return [...stamped, ...kept].slice(0, STORE_CAP);
}

/** Category shelf lives (ms). GENERAL is finite now — no immortal cards;
 *  knowledge-tagged cards get a long window instead of Infinity. */
const CATEGORY_WINDOW: Record<Recommendation['category'], number> = {
    ITEM: 600_000,   // 10 min — items take time to farm
    FIGHT: 480_000,  // 8 min — enemy predictions stay relevant a while
    SKILL: 120_000,  // 2 min — you either skill it or you don't
    TIMER: 60_000,   // 1 min — time-sensitive by nature
    GENERAL: 360_000, // 6 min — live coaching decays
};
const KNOWLEDGE_WINDOW = 1_200_000; // 20 min — patch tips / hero knowledge

/** Urgency shelf lives (ms): CRITICAL is stale FAST (the moment passed). */
const URGENCY_WINDOW: Record<RecUrgency, number> = {
    CRITICAL: 90_000,
    IMPORTANT: 480_000,
    ROUTINE: 720_000,
};

export function ageWindow(rec: Recommendation): number {
    const cat = isKnowledge(rec) ? KNOWLEDGE_WINDOW : (CATEGORY_WINDOW[rec.category] ?? 300_000);
    return Math.min(cat, URGENCY_WINDOW[effectiveUrgency(rec)]);
}

/** Per-category display budgets (post-age-filter, best-first). */
const CATEGORY_BUDGET: Record<Recommendation['category'], number> = {
    ITEM: 4, FIGHT: 5, SKILL: 1, TIMER: 4, GENERAL: 6,
};

const URGENCY_RANK: Record<RecUrgency, number> = { CRITICAL: 2, IMPORTANT: 1, ROUTINE: 0 };

/** Role -> category boost, applied as an ordering weight (never a filter):
 *  carries glance items/timers first, supports glance fights/vision first. */
const ROLE_BOOST: Record<Role, Partial<Record<Recommendation['category'], number>>> = {
    carry: { ITEM: 2, TIMER: 1 },
    mid: { TIMER: 1, FIGHT: 1 },
    offlane: { FIGHT: 1, ITEM: 1 },
    soft_support: { FIGHT: 2, GENERAL: 1 },
    hard_support: { FIGHT: 2, GENERAL: 1 },
};

function score(rec: Recommendation, role: Role | null): number {
    const boost = role ? (ROLE_BOOST[role]?.[rec.category] ?? 0) : 0;
    return URGENCY_RANK[effectiveUrgency(rec)] * 100 + (rec.priority + boost) * 10;
}

/** Age-filter + budget + role-weighted ordering. The single source of what
 *  the UI may show. Stable for equal scores (newest first). */
export function visibleRecs(
    all: Recommendation[],
    now: number,
    role: Role | null = null,
): Recommendation[] {
    const fresh = all.filter(r => now - (r.receivedAt ?? now) < ageWindow(r));
    const byCat = new Map<string, number>();
    const ordered = [...fresh].sort(
        (a, b) => score(b, role) - score(a, role) || (b.receivedAt ?? 0) - (a.receivedAt ?? 0),
    );
    return ordered.filter(r => {
        const n = (byCat.get(r.category) ?? 0) + 1;
        byCat.set(r.category, n);
        return n <= (CATEGORY_BUDGET[r.category] ?? 3);
    });
}

/** The ONE priority action: freshest high-signal rec inside a tight window. */
export function pickPriorityAction(
    all: Recommendation[],
    now: number,
    role: Role | null = null,
): Recommendation | null {
    const WINDOW = 120_000; // priority actions are NOW actions
    // Field F3 (2026-07-09): LLM reads never own the 52px directive — a long
    // "Raijin says (30 minute mark)" body truncates unreadably there. Reads
    // render on the PHOSPHOR card / log rows / death panel instead.
    const fresh = all.filter(
        r => now - (r.receivedAt ?? now) < WINDOW && !(r.tags ?? []).includes('llm'),
    );
    if (!fresh.length) return null;
    return fresh.reduce((a, b) => (score(b, role) > score(a, role) ? b : a));
}
