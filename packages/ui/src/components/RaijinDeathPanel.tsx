/** DeathMoment v2 (Phase 1, #7) — ONE death surface.
 *
 * Consolidates the previously fragmented death artifacts into a single
 * broadcast-language card: respawn numeral (60px), gold-to-spend, and the
 * single coaching WHY (the Sonnet "coach says" analysis) as the hero line.
 * The compact alive-state "last death" card + its 45s persistence and manual
 * dismiss are preserved — that interaction was verified good.
 *
 * Data scope unchanged (per audit): GSI provides respawn/gold; the analysis
 * arrives as a death-tagged rec via the normal recommendations stream.
 */
import React, { useMemo, useState, useEffect } from 'react';
import { HeroData, Recommendation, effectiveUrgency } from '../raijinTypes';
import { bcast, bLabel, bNum, console_ } from '../raijinTheme';
import { verdictBadge } from '../console';

const VERDICT_COLOR = {
    radiant: bcast.radiant,
    blue: bcast.blue,
    amber: console_.amber,
    dire: bcast.dire,
} as const;

interface Props {
    heroData: HeroData | null;
    recommendations: Recommendation[];
    /** Wave 2: dead time is CHECK-IN time — fires the full-read request. */
    onCheckin?: () => void;
    checkinQueued?: boolean;
}

