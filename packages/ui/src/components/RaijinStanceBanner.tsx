/** StanceBanner v2 (Phase 1, #5) — the top-level strategic frame and the
 *  template every WHY-first surface copies: stance word + reason + confidence
 *  + discipline, in the Direction C stance-color model (the palette IS the
 *  stance: FARM blue / FIGHT ember / PUSH gold). */
import React from 'react';
import { bcast, bLabel, bChip, bNum, stanceColor } from '../raijinTheme';
import type { StanceData } from '../raijinTypes';

export function RaijinStanceBanner({ stance }: { stance: StanceData | null }) {
    if (!stance) return null;
    const color = stanceColor(stance.stance);
    const pulse = stance.stance === 'FIGHT' || stance.discipline;
    const confidence = Number.isFinite(stance.confidence)
        ? Math.round(stance.confidence * (stance.confidence <= 1 ? 100 : 1))
        : null;

    return (
        <section
            aria-label={`Current stance: ${stance.stance}`}
            style={{
                borderRadius: bcast.r,
                padding: '14px 16px',
                background: `linear-gradient(180deg, ${color}24, ${color}0d)`,
                border: `1px solid ${color}59`,
                fontFamily: bcast.body,
            }}
        >
            <style>{`
                @keyframes raijin-stance-breathe {
                    0%, 100% { opacity: .55; }
                    50% { opacity: 1; }
                }
                @media (prefers-reduced-motion: reduce) {
                    .raijin-stance-dot { animation: none !important; }
                }
            `}</style>
            <div style={{ ...bLabel, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                    className="raijin-stance-dot"
                    style={{
                        width: 8, height: 8, borderRadius: '50%', background: color,
                        animation: pulse ? 'raijin-stance-breathe 1.6s ease-in-out infinite' : undefined,
                    }}
                />
                Stance
            </div>
            <h3 style={{
                fontFamily: bcast.display,
                fontSize: bcast.tStance,
                margin: '3px 0 5px',
                color,
                fontWeight: 700,
                letterSpacing: '.02em',
            }}>
                {stance.stance}{stance.discipline ? ' · DISCIPLINE' : ''}
            </h3>
            <p style={{
                margin: 0,
                fontSize: bcast.tBody,
                color: bcast.ink,
                lineHeight: 1.42,
            }}>
                {stance.reason}
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                {confidence !== null && (
                    <span style={{ ...bChip, ...bNum }}>confidence {confidence}%</span>
                )}
                {stance.discipline && (
                    <span style={{ ...bChip, color }}>AFK-farm your item — resist the fight</span>
                )}
            </div>
        </section>
    );
}
