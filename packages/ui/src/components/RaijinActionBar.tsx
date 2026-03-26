import React from 'react';
import { Recommendation, HeroData } from '../raijinTypes';
import { pip, panelBase, labelStyle, glow, glowText } from '../raijinTheme';

interface Props {
    recommendations: Recommendation[];
    heroData: HeroData | null;
}

export function RaijinActionBar({ recommendations, heroData }: Props) {
    const ACTION_BAR_MAX_AGE_MS = 120_000;
    const now = Date.now();
    const freshRecs = recommendations.filter(r =>
        (now - (r.receivedAt ?? now)) < ACTION_BAR_MAX_AGE_MS
    );
    const topRec = freshRecs.length > 0
        ? freshRecs.reduce((a, b) => b.priority > a.priority ? b : a)
        : null;

    const isUrgent = topRec && topRec.priority >= 4;
    const isDead = heroData && !heroData.alive;

    const urgentBorder = isUrgent ? pip.red : pip.amberFaint;

    return (
        <div style={{
            ...panelBase,
            gridColumn: '1 / -1',
            borderColor: urgentBorder,
            animation: isUrgent ? 'raijin-pulse 1.5s ease-in-out infinite' : undefined,
            boxShadow: isUrgent ? glow(pip.red, 16) : undefined,
        }}>
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
            `}</style>

            <div style={{ display: 'flex', gap: pip.sp5, alignItems: 'flex-start' }}>
                {/* ── Primary Action ── */}
                <div style={{ flex: 2 }}>
                    <div style={{
                        ...labelStyle,
                        color: isUrgent ? pip.red : pip.amber,
                        fontSize: pip.textSm,
                        marginBottom: pip.sp2,
                        textShadow: isUrgent ? glowText(pip.red, 6) : glowText(pip.amber),
                    }}>
                        {'\u25B8'} PRIORITY ACTION
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
                                fontSize: isUrgent ? pip.textXl : pip.textLg,
                                fontWeight: 700,
                                color: isUrgent ? pip.red : pip.amber,
                                fontFamily: pip.font,
                                lineHeight: 1.2,
                                textShadow: isUrgent ? glowText(pip.red, 6) : glowText(pip.amber),
                            }}>
                                {topRec.title}
                            </div>
                            <div style={{
                                fontSize: pip.textBase, color: pip.amberDim,
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
