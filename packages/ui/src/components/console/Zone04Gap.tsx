/** 04 · THE GAP — the "what am I getting wrong" chart.
 *
 *  Data honesty: YOUR curve is true GSI net worth when the engine sends it
 *  (labeled NET WORTH), else gpm × minutes (labeled GOLD EARNED). The enemy
 *  curve is real net worth from GC intel. Reference curves render only from
 *  a received gap_baseline message. The winnability chip renders only from a
 *  received winnability message — no sample, no number. Deaths are real GSI
 *  events.
 *
 *  rc-audit R1 layout law (row 15): the win% + gap chips live in a reserved
 *  CHIP LANE between the zone label and the plot — normal flow, never
 *  absolute-overlaid on the curves — so the top-right four-way collision is
 *  structurally impossible at every width. The legend renders in the same
 *  lane, drawn series only (row 20). The trend caption is measured over a
 *  real bucket window, never an extrapolated rate (row 17). The win chip
 *  carries memory — bucket + sparkline + Δ (row 18). Death marks cluster
 *  (row 19) and the teaching annotation shows once, then collapses (row 16). */
import React, { useEffect, useRef, useState } from 'react';
import { console_ } from '../../raijinTheme';
import {
    GapPoint, latestGap, baselinePoints, winnabilityTone, fmtPct,
} from '../../console';
import {
    winBucket, pushWinSample, winDelta, sparkPoints, WinSample,
    gapTrend, gapTrendCaption, legendEntries, clusterByX, teachState, TEACH_TTL_MS,
} from '../../gapTape';
import { GapBaselineData, WinnabilityData } from '../../raijinTypes';
import { ZoneLabel, tnum } from './shared';

const VB_W = 1180;
const VB_H = 440;
/** Cluster gap in viewBox units ≈ the ledger's ~8px at typical widths. */
const CLUSTER_GAP_VB = 14;

interface Props {
    series: GapPoint[];
    threatName: string | null;
    deaths: number;
    baseline: GapBaselineData | null;
    winnability: WinnabilityData | null;
    youIsNetWorth: boolean;
}

function buildPath(
    points: Array<{ min: number; value: number }>,
    xOf: (min: number) => number,
    yOf: (v: number) => number,
): string {
    return points
        .map((p, i) => `${i === 0 ? 'M' : 'L'}${xOf(p.min).toFixed(1)},${yOf(p.value).toFixed(1)}`)
        .join(' ');
}

const TONE_COLOR = {
    dire: console_.dire,
    amber: console_.amber,
    radiant: console_.radiant,
} as const;

const LEGEND_COLOR: Record<string, string> = {
    you: console_.amber,
    enemy: console_.dire,
    'enemy-await': console_.ghost,
    ghost: console_.ghostLine,
    median: console_.ghost,
    teamgold: console_.chrome,
};

const LEGEND_GLYPH: Record<string, string> = { line: '━', dash: '╌', strip: '▎', note: '·' };

