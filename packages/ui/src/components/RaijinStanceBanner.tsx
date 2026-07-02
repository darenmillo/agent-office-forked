/** v6 Phase 3: FARM / FIGHT / PUSH stance banner — the one-glance answer to
 *  "what should I be doing right now". Rules decide server-side; this renders
 *  the decision + reason. FARM amber, FIGHT red pulse, PUSH green; discipline
 *  mode gets a hazard treatment (the "AFK farm your item" nudge). */
import React from 'react';
import { pip, glow, glowText } from '../raijinTheme';
import type { StanceData } from '../raijinTypes';

const STANCE_COLOR: Record<string, string> = {
    FARM: pip.amber,
    FIGHT: pip.catFight,
    PUSH: pip.green,
};

export function RaijinStanceBanner({ stance }: { stance: StanceData | null }) {
    if (!stance) return null;
    const color = STANCE_COLOR[stance.stance] ?? pip.amber;
    const pulse = stance.stance === 'FIGHT' || stance.discipline;

    return (
        <div
            style={{
                gridColumn: '1 / -1',
                display: 'flex',
                alignItems: 'center',
                gap: pip.sp4,
                background: pip.bgPanel,
                border: `2px solid ${color}`,
                boxShadow: pulse ? glow(color, 10) : glow(color, 4),
                padding: `${pip.sp2}px ${pip.sp4}px`,
                fontFamily: pip.font,
                animation: pulse ? 'raijin-stance-pulse 1.5s ease-in-out infinite' : undefined,
            }}
        >
            <style>{`
                @keyframes raijin-stance-pulse {
                    0%, 100% { box-shadow: 0 0 4px ${color}; }
                    50% { box-shadow: 0 0 14px ${color}; }
                }
                @media (prefers-reduced-motion: reduce) {
                    [data-stance-banner] { animation: none !important; }
                }
            `}</style>
            <div
                data-stance-banner
                style={{
                    fontSize: pip.textXl,
                    fontWeight: 700,
                    letterSpacing: 4,
                    color,
                    textShadow: glowText(color, 6),
                    minWidth: 110,
                }}
            >
                {stance.discipline ? 'FARM ⚠' : stance.stance}
            </div>
            <div
                style={{
                    fontSize: pip.textBase,
                    color: pip.amberBright,
                    lineHeight: 1.35,
                    flex: 1,
                }}
            >
                {stance.reason}
            </div>
        </div>
    );
}
