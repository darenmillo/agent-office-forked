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
import { Recommendation, RecUrgency, StanceData, effectiveUrgency } from './raijinTypes';

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

/** Zone 06 build slot on an ITEM rec ('next' | 'after' | 'pivot'), if declared. */
function itemSlot(r: Recommendation): string | undefined {
    return r.category === 'ITEM' && typeof r.meta?.build_slot === 'string'
        ? r.meta.build_slot
        : undefined;
}

/** Merge incoming recs into the store with displacement semantics. */
export function ingestRecs(
    prev: Recommendation[],
    incoming: Recommendation[],
    now: number,
): Recommendation[] {
    if (!incoming.length) return prev;
    const stamped = incoming.map(r => ({ ...r, receivedAt: r.receivedAt ?? now }));

    const newSkill = stamped.some(r => r.category === 'SKILL');
    // B5 slot-keyed displacement: a build rec (meta.build_slot) evicts only its
    // own slot and its own item; the legacy min-priority sweep now runs strictly
    // slotless-vs-slotless, so a p4 pickup can't wipe the Zone 06 build path.
    const slottedIn = stamped.filter(r => itemSlot(r) !== undefined);
    const inSlots = new Set(slottedIn.map(itemSlot));
    const inSlotItems = new Set(
        slottedIn.map(r => r.meta?.item).filter((s): s is string => typeof s === 'string'),
    );
    const slotlessItemPrios = stamped
        .filter(r => r.category === 'ITEM' && itemSlot(r) === undefined)
        .map(r => r.priority);
    // -Infinity sentinel: no incoming slotless ITEM -> no sweep at all. (The old
    // Infinity sentinel made ANY item-less batch wipe every ITEM card — the
    // Zone 06 blanking disease.)
    const minNewItemPrio = slotlessItemPrios.length ? Math.min(...slotlessItemPrios) : -Infinity;
    const newLiveCoaching = stamped.some(isLiveCoaching);
    // Same-key replacement: a rec with the same category+title is an update.
    const incomingKeys = new Set(stamped.map(r => `${r.category}|${r.title}`));

    const kept = prev.filter(old => {
        if (incomingKeys.has(`${old.category}|${old.title}`)) return false;
        if (old.category === 'SKILL' && newSkill) return false;
        if (old.category === 'ITEM') {
            const slot = itemSlot(old);
            if (slot !== undefined && inSlots.has(slot)) return false;
            if (typeof old.meta?.item === 'string' && inSlotItems.has(old.meta.item)) return false;
            if (slot === undefined && old.priority < minNewItemPrio) return false;
        }
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
const BUILD_WINDOW = 900_000; // 15 min — the Zone 06 build path persists (B5)

/** Urgency shelf lives (ms): CRITICAL is stale FAST (the moment passed). */
const URGENCY_WINDOW: Record<RecUrgency, number> = {
    CRITICAL: 90_000,
    IMPORTANT: 480_000,
    ROUTINE: 720_000,
};

/** Build-path cards (engine tags 'build') — Zone 06's persistent feed. */
function isBuild(r: Recommendation): boolean {
    return r.category === 'ITEM' && !!r.tags?.includes('build');
}

export function ageWindow(rec: Recommendation): number {
    // B5: build cards ride engine re-emission, not urgency — the urgency cap
    // would blank Zone 06 between re-emits (IMPORTANT would cut 15min to 8).
    if (isBuild(rec)) return BUILD_WINDOW;
    const cat = isKnowledge(rec) ? KNOWLEDGE_WINDOW : (CATEGORY_WINDOW[rec.category] ?? 300_000);
    return Math.min(cat, URGENCY_WINDOW[effectiveUrgency(rec)]);
}

/** Per-category display budgets (post-age-filter, best-first). */
const CATEGORY_BUDGET: Record<Recommendation['category'], number> = {
    // ITEM = 6 so NEXT + AFTER + two pivots coexist with legacy pickups (B5).
    ITEM: 6, FIGHT: 5, SKILL: 1, TIMER: 4, GENERAL: 6,
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

/** Shared cross-zone rec identity — the same category|title key the ingest
 *  replacement uses (rc-audit rows 13/14: one rec, one home). */
export const recKey = (r: Recommendation): string => `${r.category}|${r.title}`;

/** rc-audit row 01: a FARM-order discipline rec (the stance engine's own
 *  emission: GENERAL + tags 'stance' + CRITICAL) must not shout over a live
 *  FIGHT stance. The engine demotes on resolve; this is the UI's fallback
 *  guard. Suppression is deliberately scoped to FIGHT — the audited
 *  contradiction — not PUSH (objective play is farm-adjacent). */
function opposesStance(r: Recommendation, stance: StanceData | null | undefined): boolean {
    return !!stance
        && stance.stance === 'FIGHT'
        && r.category === 'GENERAL'
        && !!r.tags?.includes('stance')
        && effectiveUrgency(r) === 'CRITICAL';
}

/** The ONE priority action: freshest high-signal rec inside a tight window. */
export function pickPriorityAction(
    all: Recommendation[],
    now: number,
    role: Role | null = null,
    stance: StanceData | null = null,
): Recommendation | null {
    const WINDOW = 120_000; // priority actions are NOW actions
    // Field F3 (2026-07-09): LLM reads never own the 52px directive — a long
    // "Raijin says (30 minute mark)" body truncates unreadably there. Reads
    // render on the PHOSPHOR card / log rows / death panel instead.
    // rc-audit row 07: event announcements ('event' tag) are log/tape
    // material, never an imperative — excluded here too.
    const fresh = all.filter(
        r => now - (r.receivedAt ?? now) < WINDOW
            && !(r.tags ?? []).includes('llm')
            && !(r.tags ?? []).includes('event')
            && !opposesStance(r, stance),
    );
    if (!fresh.length) return null;
    return fresh.reduce((a, b) => (score(b, role) > score(a, role) ? b : a));
}

/** rc-audit row 13: the key currently owning Zone01 — Zone03 renders that rec
 *  as a one-glyph reference row and Zone06's situational row skips it. */
export function directiveOwnedKey(action: Recommendation | null): string | null {
    return action ? recKey(action) : null;
}

/** rc-audit row 02: the red-dwell budget. CRITICAL holds takeover red for
 *  90s from ONSET per rec key (re-fires of the same key — the TP nag every
 *  150s — do NOT reset the clock), then decays to the amber CRITICAL
 *  treatment. A genuinely new alarm (new key) re-arms red. */
const RED_DWELL_MS = 90_000;
const DWELL_KEEP = 24; // bounded memory — a game emits few distinct CRITICALs

export class DwellTracker {
    private onsets = new Map<string, number>();

    state(key: string | null, nowMs: number): 'red' | 'amber' | null {
        if (!key) return null;
        let onset = this.onsets.get(key);
        if (onset === undefined) {
            onset = nowMs;
            this.onsets.set(key, onset);
            if (this.onsets.size > DWELL_KEEP) {
                const first = this.onsets.keys().next().value;
                if (first !== undefined) this.onsets.delete(first);
            }
        }
        return nowMs - onset < RED_DWELL_MS ? 'red' : 'amber';
    }
}

/** rc-audit row 03 (the belt; the engine re-emits live numbers as the
 *  suspenders): a directive >60s old whose body embeds digits is flagged so
 *  the card can wear a STALE chip instead of asserting an old number. */
export function directiveIsStale(rec: Recommendation | null, nowMs: number): boolean {
    if (!rec) return false;
    return nowMs - (rec.receivedAt ?? nowMs) > 60_000 && /\d/.test(rec.body ?? '');
}

/** rc-audit row 25: the death panel's QUEUED list — non-death, non-CRITICAL
 *  (those have their own homes), younger than 2 minutes, deduped by key,
 *  newest first, capped at 3. */
export function pruneQueued(recs: Recommendation[], nowMs: number): Recommendation[] {
    const seen = new Set<string>();
    return recs
        .filter(r => !r.tags?.includes('death'))
        .filter(r => effectiveUrgency(r) !== 'CRITICAL')
        .filter(r => nowMs - (r.receivedAt ?? nowMs) < 120_000)
        .sort((a, b) => (b.receivedAt ?? 0) - (a.receivedAt ?? 0))
        .filter(r => {
            const k = recKey(r);
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
        })
        .slice(0, 3);
}
