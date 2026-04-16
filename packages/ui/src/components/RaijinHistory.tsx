/** RaijinHistory — last 20 games trend view with per-dimension sparklines.
 *
 * Fetches /api/post-game/history, renders a table of match rows + inline
 * sparklines for each dimension. Click a row to surface that match's full
 * report via /api/post-game/{match_id}. Opened from RaijinPostGame's
 * "VIEW HISTORY" button. */
import React, { useEffect, useState, useCallback } from 'react';
import {
    PostGameReport,
    PostGameHistoryEntry,
    RAIJIN_API,
} from '../raijinTypes';
import { pip, glow, glowText } from '../raijinTheme';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface Props {
    open: boolean;
    onClose: () => void;
    onSelectMatch: (report: PostGameReport) => void;
}

const DIMENSIONS = ['farming', 'fighting', 'objectives', 'map_awareness', 'itemization'] as const;

const GRADE_TO_SCORE: Record<string, number> = {
    S: 95, A: 85, B: 75, C: 65, D: 55, F: 40,
};

const GRADE_COLOR: Record<string, string> = {
    S: '#7FFFD4',
    A: '#A0FF7F',
    B: '#FFB000',
    C: '#FFD54F',
    D: '#FF8C00',
    F: '#FF4136',
};

export function RaijinHistory({ open, onClose, onSelectMatch }: Props) {
    const [entries, setEntries] = useState<PostGameHistoryEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const modalRef = useFocusTrap<HTMLDivElement>(open);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        setLoading(true);
        setError(null);
        fetch(`${RAIJIN_API}/api/post-game/history?limit=20`)
            .then(r => r.json())
            .then((data: { reports?: PostGameHistoryEntry[] }) => {
                if (cancelled) return;
                setEntries(data.reports ?? []);
            })
            .catch(() => {
                if (cancelled) return;
                setError('Failed to load history — is the Raijin engine running?');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    const handleSelect = useCallback(
        async (matchId: string) => {
            try {
                const resp = await fetch(`${RAIJIN_API}/api/post-game/${matchId}`);
                if (!resp.ok) return;
                const full = (await resp.json()) as PostGameReport;
                onSelectMatch(full);
                onClose();
            } catch {
                /* offline — ignore */
            }
        },
        [onSelectMatch, onClose]
    );

    if (!open) return null;

    // Build per-dimension score arrays for sparklines (oldest first)
    const reversed = [...entries].reverse();
    const sparkData: Record<string, number[]> = {};
    for (const dim of DIMENSIONS) {
        sparkData[dim] = reversed.map(e => {
            const g = e.grades.find(x => x.dimension === dim);
            return g ? g.score : 0;
        });
    }

    return (
        <>
            <style>{`
                @keyframes raijin-hist-fadein {
                    from { opacity: 0; }
                    to   { opacity: 1; }
                }
                .raijin-hist-scrim,
                .raijin-hist-modal {
                    animation: raijin-hist-fadein 180ms ease-out;
                }
                @media (prefers-reduced-motion: reduce) {
                    .raijin-hist-scrim,
                    .raijin-hist-modal {
                        animation: none;
                    }
                }
            `}</style>
            <div
                className="raijin-hist-scrim"
                onClick={onClose}
                style={{
                    position: 'fixed', inset: 0,
                    background: 'rgba(0, 0, 0, 0.55)',
                    zIndex: 100,
                }}
            />
            <div
                ref={modalRef}
                className="raijin-hist-modal"
                role="dialog"
                aria-modal="true"
                aria-label="Raijin match history"
                style={{
                    position: 'fixed',
                    top: '8%', left: '50%',
                    transform: 'translateX(-50%)',
                    width: 'min(900px, 95vw)',
                    maxHeight: '84vh',
                    display: 'flex', flexDirection: 'column',
                    background: pip.bgPanel,
                    border: `2px solid ${pip.amber}`,
                    boxShadow: glow(pip.amber, 16),
                    fontFamily: pip.font,
                    color: pip.amber,
                    zIndex: 101,
                }}
            >
                {/* Header */}
                <div style={{
                    padding: pip.sp4,
                    borderBottom: `1px solid ${pip.amberFaint}`,
                    display: 'flex', alignItems: 'center', gap: pip.sp3,
                }}>
                    <span style={{
                        fontSize: pip.textLg,
                        fontWeight: 700,
                        letterSpacing: 2,
                        textShadow: glowText(pip.amber, 6),
                    }}>
                        {'\u25B8'} MATCH HISTORY · LAST {entries.length}
                    </span>
                    <span style={{ flex: 1 }} />
                    <button
                        onClick={onClose}
                        aria-label="Close history"
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
                        CLOSE
                    </button>
                </div>

                {/* Sparklines row */}
                {entries.length >= 2 && (
                    <div style={{
                        padding: pip.sp3,
                        borderBottom: `1px solid ${pip.amberGhost}`,
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                        gap: pip.sp3,
                    }}>
                        {DIMENSIONS.map(dim => (
                            <SparklineCard
                                key={dim}
                                label={dim.toUpperCase().replace('_', ' ')}
                                data={sparkData[dim]}
                            />
                        ))}
                    </div>
                )}

                {/* Table */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: `${pip.sp2}px ${pip.sp3}px`,
                }}>
                    {loading && (
                        <div style={{ padding: pip.sp5, textAlign: 'center' }}>Loading history…</div>
                    )}
                    {error && (
                        <div style={{ padding: pip.sp5, color: pip.red }}>{error}</div>
                    )}
                    {!loading && !error && entries.length === 0 && (
                        <div style={{ padding: pip.sp5, textAlign: 'center', fontStyle: 'italic' }}>
                            No games logged yet. Play a match to populate the history.
                        </div>
                    )}
                    {!loading && entries.length > 0 && (
                        <table style={{
                            width: '100%',
                            borderCollapse: 'collapse',
                            fontFamily: pip.font,
                            fontSize: pip.textSm,
                            color: pip.amber,
                        }}>
                            <thead>
                                <tr style={{ borderBottom: `1px solid ${pip.amberFaint}` }}>
                                    <th style={{ textAlign: 'left', padding: pip.sp2 }}>MATCH</th>
                                    <th style={{ textAlign: 'left', padding: pip.sp2 }}>HERO</th>
                                    <th style={{ textAlign: 'left', padding: pip.sp2 }}>RESULT</th>
                                    <th style={{ textAlign: 'right', padding: pip.sp2 }}>TIME</th>
                                    {DIMENSIONS.map(dim => (
                                        <th key={dim} style={{ textAlign: 'center', padding: pip.sp2 }}>
                                            {dim.substring(0, 3).toUpperCase()}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {entries.map(entry => (
                                    <tr
                                        key={entry.match_id}
                                        onClick={() => handleSelect(entry.match_id)}
                                        style={{
                                            borderBottom: `1px solid ${pip.amberGhost}`,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        <td style={{ padding: pip.sp2 }}>{entry.match_id}</td>
                                        <td style={{ padding: pip.sp2 }}>
                                            {entry.hero.replace(/_/g, ' ')}
                                        </td>
                                        <td style={{ padding: pip.sp2 }}>
                                            {entry.result}
                                        </td>
                                        <td style={{ padding: pip.sp2, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                            {Math.floor(entry.duration / 60)}m
                                        </td>
                                        {DIMENSIONS.map(dim => {
                                            const g = entry.grades.find(x => x.dimension === dim);
                                            const letter = g?.grade ?? '-';
                                            return (
                                                <td key={dim} style={{
                                                    padding: pip.sp2,
                                                    textAlign: 'center',
                                                    color: GRADE_COLOR[letter] ?? pip.amber,
                                                    fontWeight: 700,
                                                }}>
                                                    {letter}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </>
    );
}

/** Pure SVG sparkline — no external chart library. */
function SparklineCard({ label, data }: { label: string; data: number[] }) {
    if (data.length < 2) return null;
    const width = 140;
    const height = 32;
    const max = Math.max(...data, 100);
    const min = Math.min(...data, 0);
    const range = max - min || 1;
    const step = width / (data.length - 1);
    const points = data
        .map((v, i) => {
            const x = i * step;
            const y = height - ((v - min) / range) * height;
            return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(' ');
    const last = data[data.length - 1];
    return (
        <div>
            <div style={{
                fontSize: pip.textXs,
                color: pip.amberFaint,
                letterSpacing: 1,
                marginBottom: 4,
            }}>
                {label}
            </div>
            <svg
                width={width}
                height={height}
                aria-label={`${label} trend sparkline`}
                style={{ display: 'block' }}
            >
                <polyline
                    points={points}
                    fill="none"
                    stroke={pip.amber}
                    strokeWidth={1.5}
                    strokeLinecap="round"
                />
                <circle
                    cx={(data.length - 1) * step}
                    cy={height - ((last - min) / range) * height}
                    r={3}
                    fill={pip.amber}
                />
            </svg>
        </div>
    );
}
