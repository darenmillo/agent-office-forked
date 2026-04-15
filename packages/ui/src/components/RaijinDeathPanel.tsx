/** RaijinDeathPanel — CRITICAL coaching card shown during the respawn window.
 *
 * Content scoped to data that actually exists (per audit decision — GSI and
 * GetRealtimeStats do NOT provide per-death damage source breakdowns):
 *   - Respawn timer countdown
 *   - Gold to spend before respawn
 *   - The most recent CRITICAL / IMPORTANT rec with the 'death' tag (async LLM
 *     tip arrives here via the normal recommendations stream)
 *   - Flushed deferred rec titles from the Phase 1b buffer
 *
 * Visible only when `heroData.alive === false`. Auto-hides on respawn.
 * All animations respect prefers-reduced-motion.
 */
import React, { useMemo } from 'react';
import { HeroData, Recommendation, effectiveUrgency } from '../raijinTypes';
import { pip, glow, glowText } from '../raijinTheme';

interface Props {
    heroData: HeroData | null;
    recommendations: Recommendation[];
}

export function RaijinDeathPanel({ heroData, recommendations }: Props) {
    // Only render while dead
    if (!heroData || heroData.alive) return null;

    // Most-recent death-tagged rec (the backend's _on_death bundle)
    const { headline, extras } = useMemo(() => {
        const deathTagged = recommendations.filter(r => r.tags?.includes('death'));
        // Sort by receivedAt descending — newest first
        const sorted = [...deathTagged].sort(
            (a, b) => (b.receivedAt ?? 0) - (a.receivedAt ?? 0)
        );
        const headlineRec = sorted[0] ?? null;
        // Non-death tagged recs that are fresh (< 10s) = flushed deferred buffer
        const now = Date.now();
        const recentFlushed = recommendations
            .filter(r => !r.tags?.includes('death'))
            .filter(r => now - (r.receivedAt ?? now) < 10_000)
            .filter(r => effectiveUrgency(r) !== 'CRITICAL')
            .slice(0, 5);
        return { headline: headlineRec, extras: recentFlushed };
    }, [recommendations]);

    const gold = heroData.gold ?? 0;
    const respawn = heroData.respawn_seconds ?? 0;

    return (
        <>
            <style>{`
                @keyframes raijin-death-pulse {
                    0%, 100% {
                        border-color: ${pip.red};
                        box-shadow: ${glow(pip.red, 12)};
                    }
                    50% {
                        border-color: ${pip.amberBright};
                        box-shadow: ${glow(pip.red, 24)};
                    }
                }
                .raijin-death-panel {
                    animation: raijin-death-pulse 2s ease-in-out infinite;
                }
                @media (prefers-reduced-motion: reduce) {
                    .raijin-death-panel {
                        animation: none;
                    }
                }
            `}</style>
            <div
                className="raijin-death-panel"
                role="region"
                aria-label="Death coaching panel"
                style={{
                    position: 'absolute',
                    // Centred over the empty left column, above the action bar
                    top: 110,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 'min(540px, 40vw)',
                    padding: pip.sp4,
                    background: pip.bgPanel,
                    border: `3px solid ${pip.red}`,
                    boxShadow: glow(pip.red, 16),
                    fontFamily: pip.font,
                    color: pip.amber,
                    zIndex: 15,
                }}
            >
                {/* Header */}
                <div style={{
                    fontSize: pip.text2xl,
                    fontWeight: 700,
                    color: pip.red,
                    letterSpacing: 2,
                    textShadow: glowText(pip.red, 8),
                    textAlign: 'center',
                    marginBottom: pip.sp3,
                }}>
                    DEAD — RESPAWN {respawn}s
                </div>

                {/* Gold prompt */}
                <div style={{
                    fontSize: pip.textLg,
                    color: pip.amber,
                    textAlign: 'center',
                    marginBottom: pip.sp3,
                    textShadow: glowText(pip.amber, 4),
                }}>
                    SPEND YOUR {gold}g BEFORE RESPAWNING
                </div>

                {/* Headline rec (from _on_death bundle) */}
                {headline && (
                    <div style={{
                        borderLeft: `3px solid ${pip.red}`,
                        padding: `${pip.sp2}px ${pip.sp3}px`,
                        marginTop: pip.sp3,
                        background: pip.bgInset,
                    }}>
                        <div style={{
                            fontSize: pip.textBase,
                            fontWeight: 700,
                            color: pip.amber,
                            marginBottom: pip.sp1,
                        }}>
                            {headline.title}
                        </div>
                        <div style={{
                            fontSize: pip.textBase,
                            color: pip.amber,
                            lineHeight: 1.5,
                        }}>
                            {headline.body}
                        </div>
                    </div>
                )}

                {/* Flushed deferred recs from the throttle buffer */}
                {extras.length > 0 && (
                    <div style={{ marginTop: pip.sp3 }}>
                        <div style={{
                            fontSize: pip.textXs,
                            color: pip.amberDim,
                            letterSpacing: 1,
                            marginBottom: pip.sp1,
                            textTransform: 'uppercase',
                        }}>
                            Queued during the fight:
                        </div>
                        {extras.map((rec, i) => (
                            <div
                                key={i}
                                style={{
                                    fontSize: pip.textSm,
                                    color: pip.amber,
                                    lineHeight: 1.4,
                                    marginBottom: 2,
                                }}
                            >
                                {'\u2022 '} {rec.title}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}
