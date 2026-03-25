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
    type: 'hero_status' | 'recommendations' | 'game_plan' | 'action_bar' | 'connection' | 'game_ended';
    data: Record<string, unknown>;
    timestamp: number;
}

export const RAIJIN_API = 'http://localhost:4000';
export const RAIJIN_WS = 'ws://localhost:4000/ws';
