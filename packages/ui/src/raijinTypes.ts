/** TypeScript interfaces for Raijin Recs coaching data. */

export interface HeroData {
    hero_name: string;
    hero_name_raw: string;
    hero_id: number;
    level: number;
    alive: boolean;
    respawn_seconds: number;
    health: number;
    max_health: number;
    mana: number;
    max_mana: number;
    kills: number;
    deaths: number;
    assists: number;
    last_hits: number;
    denies: number;
    gold: number;
    gold_reliable: number;
    gpm: number;
    xpm: number;
    items: string[];
    abilities: Record<string, number>;
    game_time: number;
    clock_time: number;
    game_phase: string | null;
    match_id: string | null;
    enemy_heroes: string[];
    allied_heroes: string[];
    my_team: string;
    // Wave 2 additive fields (engine ≥ feat/raijin-maxout) — render-if-present.
    /** True net worth from GSI (replaces the gold-earned proxy when present). */
    net_worth?: number;
    /** World coordinates from GSI — feed Zone 05's player dot. */
    xpos?: number;
    ypos?: number;
    /** Buyback state — Zone 01 endgame line. */
    buyback_cost?: number;
    buyback_cooldown?: number;
}

export type RecUrgency = 'CRITICAL' | 'IMPORTANT' | 'ROUTINE';

/** Trade-ledger death verdicts (Wave 2 — `Recommendation.meta.verdict`). */
export type DeathVerdict = 'TRADE' | 'EVEN_TRADE' | 'FIGHT_DEATH' | 'CAUGHT';

/** Structured ITEM-rec fields (bracket-filtered STRATZ, engine-supplied). */
export interface ItemRecMeta {
    /** CDN slug, e.g. "black_king_bar". */
    item?: string;
    cost?: number;
    median_minute?: number;
    win_rate?: number;
    matches?: number;
    share?: number;
}

/** Trade-ledger block on death recs. */
export interface DeathRecMeta {
    verdict?: DeathVerdict;
    net?: number;
    own_kills?: number;
    assists?: number;
    team_for?: number;
    team_against?: number;
    x?: number;
    y?: number;
    respawn?: number;
}

/** Latency honesty on LLM recs. */
export interface LlmRecMeta {
    latency_ms?: number;
    delivered_alive?: boolean;
}

/** Additive per-rec metadata — engine populates the block matching the rec kind. */
export type RecMeta = ItemRecMeta & DeathRecMeta & LlmRecMeta & Record<string, unknown>;

export interface Recommendation {
    category: 'ITEM' | 'SKILL' | 'TIMER' | 'FIGHT' | 'GENERAL';
    priority: number;
    tier: 'INSTANT' | 'FAST' | 'ANALYTICAL';
    title: string;
    body: string;
    reason?: string;
    timestamp: number;
    /** Epoch ms when the frontend received this rec (for age-based filtering). */
    receivedAt: number;
    /** Optional urgency tier — falls back to priority-derived when missing. */
    urgency?: RecUrgency;
    /** Optional short personality-flavored TTS variant. */
    tts_text?: string;
    /** Optional tag list — used by the UI for tag-based filtering (e.g. 'knowledge', 'phase'). */
    tags?: string[];
    /** Wave 2: additive structured metadata (item stats / death ledger / LLM latency). */
    meta?: RecMeta;
}

/**
 * Resolve the effective urgency from a rec, deriving from priority when the
 * explicit field is absent. Mirrors the backend's `urgency_from_priority`.
 */
export function effectiveUrgency(rec: Recommendation): RecUrgency {
    if (rec.urgency) return rec.urgency;
    if (rec.priority >= 5) return 'CRITICAL';
    if (rec.priority >= 3) return 'IMPORTANT';
    return 'ROUTINE';
}

// v6: minimap (GSI minimap component, pending probe) and capture (screen-
// capture portrait matching) outrank gsi_draft/bot; manual is a sticky override.
export type EnemySource = 'minimap' | 'capture' | 'gsi_draft' | 'bot' | 'manual' | 'none';

export interface BotStatus {
    status: string;
    configured: boolean;
    enemy_source: EnemySource;
    has_realtime_data: boolean;
}

export interface HeroListEntry {
    id: number;
    name: string;
    display: string;
}

export interface UIUpdate {
    type:
        | 'hero_status'
        | 'recommendations'
        | 'game_plan'
        | 'action_bar'
        | 'connection'
        | 'game_ended'
        | 'enemy_intel'
        | 'tts_audio'
        | 'settings_update'
        | 'post_game_update'    // v4.1.1: async narrative / OpenDota result landed
        | 'timers'              // v6: timer-rail state (absolute clock values)
        | 'stance'              // v6: FARM/FIGHT/PUSH stance banner
        | 'gap_baseline'        // Wave 2: reference curves for Zone 04 (honest sources)
        | 'winnability'         // Wave 2: P(win) from the offline bracket table
        | 'activity';           // A-7: pulse-check feed event
    data: Record<string, unknown>;
    timestamp: number;
}

/** Wave 2 — Zone 04 reference series. Every array is minute-indexed from 0;
 *  absent/null arrays mean that source has no data (render nothing). */