export function RaijinDeathPanel({ heroData, recommendations, onCheckin, checkinQueued }: Props) {
    // Find the Sonnet "coach says" rec separately from the sync _on_death
    // bundle so it renders as the hero line and persists past respawn.
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
            .slice(0, 4);
        return { headline: headlineRec, extras: recentFlushed, coachSays: analysis };
    }, [recommendations]);

    const alive = heroData?.alive ?? true;
    // Coach says persists for 45s after arrival so it stays visible past a
    // quick respawn (10–16s).
    const coachSaysFresh = coachSays
        && (Date.now() - (coachSays.receivedAt ?? 0)) < 45_000;

    const [dismissedCoachSaysId, setDismissedCoachSaysId] = useState<number | null>(null);
    useEffect(() => {
        if (!alive) setDismissedCoachSaysId(null);
    }, [alive]);
    const dismissed = coachSays != null
        && dismissedCoachSaysId === (coachSays.receivedAt ?? 0);

    if (!heroData) return null;
    if (alive && (!coachSaysFresh || dismissed)) return null;

    const gold = heroData.gold ?? 0;
    const respawn = heroData.respawn_seconds ?? 0;

    return (
        <>
            <style>{`
                @keyframes raijin-death-rise {
                    from { opacity: 0; transform: translate(-50%, 10px); }
                    to { opacity: 1; transform: translate(-50%, 0); }
                }
                @media (prefers-reduced-motion: reduce) {
                    .raijin-death-moment { animation: none !important; }
                }
            `}</style>
            <section
                className="raijin-death-moment"
                role="region"
                aria-label={alive ? 'Coach says — last death' : 'Death coaching panel'}
                style={
                    alive
                        // Alive: compact top-right card — mirrors toast sizing.
                        ? {
                            position: 'absolute',
                            top: 60,
                            right: 24,
                            width: 'min(380px, 32vw)',
                            padding: 14,
                            background: bcast.panel,
                            border: `1px solid ${bcast.line}`,
                            borderLeft: `3px solid ${bcast.gold}`,
                            borderRadius: bcast.r,
                            fontFamily: bcast.body,
                            color: bcast.ink,
                            zIndex: 15,
                            boxShadow: '0 12px 40px rgba(0,0,0,.45)',
                        }
                        : {
                            position: 'absolute',
                            top: 110,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            width: 'min(560px, 44vw)',
                            padding: '18px 20px',
                            background: `radial-gradient(400px 160px at 12% 0%, rgba(255,89,100,.12), transparent 70%), ${bcast.panel}`,
                            border: `1px solid ${bcast.dire}66`,
                            borderLeft: `4px solid ${bcast.dire}`,
                            borderRadius: bcast.r,
                            fontFamily: bcast.body,
                            color: bcast.ink,
                            zIndex: 15,
                            boxShadow: '0 18px 60px rgba(0,0,0,.55)',
                            animation: `raijin-death-rise .3s ${bcast.ease} both`,
                        }
                }
            >
                {!alive ? (
                    <>
                        {/* Respawn numeral + gold — the two numbers that matter while dead */}
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 20 }}>
                            {(() => {
                                const badge = verdictBadge(headline?.meta?.verdict as string);
                                return badge ? (
                                    <span style={{
                                        position: 'absolute', top: 14, right: 16,
                                        fontSize: 10, letterSpacing: '.2em',
                                        fontFamily: console_.mono,
                                        color: VERDICT_COLOR[badge.tone],
                                        border: `1px solid ${VERDICT_COLOR[badge.tone]}55`,
                                        padding: '2px 7px',
                                    }}>
                                        {badge.label}
                                    </span>
                                ) : null;
                            })()}
                            <div>
                                <div style={{ ...bLabel, color: bcast.dire }}>Respawn</div>
                                <div style={{
                                    ...bNum,
                                    fontFamily: bcast.display,
                                    fontSize: bcast.tNumeral,
                                    fontWeight: 700,
                                    lineHeight: 1,
                                    color: bcast.dire,
                                }}>
                                    {respawn}s
                                </div>
                            </div>
                            <div>
                                <div style={bLabel}>Gold to spend NOW</div>
                                <div style={{
                                    ...bNum,
                                    fontFamily: bcast.display,
                                    fontSize: 34,
                                    fontWeight: 700,
                                    lineHeight: 1.1,
                                    color: bcast.gold,
                                }}>
                                    {gold}g
                                </div>
                            </div>
                        </div>

                        {/* THE coaching why — hero line */}
                        {coachSays && (
                            <p style={{
                                margin: '14px 0 0',
                                fontSize: bcast.tRec,
                                lineHeight: 1.45,
                                color: bcast.ink,
                                whiteSpace: 'pre-wrap',
                            }}>
                                <span style={{ color: bcast.goldDim, fontWeight: 600 }}>Change this: </span>
                                {coachSays.body}
                            </p>
                        )}

                        {!coachSays && headline && (
                            <p style={{
                                margin: '14px 0 0',
                                fontSize: bcast.tRec,
                                lineHeight: 1.45,
                                color: bcast.ink,
                            }}>
                                <b>{headline.title}</b>
                                {headline.body ? ` — ${headline.body}` : ''}
                            </p>
                        )}

                        {extras.length > 0 && (
                            <div style={{ marginTop: 12, borderTop: `1px solid ${bcast.line}`, paddingTop: 10 }}>
                                <div style={{ ...bLabel, fontSize: 11, marginBottom: 4 }}>Queued during the fight</div>
                                {extras.map((rec, i) => (
                                    <div key={i} style={{ fontSize: bcast.tSub, color: bcast.muted, lineHeight: 1.45 }}>
                                        • {rec.title}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Dead time is reading time — the full check-in read is one tap away. */}
                        {onCheckin && respawn >= 15 && (
                            <button
                                onClick={onCheckin}
                                disabled={checkinQueued}
                                style={{
                                    marginTop: 12,
                                    background: 'transparent',
                                    border: `1px solid ${checkinQueued ? bcast.line : console_.phos}`,
                                    color: checkinQueued ? bcast.muted : console_.phosInk,
                                    fontFamily: console_.mono,
                                    fontSize: 11, letterSpacing: '.18em',
                                    padding: '6px 12px',
                                    cursor: checkinQueued ? 'wait' : 'pointer',
                                }}
                            >
                                {checkinQueued ? 'READING…' : 'CHECK-IN — WHAT NOW?'}
                            </button>
                        )}
                    </>
                ) : (
                    <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <span style={{ ...bLabel, color: bcast.gold, flex: 1 }}>
                                Coach says — last death
                            </span>
                            <button
                                onClick={() => setDismissedCoachSaysId(coachSays?.receivedAt ?? 0)}
                                aria-label="Dismiss coach says"
                                title="Dismiss"
                                style={{
                                    background: 'transparent',
                                    border: `1px solid ${bcast.line}`,
                                    borderRadius: 6,
                                    color: bcast.muted,
                                    width: 24,
                                    height: 24,
                                    fontFamily: bcast.body,
                                    fontSize: 13,
                                    cursor: 'pointer',
                                    lineHeight: 1,
                                    padding: 0,
                                }}
                            >
                                ×
                            </button>
                        </div>
                        {coachSays && (
                            <p style={{
                                margin: 0,
                                fontSize: bcast.tBody,
                                lineHeight: 1.5,
                                color: bcast.ink,
                                whiteSpace: 'pre-wrap',
                            }}>
                                {coachSays.body}
                            </p>
                        )}
                    </>
                )}
            </section>
        </>
    );
}
