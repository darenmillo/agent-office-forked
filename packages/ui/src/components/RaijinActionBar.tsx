import React from 'react';
import { Recommendation, HeroData } from '../raijinTypes';

interface Props {
    recommendations: Recommendation[];
    heroData: HeroData | null;
}

export function RaijinActionBar({ recommendations, heroData }: Props) {
    // Top priority recommendation — skip recs older than 60s so stale
    // "ability point available" etc. don't dominate after the player has acted
    const ACTION_BAR_MAX_AGE_MS = 60_000;
    const now = Date.now();
    const freshRecs = recommendations.filter(r =>
        (now - (r.receivedAt ?? now)) < ACTION_BAR_MAX_AGE_MS
    );
    const topRec = freshRecs.length > 0
        ? freshRecs.reduce((a, b) => b.priority > a.priority ? b : a)
        : null;

    const isUrgent = topRec && topRec.priority >= 4;
    const isDead = heroData && !heroData.alive;

    return (
        <div style={{
            ...panelStyle,
            borderColor: isUrgent ? 'rgba(244, 67, 54, 0.6)' : 'rgba(244, 67, 54, 0.3)',
            animation: isUrgent ? 'raijin-pulse 1.5s ease-in-out infinite' : undefined,
            boxShadow: isUrgent ? '0 0 20px rgba(244, 67, 54, 0.2)' : undefined,
        }}>
            <style>{`
                @keyframes raijin-pulse {
                    0%, 100% { border-color: rgba(244, 67, 54, 0.6); box-shadow: 0 0 20px rgba(244, 67, 54, 0.2); }
                    50% { border-color: rgba(244, 67, 54, 1); box-shadow: 0 0 30px rgba(244, 67, 54, 0.4); }
                }
            `}</style>

            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                {/* DO THIS NOW — main action */}
                <div style={{ flex: 2 }}>
                    <div style={{ fontSize: 12, color: '#f44336', fontWeight: 700, marginBottom: 6, letterSpacing: 2 }}>
                        DO THIS NOW
                    </div>
                    {isDead ? (
                        <div>
                            <div style={{ fontSize: 24, fontWeight: 700, color: '#d63031' }}>
                                DEAD - Respawn {heroData.respawn_seconds}s
                            </div>
                            <div style={{ fontSize: 15, color: '#dfe6e9', marginTop: 4 }}>
                                Spend your {heroData.gold}g before respawning!
                            </div>
                        </div>
                    ) : topRec ? (
                        <div>
                            <div style={{
                                fontSize: isUrgent ? 24 : 18,
                                fontWeight: 700,
                                color: isUrgent ? '#f44336' : '#ff9800',
                                lineHeight: 1.2,
                            }}>
                                {topRec.title}
                            </div>
                            <div style={{ fontSize: 14, color: '#dfe6e9', marginTop: 4 }}>
                                {topRec.body}
                            </div>
                        </div>
                    ) : (
                        <div style={{ fontSize: 16, color: '#636e72' }}>
                            Playing well. Keep farming.
                        </div>
                    )}
                </div>

                {/* Recent recommendations scroll */}
                <div style={{ flex: 1, borderLeft: '1px solid rgba(244,67,54,0.2)', paddingLeft: 12 }}>
                    <div style={{ fontSize: 12, color: '#636e72', marginBottom: 6, letterSpacing: 1, fontWeight: 600 }}>
                        RECENT
                    </div>
                    {recommendations.slice(0, 4).map((rec, i) => (
                        <div key={i} style={{
                            fontSize: 12, color: i === 0 ? '#dfe6e9' : '#636e72',
                            marginBottom: 3, lineHeight: 1.3,
                            opacity: 1 - (i * 0.2),
                        }}>
                            {rec.title}
                        </div>
                    ))}
                    {recommendations.length === 0 && (
                        <div style={{ fontSize: 10, color: '#636e72' }}>
                            No recommendations yet...
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

const panelStyle: React.CSSProperties = {
    background: 'rgba(40, 10, 10, 0.92)',
    borderRadius: 12,
    border: '1px solid rgba(244, 67, 54, 0.3)',
    padding: 14,
    gridColumn: '1 / -1',
};
