/** CONSOLE header (64px): identity cell left, meta + link-health right.
 *  Link health is the latency-honesty strip — ages come from real receive
 *  timestamps, never constants. Operational controls are composed in by
 *  RaijinRecs (headerControls) so the board stays the orchestrator's child. */
import React from 'react';
import { console_ } from '../../raijinTheme';
import { fmtMSS } from '../../console';
import { HeroCardData, HeroData } from '../../raijinTypes';
import { tnum } from './shared';

interface Props {
    heroData: HeroData | null;
    clock: number | null;
    roleLabel: string | null;
    bracket: string | null;
    patchVersion: string | null;
    allyScore: number | null;
    enemyScore: number | null;
    /** ms ages — null when that link has never delivered. */
    gsiAgeMs: number | null;
    llmAgeMs: number | null;
    intelAgeMs: number | null;
    frozen: boolean;
    signalLostForMs: number | null;
    /** A6.4: personal record on the live hero — null renders nothing (honest). */
    heroCard?: HeroCardData | null;
    headerControls?: React.ReactNode;
}

function LinkDot({ label, ageMs, freshS, agingS, fmt }: {
    label: string; ageMs: number | null; freshS: number; agingS: number;
    fmt: (ageMs: number) => string;
}) {
    const color = ageMs === null ? console_.ghost
        : ageMs <= freshS * 1000 ? console_.radiant
        : ageMs <= agingS * 1000 ? console_.amber
        : console_.dire;
    return (
        <span style={{ color: console_.chrome, whiteSpace: 'nowrap' }}>
            {label} <span style={{ color }}>●</span> {ageMs === null ? '—' : fmt(ageMs)}
        </span>
    );
}

export function ConsoleHeader({
    heroData, clock, roleLabel, bracket, patchVersion,
    allyScore, enemyScore, gsiAgeMs, llmAgeMs, intelAgeMs,
    frozen, signalLostForMs, heroCard = null, headerControls,
}: Props) {
    const metaBits = ['CONSOLE', patchVersion, bracket].filter(Boolean).join(' · ');
    return (
        <div style={{
            display: 'grid', gridTemplateColumns: '620px minmax(0,1fr)',
            borderBottom: `1px solid ${console_.line}`,
        }}>
            <div style={{
                display: 'flex', alignItems: 'center', gap: 24, padding: '0 32px',
                borderRight: `1px solid ${console_.line}`,
            }}>
                <span style={{
                    fontFamily: console_.display, fontSize: 18, fontWeight: 700,
                    letterSpacing: '.3em', color: console_.amber,
                }}>
                    RAIJIN
                </span>
                <span style={{ fontSize: 11, letterSpacing: '.18em', color: console_.chrome }}>
                    {metaBits}
                </span>
            </div>
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0 32px', fontSize: 12, letterSpacing: '.14em',
                fontFamily: console_.mono, gap: 14, minWidth: 0, ...tnum,
            }}>
                <span style={{ color: console_.chrome, whiteSpace: 'nowrap' }}>
                    T+<span style={{ color: console_.ink, fontSize: console_.tClock }}>
                        {clock !== null ? fmtMSS(clock) : '--:--'}
                    </span>
                </span>
                {heroData && (
                    <span style={{ color: console_.chrome, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {heroData.hero_name.replace(/_/g, ' ').toUpperCase()}
                        {roleLabel ? ` · ${roleLabel}` : ''} · LV{' '}
                        <span style={{ color: console_.body }}>{heroData.level}</span>
                    </span>
                )}
                {heroCard && heroCard.games > 0 && (
                    <span style={{ color: console_.chrome, whiteSpace: 'nowrap' }}>
                        {heroCard.games}G{' '}
                        <span style={{ color: console_.body }}>{Math.round(heroCard.wr * 100)}%</span>
                        {typeof heroCard.wr_delta === 'number' && (
                            <span style={{ color: heroCard.wr_delta >= 0 ? console_.radiant : console_.dire }}>
                                {' '}{heroCard.wr_delta >= 0 ? '+' : ''}{Math.round(heroCard.wr_delta * 100)} VS BRACKET
                            </span>
                        )}
                    </span>
                )}
                {allyScore !== null && enemyScore !== null && (
                    <span style={{ color: console_.chrome, whiteSpace: 'nowrap' }}>
                        SCORE <span style={{ color: console_.radiant }}>{allyScore}</span>
                        –<span style={{ color: console_.dire }}>{enemyScore}</span>
                    </span>
                )}
                {frozen ? (
                    <span style={{ color: console_.blue, letterSpacing: '.2em', whiteSpace: 'nowrap' }}>
                        FROZEN FOR REVIEW
                    </span>
                ) : signalLostForMs !== null ? (
                    <span style={{ color: console_.dire, letterSpacing: '.2em', whiteSpace: 'nowrap' }}>
                        SIGNAL LOST {fmtMSS(signalLostForMs / 1000)}
                    </span>
                ) : (
                    <span style={{ display: 'flex', gap: 14, whiteSpace: 'nowrap' }}>
                        <LinkDot label="GSI" ageMs={gsiAgeMs} freshS={3} agingS={10}
                            fmt={a => `${(a / 1000).toFixed(1)}s`} />
                        <LinkDot label="LLM" ageMs={llmAgeMs} freshS={30} agingS={120}
                            fmt={a => `${fmtMSS(a / 1000)} ago`} />
                        <LinkDot label="INTEL" ageMs={intelAgeMs} freshS={60} agingS={150}
                            fmt={a => `${fmtMSS(a / 1000)} old`} />
                    </span>
                )}
                {headerControls}
            </div>
        </div>
    );
}