export interface GapBaselineData {
    source: string;
    /** Personal median net worth by minute (own Stratz match cache). */
    nw_by_minute?: number[] | null;
    /** Bracket-average ghost curve for this hero+position. */
    ghost_nw_by_minute?: number[] | null;
    ghost_cs_by_minute?: number[] | null;
    ghost_deaths_by_minute?: number[] | null;
    /** Honest legend label for the ghost, e.g. "CRUSADER P3 AXE AVG". */
    ghost_label?: string | null;
    /** Per-minute team gold advantage (GC bot) — null until the bot delivers. */
    team_graph_gold?: number[] | null;
    labels?: Record<string, string>;
}

/** Wave 2 — anti-tilt win probability. Absent message = sample too thin;
 *  the UI must render nothing rather than a fake number. */
export interface WinnabilityData {
    p_win: number;
    input: string;
    kill_diff?: number;
    clock?: number;
    n?: number;
    comeback_pct?: number;
    hint?: string;
}

/** v6: stance-engine decision rendered by RaijinStanceBanner. */
export interface StanceData {
    stance: 'FARM' | 'FIGHT' | 'PUSH';
    reason: string;
    confidence: number;
    discipline: boolean;
    inputs?: Record<string, unknown>;
}

/** A-7: pulse-check feed event ('activity' WS push + GET /api/activity backfill). */
export interface ActivityEvent {
    ts: number;       // unix seconds
    kind: string;     // llm | rec | error | bot | engine | stratz (open vocab)
    label: string;
    detail?: string;
    ok: boolean;
}

/** A6.4: personal hero record from GET /api/hero-card. 404 = no data = no card. */
export interface HeroCardData {
    hero_id: number;
    hero_name: string | null;
    games: number;
    wr: number;
    avg_deaths?: number;
    kda?: number;
    gpm?: number;
    /** Your WR minus bracket WR on this hero; absent when bracket unknown. */
    wr_delta?: number;
    bracket_wr?: number;
}

/** A6.2: enemy spike-forecast band riding the TIMERS rail (bracket medians). */
export interface SpikeBand {
    hero: string;
    item: string;
    /** Absolute game minute the bracket-median buyer has this item. */
    eta_minute: number;
    label: string;
}

/** v6: timer-rail snapshot (absolute game-clock values; UI extrapolates). */
export interface TimerRailData {
    clock: number;
    next_stack?: number;
    next_power_rune?: number;
    next_bounty?: number;
    next_shrine?: { at: number; xp: number };
    tormentor?: { status: 'pending' | 'respawning' | 'up'; at: number | null };
    roshan?: { status: 'unknown' | 'dead' | 'window' | 'up'; early: number | null; late: number | null };
    aegis?: { expires_at: number };
    spike_bands?: SpikeBand[];
}

/** Per-player data from GC Bot GetRealtimeStats (~2 min delayed). */
export interface EnemyPlayerData {
    hero_id: number;
    hero_name: string;
    team: string;       // "radiant" | "dire"
    level: number;
    kills: number;
    deaths: number;
    assists: number;
    items: string[];    // up to 6 item keys
    net_worth: number;
    /** Wave 2: enemy farm rate (GC deep parse) — absent on older engines. */
    last_hits?: number;
    denies?: number;
    /** Stub fields — the engine nulls these (never real); do not render. */
    ultimate_state?: number | null;
    ultimate_cooldown?: number | null;
    respawn_timer?: number | null;
}

/** Full match intel from GC Bot, broadcast every ~8s. */
export interface EnemyIntelData {
    game_time: number;
    delay_seconds: number;
    radiant_score: number;
    dire_score: number;
    radiant_tower_state: number;
    dire_tower_state: number;
    players: EnemyPlayerData[];
}

export interface DimensionGrade {
    dimension: 'farming' | 'fighting' | 'objectives' | 'map_awareness' | 'itemization';
    /** '—' = not measured (Track F honesty — e.g. objectives without
     *  tower-participation data). Render blank score + no bar. */
    grade: 'S' | 'A' | 'B' | 'C' | 'D' | 'F' | '—';
    score: number;
    callout: string;
}

/** LLM-produced structured coaching narrative (Phase 5a; model is a backend
 *  concern — don't bake model names into UI copy). Three action cards + summary. */
export interface StructuredNarrative {
    summary: string;
    what_went_well: string[];
    what_to_improve: string[];
    try_next_game: string[];
}

export interface PostGameReport {
    match_id: string;
    hero: string;
    result: 'WIN' | 'LOSS' | 'UNKNOWN';
    duration: number;
    grades: DimensionGrade[];
    /** Phase 5a: tri-state — null (not yet enriched), StructuredNarrative (new), or string (v4.0 back-compat). */
    narrative: StructuredNarrative | string | null;
    key_moments: Array<{ type: string; clock_time: number; wall_time: string; data: Record<string, unknown> }>;
}

/** Phase 5c — Sonnet 4.6 per-death analysis, persists in the death panel across respawn. */
export interface DeathAnalysis {
    likely_cause: string;
    what_to_change: string;
    item_priority: string;
}

export interface PostGameHistoryEntry {
    match_id: string;
    hero: string;
    result: string;
    duration: number;
    grades: Array<{ dimension: string; grade: string; score: number }>;
    narrative_excerpt: string;
}

export const RAIJIN_API = 'http://localhost:4000';
export const RAIJIN_WS = 'ws://localhost:4000/ws';

/** Steam CDN for item icons (88x64 originals). */
export const ITEM_ICON_CDN = 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items';

/** Steam CDN for hero portraits (used by RaijinEnemyPicker's hero grid). */
export const HERO_ICON_CDN = 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes';
