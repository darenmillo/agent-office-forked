/** rc-audit R1 verdict C — the Director-lite state machine (pure).
 *
 *  Four board states re-rank the same 8-zone grid; zones never move, they
 *  inherit LEAD / SUPPORT / DIM from the state. Precedence: POSTGAME over
 *  everything, DEAD over LANING/MID, LANING = clock < 720 while alive.
 *  Plus the responsive mode ladder (rows 42-43): full / compact / stack.
 */
import { boardState, responsiveMode, STACK_BELOW, COMPACT_BELOW } from './director';

describe('boardState — the four states', () => {
    it('LANING before minute 12 while alive', () => {
        const v = boardState({ clock: 300, alive: true, gameEnded: false });
        expect(v.state).toBe('LANING');
    });

    it('boundary: 719 is LANING, 720 is MID', () => {
        expect(boardState({ clock: 719, alive: true, gameEnded: false }).state).toBe('LANING');
        expect(boardState({ clock: 720, alive: true, gameEnded: false }).state).toBe('MID');
    });

    it('MID when clock unknown (never guess LANING off missing data)', () => {
        expect(boardState({ clock: null, alive: true, gameEnded: false }).state).toBe('MID');
    });

    it('DEAD takes precedence over LANING (death during laning)', () => {
        expect(boardState({ clock: 300, alive: false, gameEnded: false }).state).toBe('DEAD');
    });

    it('POSTGAME takes precedence over everything', () => {
        expect(boardState({ clock: 300, alive: false, gameEnded: true }).state).toBe('POSTGAME');
        expect(boardState({ clock: null, alive: true, gameEnded: true }).state).toBe('POSTGAME');
    });
});

describe('boardState — rank tables (zones never move, they re-weight)', () => {
    it('LANING: lane card + log lead; map dark; tape compressed rank', () => {
        const { ranks } = boardState({ clock: 300, alive: true, gameEnded: false });
        expect(ranks.z07).toBe('LEAD');
        expect(ranks.z03).toBe('LEAD');
        expect(ranks.z05).toBe('DIM');
        expect(ranks.z08).toBe('DIM');
        expect(ranks.z01).toBe('SUPPORT');
    });

    it('MID: the directive is the only lead voice', () => {
        const { ranks } = boardState({ clock: 1400, alive: true, gameEnded: false });
        expect(ranks.z01).toBe('LEAD');
        const leads = Object.values(ranks).filter(r => r === 'LEAD');
        expect(leads).toHaveLength(1);
        expect(ranks.z04).toBe('SUPPORT');
        expect(ranks.z06).toBe('SUPPORT');
        expect(ranks.z07).toBe('SUPPORT');
    });

    it('DEAD: no zone leads (the docked panel leads); chart stays readable', () => {
        const { ranks } = boardState({ clock: 1400, alive: false, gameEnded: false });
        expect(Object.values(ranks).filter(r => r === 'LEAD')).toHaveLength(0);
        expect(ranks.z04).toBe('SUPPORT');
        expect(ranks.z05).toBe('DIM');
        expect(ranks.z06).toBe('DIM');
    });

    it('POSTGAME: verdict takeover leads; live-coaching zones dim', () => {
        const { ranks } = boardState({ clock: 2400, alive: true, gameEnded: true });
        expect(ranks.z01).toBe('LEAD');
        expect(ranks.z05).toBe('DIM');
        expect(ranks.z06).toBe('DIM');
        expect(ranks.z07).toBe('DIM');
        expect(ranks.z04).toBe('SUPPORT'); // scrubbable evidence stays readable
    });

    it('every state ranks every zone exactly once', () => {
        for (const input of [
            { clock: 300, alive: true, gameEnded: false },
            { clock: 1400, alive: true, gameEnded: false },
            { clock: 1400, alive: false, gameEnded: false },
            { clock: 2400, alive: true, gameEnded: true },
        ]) {
            const { ranks } = boardState(input);
            expect(Object.keys(ranks).sort()).toEqual(
                ['z01', 'z02', 'z03', 'z04', 'z05', 'z06', 'z07', 'z08'],
            );
        }
    });
});

describe('responsiveMode — rows 42/43: fewer ranks, never smaller text', () => {
    it('full at and above the compact threshold', () => {
        expect(responsiveMode(0.75)).toBe('full');
        expect(responsiveMode(COMPACT_BELOW)).toBe('full');
    });

    it('compact between stack and compact thresholds (map drops first)', () => {
        expect(responsiveMode(0.65)).toBe('compact');
        expect(responsiveMode(0.5)).toBe('compact');
        expect(responsiveMode(STACK_BELOW)).toBe('compact');
    });

    it('stack below the stack threshold (w768/640/480/390)', () => {
        expect(responsiveMode(0.41)).toBe('stack');
        expect(responsiveMode(768 / 1920)).toBe('stack');
        expect(responsiveMode(390 / 1920)).toBe('stack');
    });
});
