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
}

export type RecUrgency = 'CRITICAL' | 'IMPORTANT' | 'ROUTINE';

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

export type EnemySource = 'gsi_draft' | 'bot' | 'manual' | 'none';

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
        | 'settings_update';
    data: Record<string, unknown>;
    timestamp: number;
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
    ultimate_state: number;    // always 0 (not available from API)
    ultimate_cooldown: number; // always 0
    respawn_timer: number;     // always 0
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
    grade: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
    score: number;
    callout: string;
}

/** Opus 4.7-produced structured coaching narrative (Phase 5a). Three action cards + summary. */
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
