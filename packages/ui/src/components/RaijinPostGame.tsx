/** RaijinPostGame — single-game retrospective shown on game_ended.
 *
 * 5 letter-grade dimension cards + optional LLM narrative + key moments list.
 * Auto-mounts from RaijinRecs when a game_ended message arrives with a
 * post-game report attached (or fetched from /api/post-game/latest). */
import React, { useEffect, useState } from 'react';
import { DimensionGrade, PostGameReport, RAIJIN_API, StructuredNarrative } from '../raijinTypes';
import { pip, glow, glowText } from '../raijinTheme';

interface Props {
    report: PostGameReport | null;
    onDismiss: () => void;
    onViewHistory: () => void;
}

const GRADE_COLOR: Record<string, string> = {
    S: '#7FFFD4',  // green-tinted
    A: '#A0FF7F',
    B: '#FFB000',  // amber
    C: '#FFD54F',
    D: '#FF8C00',
    F: '#FF4136',
};

const DIM_LABEL: Record<string, string> = {
    farming: 'FARMING',
    fighting: 'FIGHTING',
    objectives: 'OBJECTIVES',
    map_awareness: 'MAP AWARENESS',
    itemization: 'ITEMIZATION',
};

export function RaijinPostGame({ report, onDismiss, onViewHistory }: Props) {
    if (!report) return null;

    const minutes = Math.floor(report.duration / 60);
    const seconds = report.duration % 60;
    const resultColor =
        report.result === 'WIN' ? pip.green : report.result === 'LOSS' ? pip.red : pip.amber;

    return (
        <>
            <style>{`
                @keyframes raijin-postgame-fadein {
                    from { opacity: 0; transform: translateY(8px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                .raijin-postgame-panel {
                    animation: raijin-postgame-fadein 260ms ease-out;
                }
                @media (prefers-reduced-motion: reduce) {
                    .raijin-postgame-panel {
                        animation: none;
                    }
                }
            `}</style>
            <div
                className="raijin-postgame-panel"
                role="region"
                aria-label="Post-game coaching report"
                style={{
                    position: 'absolute',
                    top: 120,
                    left: 80,
                    right: 540,
                    bottom: 210,
                    overflowY: 'auto',
                    padding: pip.sp4,
                    background: pip.bgPanel,
                    border: `2px solid ${pip.amber}`,
                    boxShadow: glow(pip.amber, 16),
                    fontFamily: pip.font,
                    color: pip.amber,
                    zIndex: 14,
                }}
            >
                {/* Result banner */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: pip.sp3,
                    borderBottom: `2px solid ${pip.amberFaint}`,
                    paddingBottom: pip.sp3,
                    marginBottom: pip.sp3,
                }}>
                    <span style={{
                        fontSize: pip.text2xl,
                        fontWeight: 700,
                        color: resultColor,
                        letterSpacing: 2,
                        textShadow: glowText(resultColor, 8),
                    }}>
                        {report.result}
                    </span>
                    <span style={{
                        fontSize: pip.textLg,
                        color: pip.amber,
                    }}>
                        {report.hero.replace(/_/g, ' ').toUpperCase()} · {minutes}:{seconds.toString().padStart(2, '0')}
                    </span>
                    {report.result === 'UNKNOWN' && (
                        <span
                            title="OpenDota indexes new matches ~5-15 minutes after they end. The result will update automatically."
                            style={{
                                fontSize: pip.textXs,
                                color: pip.amberDim,
                                letterSpacing: 1,
                                fontStyle: 'italic',
                            }}
                        >
                            (awaiting OpenDota indexing — updates automatically)
                        </span>
                    )}
                    <span style={{ flex: 1 }} />
                    <button
                        onClick={onDismiss}
                        aria-label="Dismiss post-game report"
                        style={{
                            background: 'transparent',
                            border: `1px solid ${pip.amberFaint}`,
                            color: pip.amber,
                            padding: '6px 14px',
                            fontFamily: pip.font,
                            fontSize: pip.textSm,
                            cursor: 'pointer',
                            minHeight: 32,
                        }}
                    >
                        DISMISS
                    </button>
                </div>

                {/* Grade cards — 5 dimensions */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: pip.sp3,
                    marginBottom: pip.sp4,
                }}>
                    {report.grades.map(grade => (
                        <GradeCard key={grade.dimension} grade={grade} />
                    ))}
                </div>

                {/* Narrative — Phase 5a structured cards, v4.0 prose back-compat, or regen prompt */}
                <NarrativeBlock
                    narrative={report.narrative}
                    matchId={report.match_id}
                />


                {/* Key moments */}
                {report.key_moments.length > 0 && (
                    <div>
                        <div style={{
                            fontSize: pip.textSm,
                            color: pip.amber,
                            letterSpacing: 1,
                            textTransform: 'uppercase',
                            marginBottom: pip.sp2,
                            borderBottom: `1px solid ${pip.amberGhost}`,
                            paddingBottom: pip.sp1,
                        }}>
                            KEY MOMENTS
                        </div>
                        {report.key_moments.map((m, i) => {
                            const data = m.data as Record<string, any>;
                            const label = data.title || m.type;
                            const clock = m.clock_time ?? 0;
                            const min = Math.floor(clock / 60);
                            const sec = clock % 60;
                            return (
                                <div
                                    key={i}
                                    style={{
                                        fontSize: pip.textSm,
                                        color: pip.amber,
                                        marginBottom: 4,
                                        lineHeight: 1.4,
                                    }}
                                >
                                    <span style={{ color: pip.amberFaint, marginRight: 8 }}>
                                        {min}:{sec.toString().padStart(2, '0')}
                                    </span>
                                    {label}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Footer */}
                <div style={{ marginTop: pip.sp4, textAlign: 'center' }}>
                    <button
                        onClick={onViewHistory}
                        style={{
                            background: pip.bgInset,
                            border: `2px solid ${pip.amber}`,
                            color: pip.amber,
                            padding: '8px 18px',
                            fontFamily: pip.font,
                            fontSize: pip.textBase,
                            fontWeight: 700,
                            letterSpacing: 1,
                            cursor: 'pointer',
                            minHeight: 44,
                            textShadow: glowText(pip.amber, 4),
                        }}
                    >
                        VIEW HISTORY
                    </button>
                </div>
            </div>
        </>
    );
}

function isStructured(n: PostGameReport['narrative']): n is StructuredNarrative {
    return !!n && typeof n === 'object' && 'summary' in n;
}

function NarrativeBlock(props: {
    narrative: PostGameReport['narrative'];
    matchId: string;
}) {
    const [pendingRegen, setPendingRegen] = useState(false);
    const [regenError, setRegenError] = useState<string | null>(null);
    const [localNarrative, setLocalNarrative] = useState<PostGameReport['narrative']>(props.narrative);

    // Resync when the parent prop changes (e.g. refetch from /api/post-game/latest
    // after a WS update). Without this, a stale narrative from a previous open
    // would persist across match boundaries.
    useEffect(() => {
        setLocalNarrative(props.narrative);
        setRegenError(null);
    }, [props.narrative, props.matchId]);

    const narrative = localNarrative ?? props.narrative;

    const onRegen = async () => {
        setPendingRegen(true);
        setRegenError(null);
        try {
            const res = await fetch(`${RAIJIN_API}/api/post-game/${props.matchId}/enrich`, {
                method: 'POST',
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const fresh = (await res.json()) as PostGameReport;
            setLocalNarrative(fresh.narrative);
        } catch (e: any) {
            setRegenError(e?.message ?? 'Failed to regenerate narrative.');
        } finally {
            setPendingRegen(false);
        }
    };

    // Structured — three cards + summary quote
    if (isStructured(narrative)) {
        return (
            <div style={{ marginBottom: pip.sp4 }}>
                <div style={{
                    borderLeft: `3px solid ${pip.amber}`,
                    padding: `${pip.sp2}px ${pip.sp3}px`,
                    background: pip.bgInset,
                    marginBottom: pip.sp3,
                    lineHeight: 1.6,
                    fontSize: pip.textBase,
                    color: pip.amber,
                    fontStyle: 'italic',
                }}>
                    {narrative.summary}
                </div>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: pip.sp3,
                }}>
                    <NarrativeCard
                        label="WHAT WENT WELL"
                        accent={pip.green}
                        bullets={narrative.what_went_well}
                    />
                    <NarrativeCard
                        label="WHAT TO IMPROVE"
                        accent={pip.red}
                        bullets={narrative.what_to_improve}
                    />
                    <NarrativeCard
                        label="TRY NEXT GAME"
                        accent={pip.amber}
                        bullets={narrative.try_next_game}
                    />
                </div>
            </div>
        );
    }

    // Legacy prose string — single card, preserves newline formatting
    if (typeof narrative === 'string' && narrative.trim()) {
        return (
            <div style={{
                borderLeft: `3px solid ${pip.amber}`,
                padding: `${pip.sp2}px ${pip.sp3}px`,
                background: pip.bgInset,
                marginBottom: pip.sp4,
                lineHeight: 1.6,
                fontSize: pip.textBase,
                color: pip.amber,
                whiteSpace: 'pre-wrap',
            }}>
                {narrative}
            </div>
        );
    }

    // Null / empty — pending enrichment, show REGEN NOW
    return (
        <div style={{
            padding: pip.sp3,
            border: `1px dashed ${pip.amberFaint}`,
            background: pip.bgInset,
            marginBottom: pip.sp4,
            display: 'flex',
            alignItems: 'center',
            gap: pip.sp3,
        }}>
            <span style={{
                fontSize: pip.textSm,
                color: pip.amber,
                fontStyle: 'italic',
                flex: 1,
            }}>
                {pendingRegen
                    ? 'Regenerating narrative via Opus 4.7…'
                    : (regenError
                        ? `Narrative regen failed: ${regenError}`
                        : 'Narrative regenerating in the background…')}
            </span>
            <button
                onClick={onRegen}
                disabled={pendingRegen}
                aria-label="Regenerate post-game narrative now"
                style={{
                    background: 'transparent',
                    border: `1px solid ${pip.amber}`,
                    color: pip.amber,
                    padding: '6px 14px',
                    fontFamily: pip.font,
                    fontSize: pip.textSm,
                    letterSpacing: 1,
                    cursor: pendingRegen ? 'wait' : 'pointer',
                    minHeight: 32,
                    opacity: pendingRegen ? 0.6 : 1,
                }}
            >
                REGEN NOW
            </button>
        </div>
    );
}

function NarrativeCard(props: { label: string; accent: string; bullets: string[] }) {
    return (
        <div style={{
            border: `1px solid ${pip.amberFaint}`,
            background: pip.bgInset,
            padding: pip.sp3,
            display: 'flex',
            flexDirection: 'column',
            gap: pip.sp2,
        }}>
            <div style={{
                fontSize: pip.textSm,
                color: props.accent,
                letterSpacing: 1,
                borderBottom: `1px solid ${pip.amberGhost}`,
                paddingBottom: pip.sp1,
                textShadow: glowText(props.accent, 4),
            }}>
                {props.label}
            </div>
            {props.bullets.length === 0 ? (
                <div style={{
                    fontSize: pip.textSm, color: pip.amberFaint, fontStyle: 'italic',
                }}>
                    (none)
                </div>
            ) : (
                <ul style={{
                    margin: 0,
                    paddingLeft: 18,
                    fontSize: pip.textSm,
                    color: pip.amber,
                    lineHeight: 1.5,
                }}>
                    {props.bullets.map((b, i) => (
                        <li key={i} style={{ marginBottom: 4 }}>{b}</li>
                    ))}
                </ul>
            )}
        </div>
    );
}

function GradeCard({ grade }: { grade: DimensionGrade }) {
    const color = GRADE_COLOR[grade.grade] ?? pip.amber;
    return (
        <div style={{
            border: `1px solid ${pip.amberFaint}`,
            background: pip.bgInset,
            padding: pip.sp3,
            display: 'flex',
            flexDirection: 'column',
            gap: pip.sp1,
        }}>
            <div style={{
                display: 'flex', alignItems: 'baseline', gap: pip.sp2,
            }}>
                <span style={{
                    fontSize: pip.text2xl,
                    fontWeight: 700,
                    color,
                    textShadow: glowText(color, 6),
                    minWidth: 40,
                }}>
                    {grade.grade}
                </span>
                <span style={{
                    fontSize: pip.textSm,
                    color: pip.amber,
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                }}>
                    {DIM_LABEL[grade.dimension] ?? grade.dimension}
                </span>
                <span style={{ flex: 1 }} />
                <span style={{
                    fontSize: pip.textSm,
                    color: pip.amberFaint,
                    fontVariantNumeric: 'tabular-nums',
                }}>
                    {grade.score.toFixed(0)}
                </span>
            </div>
            {/* Score bar */}
            <div style={{
                height: 4,
                background: pip.bgDeep,
                position: 'relative',
                border: `1px solid ${pip.amberGhost}`,
            }}>
                <div style={{
                    position: 'absolute',
                    left: 0, top: 0, bottom: 0,
                    width: `${Math.max(0, Math.min(100, grade.score))}%`,
                    background: color,
                    boxShadow: `0 0 6px ${color}66`,
                }} />
            </div>
            <div style={{
                fontSize: pip.textSm,
                color: pip.amber,
                lineHeight: 1.4,
                marginTop: pip.sp1,
            }}>
                {grade.callout}
            </div>
        </div>
    );
}
