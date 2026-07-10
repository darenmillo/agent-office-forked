/** 04 · THE GAP — the "what am I getting wrong" chart.
 *
 *  Data honesty: YOUR curve is true GSI net worth when the engine sends it
 *  (labeled NET WORTH), else gpm × minutes (labeled GOLD EARNED). The enemy
 *  curve is real net worth from GC intel. Reference curves render only from
 *  a received gap_baseline message: the bracket-average ghost (honest label
 *  from the engine — it is an AVERAGE, not a "winning player" curve) and
 *  your own median game. The winnability chip renders only from a received
 *  winnability message — no sample, no number. Deaths are real GSI events. */
import React from 'react';
import { console_ } from '../../raijinTheme';
import {
    GapPoint, latestGap, gapSlopePerMin, baselinePoints, winnabilityTone, fmtPct,
} from '../../console';
import { GapBaselineData, WinnabilityData } from '../../raijinTypes';
import { ZoneLabel, tnum } from './shared';

const VB_W = 1180;
const VB_H = 440;

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

export function Zone04Gap({ series, threatName, deaths, baseline, winnability, youIsNetWorth }: Props) {
    const you = series.filter(p => p.you !== null).map(p => ({ min: p.min, value: p.you! }));
    const enemy = series.filter(p => p.enemy !== null).map(p => ({ min: p.min, value: p.enemy! }));
    const gap = latestGap(series);
    const slope = gapSlopePerMin(series);

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
    const deathMarks = series.filter(p => p.death && p.you !== null);

    // A7: team gold advantage (GC bot, delayed) — different scale than the NW
    // curves, so it renders as a signed strip along the baseline, normalized
    // to its own max. Clipped to the observed minute domain like the ghosts.
    const teamGold = (baseline?.team_graph_gold ?? [])
        .map((v, min) => ({ min, value: v }))
        .filter(inDomain);
    const teamGoldMax = Math.max(1, ...teamGold.map(p => Math.abs(p.value)));
    const STRIP_H = 26; // px of viewBox devoted to the strip, straddling the bottom gridline
    const stripBase = VB_H - 34;

    // X-axis labels: ~6 marks across the observed span.
    const step = Math.max(1, Math.ceil(spanMin / 5));
    const axisMins: number[] = [];
    for (let m = minMin; m <= maxMin; m += step) axisMins.push(m);

    const youLegend = youIsNetWorth ? 'YOU · NET WORTH' : 'YOU · GOLD EARNED';
    const gapSources = youIsNetWorth ? 'NW VS NW' : 'NW VS GOLD (APPROX)';
    const winTone = winnability ? TONE_COLOR[winnabilityTone(winnability.p_win)] : null;

    return (
        <div style={{
            display: 'grid', gridTemplateRows: 'auto minmax(0,1fr)', minHeight: 0,
            borderBottom: `1px solid ${console_.line}`,
        }}>
            <div style={{ padding: '26px 36px 0' }}>
                <ZoneLabel
                    label={`04 · THE GAP — ${youIsNetWorth ? 'NET WORTH' : 'GOLD'} BY MINUTE`}
                    right={
                        <span style={{ display: 'flex', gap: 18, fontSize: 11, letterSpacing: '.12em', fontFamily: console_.mono }}>
                            <span style={{ color: console_.amber }}>━ {youLegend}</span>
                            <span style={{ color: enemyPath ? console_.dire : console_.ghost }}>
                                {enemyPath
                                    ? `━ ${(threatName ?? 'ENEMY').toUpperCase()} · NET WORTH`
                                    : '━ ENEMY — NO INTEL'}
                            </span>
                            {ghostPath && baseline?.ghost_label && (
                                <span style={{ color: console_.ghostLine }}>╌ {baseline.ghost_label.toUpperCase()}</span>
                            )}
                            {medianPath && (
                                <span style={{ color: console_.ghost }}>╌ YOUR MEDIAN GAME</span>
                            )}
                            {teamGold.length >= 2 && (
                                <span style={{ color: console_.chrome }}>
                                    ▎ {(baseline?.labels?.team_graph_gold ?? 'TEAM GOLD ADV (DELAYED)')}
                                </span>
                            )}
                        </span>
                    }
                />
            </div>
            <div style={{ position: 'relative', margin: '16px 36px 22px', minHeight: 0 }}>
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
                        <g fill={console_.dire}>
                            {deathMarks.map(p => (
                                <path key={`d${p.min}`} d={`M${xOf(p.min).toFixed(1)},${(yOf(p.you!) + 14).toFixed(1)} l7,-12 h-14 z`} />
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
                <div style={{ position: 'absolute', right: 8, top: 0, textAlign: 'right' }}>
                    {winnability && winTone && (
                        <div style={{ marginBottom: gap ? 14 : 0 }}>
                            <div style={{
                                fontFamily: console_.display, fontSize: 34, fontWeight: 700,
                                color: winTone, lineHeight: 1, ...tnum,
                            }}>
                                {fmtPct(winnability.p_win)}
                            </div>
                            <div style={{ fontSize: 10, letterSpacing: '.18em', color: console_.chrome, fontFamily: console_.mono, marginTop: 3 }}>
                                WIN RIGHT NOW IF NOTHING CHANGES
                            </div>
                            {winnability.hint && (
                                <div style={{
                                    fontFamily: console_.reading, fontSize: 13, lineHeight: 1.45,
                                    color: console_.muted, marginTop: 4, maxWidth: 260, marginLeft: 'auto',
                                }}>
                                    {winnability.hint}
                                </div>
                            )}
                            {typeof winnability.n === 'number' && winnability.n > 0 && (
                                <div style={{ fontSize: 9, letterSpacing: '.2em', color: console_.ghost, fontFamily: console_.mono, marginTop: 3, ...tnum }}>
                                    FROM {winnability.n} OF YOUR RECENT GAMES
                                </div>
                            )}
                        </div>
                    )}
                    {gap && (
                        <>
                            <div style={{
                                fontFamily: console_.display, fontSize: console_.tGap, fontWeight: 700,
                                color: gap.gap > 0 ? console_.dire : console_.radiant, ...tnum,
                            }}>
                                {gap.gap > 0 ? '−' : '+'}{(Math.abs(gap.gap) / 1000).toFixed(1)}k
                            </div>
                            <div style={{ fontSize: 10, letterSpacing: '.2em', color: console_.chrome, fontFamily: console_.mono }}>
                                {slope !== null
                                    ? `GAP · ${(gap.gap > 0 ? slope > 0 : slope < 0) ? 'GROWING' : 'CLOSING'} ${Math.round(Math.abs(slope))}/MIN`
                                    : 'GAP'} · {gapSources}
                            </div>
                        </>
                    )}
                </div>
                {deathMarks.length > 0 && (
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
            </div>
        </div>
    );
}
