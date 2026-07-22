/** rc-audit R1 verdict C — Director-lite: a tiny pure state machine over the
 *  shipped 8-zone grid ("keep the shell, give it a clock").
 *
 *  Four board states re-rank the same zones — no zone ever moves or
 *  disappears; it inherits LEAD / SUPPORT / DIM from the state (concept 1a's
 *  "zones never appear/disappear — they re-weight", scoped to the ledger's
 *  four states; 1a's BREWING/CRISIS beats are future refinements and need
 *  missing-count / rosh-window inputs the feed doesn't carry yet).
 *
 *  Pure GSI inputs, no LLM in the loop — cuts are instant and never wrong.
 *  Also home to the responsive-mode ladder (rows 42-43): narrower widths
 *  render fewer ranks, never smaller text.
 */

export type BoardState = 'LANING' | 'MID' | 'DEAD' | 'POSTGAME';
export type ZoneRank = 'LEAD' | 'SUPPORT' | 'DIM';
export type ZoneId = 'z01' | 'z02' | 'z03' | 'z04' | 'z05' | 'z06' | 'z07' | 'z08';
export type ResponsiveMode = 'full' | 'compact' | 'stack';

export interface DirectorInput {
    /** Extrapolated game clock (s); null when unknown. */
    clock: number | null;
    alive: boolean;
    gameEnded: boolean;
}

export interface DirectorVerdict {
    state: BoardState;
    ranks: Record<ZoneId, ZoneRank>;
}

/** Laning ends at minute 12 (the ledger's LANING window). */
export const LANING_ENDS_S = 720;

/** Below this stage scale the map drops + threat collapses to the rail (row 42). */
export const COMPACT_BELOW = 0.66;

/** Below this the grid is replaced by the stack layout (row 43) — scaling
 *  desktop chrome under this point yields ~8-9px effective text, which the
 *  audit called broken. w768 = 0.40. */
export const STACK_BELOW = 0.42;

const RANKS: Record<BoardState, Record<ZoneId, ZoneRank>> = {
    // Lead = your lane (matchup card in 07) + the CS/trade log. Map dark,
    // tape compressed, chart small. The one thing: win your lane.
    LANING: {
        z01: 'SUPPORT', z02: 'SUPPORT', z03: 'LEAD', z04: 'SUPPORT',
        z05: 'DIM', z06: 'SUPPORT', z07: 'LEAD', z08: 'DIM',
    },
    // Lead = the directive — the only imperative voice on the board.
    MID: {
        z01: 'LEAD', z02: 'SUPPORT', z03: 'SUPPORT', z04: 'SUPPORT',
        z05: 'DIM', z06: 'SUPPORT', z07: 'SUPPORT', z08: 'SUPPORT',
    },
    // Lead = the docked respawn panel (an overlay, not a zone) — so no zone
    // claims LEAD. Chart stays readable ("deaths are the gap"); build/threat
    // hold compressed, never gone.
    DEAD: {
        z01: 'SUPPORT', z02: 'SUPPORT', z03: 'SUPPORT', z04: 'SUPPORT',
        z05: 'DIM', z06: 'DIM', z07: 'DIM', z08: 'SUPPORT',
    },
    // Lead = the verdict takeover in Zone01; the chart is the scrubbable
    // evidence; live-coaching zones retire (urgency colors die with them).
    POSTGAME: {
        z01: 'LEAD', z02: 'SUPPORT', z03: 'SUPPORT', z04: 'SUPPORT',
        z05: 'DIM', z06: 'DIM', z07: 'DIM', z08: 'SUPPORT',
    },
};

/** The Director. Precedence: POSTGAME > DEAD > LANING > MID; an unknown
 *  clock never guesses LANING. */
export function boardState(input: DirectorInput): DirectorVerdict {
    const state: BoardState = input.gameEnded
        ? 'POSTGAME'
        : !input.alive
            ? 'DEAD'
            : input.clock !== null && input.clock < LANING_ENDS_S
                ? 'LANING'
                : 'MID';
    return { state, ranks: RANKS[state] };
}

/** Responsive rank ladder (rows 42-43): full grid, then the map drops and
 *  threat collapses to a rail (compact), then the stack replaces the grid
 *  entirely (stack — text at natural size, never scaled below legibility).
 *  // row 44: below ~560px the phone companion strip would fork here — a
 *  second product surface, owner decision (docs/design/raijin/ROW44 note);
 *  until then those widths render the stack. */
export function responsiveMode(scale: number): ResponsiveMode {
    if (scale >= COMPACT_BELOW) return 'full';
    if (scale >= STACK_BELOW) return 'compact';
    return 'stack';
}

/** Rank → dimming treatment. DIM zones desaturate/quiet; LEAD/SUPPORT stay
 *  full voice (LEAD additionally gets track weight from the grid). */
export function rankOpacity(rank: ZoneRank): number {
    return rank === 'DIM' ? 0.4 : 1;
}
