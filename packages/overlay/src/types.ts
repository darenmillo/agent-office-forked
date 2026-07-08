/** Minimal WS message contracts for the overlay strip.
 *
 * Deliberately DUPLICATED (not imported) from `@agent-office/ui`'s
 * `raijinTypes.ts` — the ui package drags React/Phaser type surface the
 * overlay does not want, and the overlay must stay runnable when the ui
 * workspace is mid-refactor. Source of truth for shapes:
 * `packages/ui/src/raijinTypes.ts`. Keep field names in sync; the engine
 * broadcast is the shared contract (zero backend change for Phase 2).
 */

export type RecUrgency = 'CRITICAL' | 'IMPORTANT' | 'ROUTINE';

export interface Recommendation {
    category: 'ITEM' | 'SKILL' | 'TIMER' | 'FIGHT' | 'GENERAL';
    priority: number;
    tier: 'INSTANT' | 'FAST' | 'ANALYTICAL';
    title: string;
    body: string;
    reason?: string;
    timestamp: number;
    /** Epoch ms when the overlay received this rec. */
    receivedAt: number;
    urgency?: RecUrgency;
    tags?: string[];
}

/** Mirrors `raijinTypes.effectiveUrgency` (backend `urgency_from_priority`). */
export function effectiveUrgency(rec: Recommendation): RecUrgency {
    if (rec.urgency) return rec.urgency;
    if (rec.priority >= 5) return 'CRITICAL';
    if (rec.priority >= 3) return 'IMPORTANT';
    return 'ROUTINE';
}

export interface StanceData {
    stance: 'FARM' | 'FIGHT' | 'PUSH';
    reason: string;
    confidence: number;
    discipline: boolean;
}

export interface TimerRailData {
    clock: number;
    next_stack?: number;
    next_power_rune?: number;
    next_bounty?: number;
    tormentor?: { status: 'pending' | 'respawning' | 'up'; at: number | null };
    roshan?: { status: 'unknown' | 'dead' | 'window' | 'up'; early: number | null; late: number | null };
    aegis?: { expires_at: number };
}

export interface UIUpdate {
    type: string;
    data: Record<string, unknown>;
    timestamp: number;
}

export const RAIJIN_WS = 'ws://localhost:4000/ws';

/** Direction C: the palette IS the stance (bcast tokens, raijinTheme.ts). */
export function stanceColor(stance: string | null): string {
    switch (stance) {
        case 'FARM':
            return '#4FA3FF';
        case 'FIGHT':
            return '#FF6A3D';
        case 'PUSH':
            return '#F5C518';
        default:
            return '#8A94A6';
    }
}
