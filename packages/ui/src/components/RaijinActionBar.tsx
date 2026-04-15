import React from 'react';
import { Recommendation, HeroData, effectiveUrgency } from '../raijinTypes';
import { pip, panelBase, labelStyle, glow, glowText } from '../raijinTheme';

interface Props {
    recommendations: Recommendation[];
    heroData: HeroData | null;
    ttsEnabled?: boolean;
    ttsMuted?: boolean;
    onToggleMute?: () => void;
}

export function RaijinActionBar({
    recommendations,
    heroData,
    ttsEnabled = false,
    ttsMuted = false,
    onToggleMute,
}: Props) {
    const ACTION_BAR_MAX_AGE_MS = 120_000;
    const now = Date.now();
    const freshRecs = recommendations.filter(r =>
        (now - (r.receivedAt ?? now)) < ACTION_BAR_MAX_AGE_MS
    );
    const topRec = freshRecs.length > 0
        ? freshRecs.reduce((a, b) => b.priority > a.priority ? b : a)
        : null;

    const topUrgency = topRec ? effectiveUrgency(topRec) : 'ROUTINE';
    const isCritical = topUrgency === 'CRITICAL';
    const isImportant = topUrgency === 'IMPORTANT';
    const isDead = heroData && !heroData.alive;

    const urgentBorder = isCritical ? pip.red : isImportant ? pip.amber : pip.amberFaint;

    return (
        <div
            className={isCritical ? 'raijin-actionbar-critical' : ''}
            style={{
                ...panelBase,
                gridColumn: '1 / -1',
                borderColor: urgentBorder,
                boxShadow: isCritical ? glow(pip.red, 16) : isImportant ? glow(pip.amber, 6) : undefined,
            }}
        >
            <style>{`
                @keyframes raijin-pulse {
                    0%, 100% {
                        border-color: ${pip.red};
                        box-shadow: ${glow(pip.red, 12)};
                    }
                    50% {
                        border-color: ${pip.amberBright};
                        box-shadow: ${glow(pip.red, 24)};
                    }
                }
                .raijin-actionbar-critical {
                    animation: raijin-pulse 1.5s ease-in-out infinite;
                }
                @media (prefers-reduced-motion: reduce) {
                    .raijin-actionbar-critical {
                        animation: none;
                    }
                }
            `}</style>

            <div style={{ display: 'flex', gap: pip.sp5, alignItems: 'flex-start' }}>
                {/* ── Primary Action ── */}
                <div style={{ flex: 2 }}>
                    <div style={{
                        ...labelStyle,
                        color: isCritical ? pip.red : pip.amber,
                        fontSize: pip.textSm,
                        marginBottom: pip.sp2,
                        textShadow: isCritical ? glowText(pip.red, 6) : glowText(pip.amber),
                        display: 'flex', alignItems: 'center', gap: pip.sp2,
                    }}>
                        <span>{'\u25B8'} PRIORITY ACTION</span>
                        {ttsEnabled && onToggleMute && (
                            <button
                                onClick={onToggleMute}
                                aria-label={ttsMuted ? 'Unmute voice coaching' : 'Mute voice coaching'}
                                style={{
                                    background: ttsMuted ? pip.bgInset : 'transparent',
                                    border: `1px solid ${ttsMuted ? pip.red : pip.amberFaint}`,
                                    color: ttsMuted ? pip.red : pip.amber,
                                    padding: '2px 8px',
                                    fontFamily: pip.font,
                                    fontSize: pip.textXs,
                                    letterSpacing: 1,
                                    cursor: 'pointer',
                                    textShadow: ttsMuted ? glowText(pip.red, 4) : undefined,
                                }}
                            >
                                {ttsMuted ? 'MUTED' : 'TTS ON'}
                            </button>
                        )}
                    </div>

                    {isDead ? (
                        <div>
                            <div style={{
                                fontSize: pip.textXl, fontWeight: 700,
                                color: pip.red, fontFamily: pip.font,
                                textShadow: glowText(pip.red, 8),
                            }}>
                                DEAD — RESPAWN {heroData.respawn_seconds}s
                            </div>
                            <div style={{
                                fontSize: pip.textMd, color: pip.amber,
                                fontFamily: pip.font, marginTop: pip.sp1,
                            }}>
                                Spend your {heroData.gold}g before respawning
                            </div>
                        </div>
                    ) : topRec ? (
                        <div>
                            <div style={{
                                fontSize: isCritical ? pip.textXl : pip.textLg,
                                fontWeight: 700,
                                color: isCritical ? pip.red : pip.amber,
                                fontFamily: pip.font,
                                lineHeight: 1.2,
                                textShadow: isCritical ? glowText(pip.red, 6) : glowText(pip.amber),
                            }}>
                                {topRec.title}
                            </div>
                            <div style={{
                                // Use amber (not amberDim) for body text — WCAG AA pass
                                fontSize: pip.textBase, color: pip.amber,
                                fontFamily: pip.font, marginTop: pip.sp1,
                                lineHeight: 1.5,
                            }}>
                                {topRec.body}
                            </div>
                        </div>
                    ) : (
                        <div style={{
                            fontSize: pip.textMd, color: pip.amberDim,
                            fontFamily: pip.font, fontStyle: 'italic',
                        }}>
                            Playing well. Keep farming.
                        </div>
                    )}
                </div>

                {/* ── Recent Feed ── */}
                <div style={{
                    flex: 1,
                    borderLeft: `2px solid ${pip.amberGhost}`,
                    paddingLeft: pip.sp4,
                }}>
                    <div style={{
                        ...labelStyle,
                        marginBottom: pip.sp2,
                    }}>
                        RECENT
                    </div>
                    {recommendations.slice(0, 4).map((rec, i) => (
                        <div key={i} style={{
                            fontSize: pip.textSm,
                            color: i === 0 ? pip.amber : pip.amberDim,
                            fontFamily: pip.font,
                            fontWeight: i === 0 ? 700 : 400,
                            marginBottom: 3,
                            lineHeight: 1.3,
                            opacity: 1 - (i * 0.2),
                        }}>
                            {rec.title}
                        </div>
                    ))}
                    {recommendations.length === 0 && (
                        <div style={{
                            fontSize: pip.textSm, color: pip.amberGhost,
                            fontFamily: pip.font, fontStyle: 'italic',
                        }}>
                            No recommendations yet...
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
