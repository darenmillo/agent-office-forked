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
}

export interface UIUpdate {
    type: 'hero_status' | 'recommendations' | 'game_plan' | 'action_bar' | 'connection' | 'game_ended' | 'enemy_intel';
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

export const RAIJIN_API = 'http://localhost:4000';
export const RAIJIN_WS = 'ws://localhost:4000/ws';

/** Steam CDN for item icons (88x64 originals). */
export const ITEM_ICON_CDN = 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items';