export function Zone04Gap({ series, threatName, deaths, baseline, winnability, youIsNetWorth }: Props) {
    const you = series.filter(p => p.you !== null).map(p => ({ min: p.min, value: p.you! }));
    const enemy = series.filter(p => p.enemy !== null).map(p => ({ min: p.min, value: p.enemy! }));
    const gap = latestGap(series);
    const trend = gapTrend(series);

    // Row 18: the win chip's memory ring — only wire readings, capped.
    const winRing = useRef<WinSample[]>([]);
    if (winnability) winRing.current = pushWinSample(winRing.current, winnability.p_win);
    const delta = winDelta(winRing.current);
    const spark = sparkPoints(winRing.current, 64, 16);

    // Row 16: teach once — full on first death for TEACH_TTL_MS, then ⓘ.
    const teachShownAt = useRef<number | null>(null);
    const [, forceTick] = useState(0);
    const teach = teachState(deaths, teachShownAt.current, Date.now());
    useEffect(() => {
        if (teach === 'full' && teachShownAt.current === null) {
            teachShownAt.current = Date.now();
            // Instant swap at the TTL — no animation, reduced-motion safe.
            const t = setTimeout(() => forceTick(n => n + 1), TEACH_TTL_MS + 250);
            return () => clearTimeout(t);
        }
        return undefined;
    }, [teach]);

    const allMins = series.map(p => p.min);
    const minMin = allMins.length ? Math.min(...allMins) : 0;
    const maxMin = allMins.length ? Math.max(...allMins) : 1;
    const spanMin = Math.max(1, maxMin - minMin);

    // Reference curves clip to the observed minute domain so scales match.
    const inDomain = (p: { min: number }) => p.min >= minMin && p.min <= maxMin;
    const ghost = baselinePoints(baseline?.ghost_nw_by_minute).filter(inDomain);
    const median = baselinePoints(baseline?.nw_by_minute).filter(inDomain);

    const maxVal = Math.max(
        1000,
        ...you.map(p => p.value), ...enemy.map(p => p.value),
        ...ghost.map(p => p.value), ...median.map(p => p.value),
    );

    const xOf = (min: number) => ((min - minMin) / spanMin) * VB_W;
    const yOf = (v: number) => VB_H - 10 - (v / maxVal) * (VB_H - 30);

    const youPath = you.length >= 2 ? buildPath(you, xOf, yOf) : null;
    const enemyPath = enemy.length >= 2 ? buildPath(enemy, xOf, yOf) : null;
    const ghostPath = ghost.length >= 2 ? buildPath(ghost, xOf, yOf) : null;
    const medianPath = median.length >= 2 ? buildPath(median, xOf, yOf) : null;

    // Row 19: death marks cluster when they crowd.
    const deathMarks = series.filter(p => p.death && p.you !== null);
    const deathClusters = clusterByX(
        deathMarks.map(p => ({ x: xOf(p.min), min: p.min })),
        CLUSTER_GAP_VB,
    );
    const yOfMin = (min: number) => {
        const p = series.find(q => q.min === min && q.you !== null);
        return p ? yOf(p.you!) : VB_H - 20;
    };

    // A7: team gold advantage (GC bot, delayed) — signed strip on the baseline.
    const teamGold = (baseline?.team_graph_gold ?? [])
        .map((v, min) => ({ min, value: v }))
        .filter(inDomain);
    const teamGoldMax = Math.max(1, ...teamGold.map(p => Math.abs(p.value)));
    const STRIP_H = 26;
    const stripBase = VB_H - 34;

    const step = Math.max(1, Math.ceil(spanMin / 5));
    const axisMins: number[] = [];
    for (let m = minMin; m <= maxMin; m += step) axisMins.push(m);

    const youLegend = youIsNetWorth ? 'YOU · NET WORTH' : 'YOU · GOLD EARNED';
    const gapSources = youIsNetWorth ? 'NW VS NW' : 'NW VS GOLD (APPROX)';
    const winTone = winnability ? TONE_COLOR[winnabilityTone(winnability.p_win)] : null;

    // Row 20: the legend lists drawn series only.
    const legend = legendEntries({
        you: !!youPath, youLabel: youLegend,
        enemy: !!enemyPath, enemyName: threatName,
        ghostLabel: ghostPath ? (baseline?.ghost_label ?? null) : null,
        median: !!medianPath,
        teamGold: teamGold.length >= 2,
        teamGoldLabel: baseline?.labels?.team_graph_gold ?? 'TEAM GOLD ADV (DELAYED)',
    });

    return (
        <div style={{
            display: 'grid', gridTemplateRows: 'auto auto minmax(0,1fr)', minHeight: 0,
            borderBottom: `1px solid ${console_.line}`,
        }}>
            <div style={{ padding: '26px 36px 0' }}>
                <ZoneLabel label={`04 · THE GAP — ${youIsNetWorth ? 'NET WORTH' : 'GOLD'} BY MINUTE`} />
            </div>
            {/* ── THE CHIP LANE (row 15) — reserved flow row; the plot below
                   cannot collide with it at any width. ─────────────────── */}
            <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                gap: 18, padding: '10px 36px 0', minHeight: 44,
            }}>
                <div style={{
                    display: 'flex', flexWrap: 'wrap', gap: '4px 18px', fontSize: 11,
                    letterSpacing: '.12em', fontFamily: console_.mono, paddingTop: 6,
                }}>
                    {legend.map(e => (
                        <span key={e.id} style={{ color: LEGEND_COLOR[e.id], opacity: e.kind === 'note' ? 0.75 : 1 }}>
                            {LEGEND_GLYPH[e.kind]} {e.label}
                        </span>
                    ))}
                </div>
                <div style={{ display: 'flex', gap: 26, alignItems: 'flex-start', textAlign: 'right', flexShrink: 0 }}>
                    {winnability && winTone && (
                        <div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, justifyContent: 'flex-end' }}>
                                <span style={{
                                    fontFamily: console_.mono, fontSize: 13, fontWeight: 700,
                                    letterSpacing: '.14em', color: winTone,
                                }}>
                                    {winBucket(winnability.p_win)}
                                </span>
                                <span style={{
                                    fontFamily: console_.display, fontSize: 21, fontWeight: 700,
                                    color: winTone, lineHeight: 1, ...tnum,
                                }}>
                                    {fmtPct(winnability.p_win)}
                                </span>
                                {spark && (
                                    <svg width="64" height="16" style={{ overflow: 'visible' }}>
                                        <polyline points={spark} fill="none" stroke={winTone} strokeWidth="1.5" opacity="0.8" />
                                    </svg>
                                )}
                                {delta !== null && delta !== 0 && (
                                    <span style={{
                                        fontFamily: console_.mono, fontSize: 11, color: console_.chrome,
                                        letterSpacing: '.1em', ...tnum,
                                    }}>
                                        Δ{delta > 0 ? '+' : ''}{delta}
                                    </span>
                                )}
                            </div>
                            <div style={{ fontSize: 9, letterSpacing: '.18em', color: console_.ghost, fontFamily: console_.mono, marginTop: 3, ...tnum }}>
                                WIN RIGHT NOW IF NOTHING CHANGES
                                {typeof winnability.n === 'number' && winnability.n > 0 ? ` · FROM ${winnability.n} GAMES` : ''}
                            </div>
                            {winnability.hint && (
                                <div style={{
                                    fontFamily: console_.reading, fontSize: 12, lineHeight: 1.4,
                                    color: console_.muted, marginTop: 3, maxWidth: 340,
                                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                }}>
                                    {winnability.hint}
                                </div>
                            )}
                        </div>
                    )}
                    {gap && (
                        <div>
                            <div style={{
                                fontFamily: console_.display, fontSize: 21, fontWeight: 700, lineHeight: 1,
                                color: gap.gap > 0 ? console_.dire : console_.radiant, ...tnum,
                            }}>
                                {gap.gap > 0 ? '−' : '+'}{(Math.abs(gap.gap) / 1000).toFixed(1)}k
                            </div>
                            <div style={{ fontSize: 9, letterSpacing: '.16em', color: console_.chrome, fontFamily: console_.mono, marginTop: 3, ...tnum }}>
                                {gapTrendCaption(trend)} · {gapSources}
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <div style={{ position: 'relative', margin: '12px 36px 22px', minHeight: 0 }}>
                {youPath ? (
                    <svg viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                        <g stroke={console_.line2} strokeWidth="1">
                            {[1, 2, 3, 4, 5].map(i => (
                                <line key={`h${i}`} x1="0" y1={(VB_H / 6) * i} x2={VB_W} y2={(VB_H / 6) * i} />
                            ))}
                            {[1, 2, 3, 4].map(i => (
                                <line key={`v${i}`} x1={(VB_W / 5) * i} y1="0" x2={(VB_W / 5) * i} y2={VB_H} />
                            ))}
                        </g>
                        {teamGold.length >= 2 && (
                            <g>
                                <line x1="0" y1={stripBase} x2={VB_W} y2={stripBase} stroke={console_.line} strokeWidth="1" />
                                {teamGold.map(p => {
                                    const h = (Math.abs(p.value) / teamGoldMax) * STRIP_H;
                                    return (
                                        <rect
                                            key={`tg${p.min}`}
                                            x={xOf(p.min) - 2}
                                            y={p.value >= 0 ? stripBase - h : stripBase}
                                            width="4"
                                            height={Math.max(1, h)}
                                            fill={p.value >= 0 ? console_.radiant : console_.dire}
                                            opacity="0.55"
                                        />
                                    );
                                })}
                            </g>
                        )}
                        {medianPath && (
                            <path d={medianPath} stroke={console_.ghost} strokeWidth="1.5" strokeDasharray="4 7" fill="none" />
                        )}
                        {ghostPath && (
                            <path d={ghostPath} stroke={console_.ghostLine} strokeWidth="2" strokeDasharray="7 6" fill="none" />
                        )}
                        {enemyPath && <path d={enemyPath} stroke={console_.dire} strokeWidth="2.5" fill="none" />}
                        <path d={youPath} stroke={console_.amber} strokeWidth="2.5" fill="none" />
                        {you.length > 0 && (
                            <circle cx={xOf(you[you.length - 1].min)} cy={yOf(you[you.length - 1].value)} r="5" fill={console_.amber} />
                        )}
                        {enemy.length > 0 && enemyPath && (
                            <circle cx={xOf(enemy[enemy.length - 1].min)} cy={yOf(enemy[enemy.length - 1].value)} r="5" fill={console_.dire} />
                        )}
                        {/* Row 19: clustered death marks — ▲ with a ×N badge. */}
                        <g fill={console_.dire}>
                            {deathClusters.map(c => (
                                <React.Fragment key={`dc${c.x}`}>
                                    <path d={`M${c.x.toFixed(1)},${(yOfMin(c.mins[c.mins.length - 1]) + 14).toFixed(1)} l7,-12 h-14 z`} />
                                    {c.count > 1 && (
                                        <text
                                            x={(c.x + 11).toFixed(1)}
                                            y={(yOfMin(c.mins[c.mins.length - 1]) + 6).toFixed(1)}
                                            fontSize="13"
                                            fontFamily={console_.mono}
                                            fill={console_.dire}
                                        >
                                            ×{c.count}
                                        </text>
                                    )}
                                </React.Fragment>
                            ))}
                        </g>
                    </svg>
                ) : (
                    <span style={{
                        position: 'absolute', left: 0, top: 8,
                        fontSize: 11, letterSpacing: '.18em', color: console_.ghost, fontFamily: console_.mono,
                    }}>
                        ACCRUING — MINUTE MARKS LAND AS THE GAME RUNS
                    </span>
                )}
                <div style={{
                    position: 'absolute', left: 0, right: 0, bottom: -4,
                    display: 'flex', justifyContent: 'space-between',
                    fontSize: 10, letterSpacing: '.16em', color: console_.ghost,
                    fontFamily: console_.mono, ...tnum,
                }}>
                    {axisMins.map((m, i) => (
                        <span key={m}>{i === axisMins.length - 1 ? `MIN ${m}` : String(m).padStart(2, '0')}</span>
                    ))}
                </div>
                {/* Row 16: teach once, then collapse to the ⓘ chip. */}
                {teach === 'full' && (
                    <div style={{
                        position: 'absolute', left: '24%', bottom: '12%', maxWidth: 320,
                        borderLeft: `2px solid ${console_.dire}`, padding: '2px 0 2px 14px',
                    }}>
                        <div style={{ fontSize: 10, letterSpacing: '.22em', color: console_.dire, fontFamily: console_.mono }}>
                            ▲ = YOUR DEATHS · {deaths}
                        </div>
                        <div style={{ fontFamily: console_.reading, fontSize: 14, lineHeight: 1.5, color: console_.body, marginTop: 5 }}>
                            {ghostPath
                                ? 'Compare your slope against the dashed bracket average on either side of each ▲.'
                                : 'Death minutes are marked on your curve — compare the slope on either side of each ▲.'}
                        </div>
                    </div>
                )}
                {teach === 'collapsed' && (
                    <div style={{
                        position: 'absolute', left: 0, top: 4,
                        fontSize: 10, letterSpacing: '.18em', color: console_.dire,
                        fontFamily: console_.mono, opacity: 0.85, ...tnum,
                    }}>
                        ⓘ ▲ YOUR DEATHS · {deaths}
                    </div>
                )}
            </div>
        </div>
    );
}
