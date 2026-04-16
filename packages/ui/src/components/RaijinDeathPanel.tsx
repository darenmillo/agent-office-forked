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
    // Phase 5c: find the Sonnet "Coach says" rec separately from the sync
    // _on_death bundle so we can render it in a dedicated card and keep it
    // visible past the respawn timer.
    const { headline, extras, coachSays } = useMemo(() => {
        const allDeathTagged = recommendations.filter(r => r.tags?.includes('death'));
        const sorted = [...allDeathTagged].sort(
            (a, b) => (b.receivedAt ?? 0) - (a.receivedAt ?? 0)
        );
        const analysis = sorted.find(
            r => r.tags?.includes('llm') && r.tags?.includes('analysis'),
        ) ?? null;
        const headlineRec = sorted.find(
            r => !(r.tags?.includes('llm') && r.tags?.includes('analysis')),
        ) ?? null;
        const now = Date.now();
        const recentFlushed = recommendations
            .filter(r => !r.tags?.includes('death'))
            .filter(r => now - (r.receivedAt ?? now) < 10_000)
            .filter(r => effectiveUrgency(r) !== 'CRITICAL')
            .slice(0, 5);
        return { headline: headlineRec, extras: recentFlushed, coachSays: analysis };
    }, [recommendations]);

    const alive = heroData?.alive ?? true;
    // Coach says persists for 45s after arrival so it stays visible past a
    // quick Crusader respawn (10–16s).
    const coachSaysFresh = coachSays
        && (Date.now() - (coachSays.receivedAt ?? 0)) < 45_000;

    if (!heroData) return null;
    // Skip if alive AND no fresh coach-says to persist
    if (alive && !coachSaysFresh) return null;

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
                className={alive ? 'raijin-death-panel-compact' : 'raijin-death-panel'}
                role="region"
                aria-label={alive ? 'Coach says — last death' : 'Death coaching panel'}
                style={{
                    position: 'absolute',
                    // Centred over the empty left column, above the action bar
                    top: 110,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 'min(540px, 40vw)',
                    padding: pip.sp4,
                    background: pip.bgPanel,
                    border: `3px solid ${alive ? pip.amber : pip.red}`,
                    boxShadow: glow(alive ? pip.amber : pip.red, alive ? 8 : 16),
                    fontFamily: pip.font,
                    color: pip.amber,
                    zIndex: 15,
                }}
            >
                {/* Header — differs by state */}
                {!alive ? (
                    <>
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
                        <div style={{
                            fontSize: pip.textLg,
                            color: pip.amber,
                            textAlign: 'center',
                            marginBottom: pip.sp3,
                            textShadow: glowText(pip.amber, 4),
                        }}>
                            SPEND YOUR {gold}g BEFORE RESPAWNING
                        </div>
                    </>
                ) : (
                    <div style={{
                        fontSize: pip.textLg,
                        fontWeight: 700,
                        color: pip.amber,
                        letterSpacing: 1,
                        textShadow: glowText(pip.amber, 4),
                        textAlign: 'center',
                        marginBottom: pip.sp3,
                    }}>
                        COACH SAYS — LAST DEATH
                    </div>
                )}

                {/* Phase 5c Sonnet "Coach says" — pinned above the sync headline */}
                {coachSays && (
                    <div
                        className="raijin-coach-says"
                        style={{
                            borderLeft: `3px solid ${pip.amberBright}`,
                            padding: `${pip.sp2}px ${pip.sp3}px`,
                            marginBottom: pip.sp3,
                            background: pip.bgInset,
                        }}>
                        <div style={{
                            fontSize: pip.textXs,
                            letterSpacing: 1,
                            color: pip.amberFaint,
                            marginBottom: pip.sp1,
                            textTransform: 'uppercase',
                        }}>
                            Coach says
                        </div>
                        <div style={{
                            fontSize: pip.textBase,
                            color: pip.amber,
                            lineHeight: 1.5,
                            whiteSpace: 'pre-wrap',
                        }}>
                            {coachSays.body}
                        </div>
                    </div>
                )}

                {/* Only render the sync bundle while actually dead */}
                {!alive && headline && (
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

                {!alive && extras.length > 0 && (
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
