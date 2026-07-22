/** 03 · LOG — the WHY-first coaching feed as timecoded instrument rows.
 *  Rows age toward 60% opacity over their pacing window and never vanish
 *  mid-read (visibility itself is still pacing.ts's call).
 *
 *  Wave 2: a fresh CHECK-IN/CLOSING answer renders as THE READ card (PHOSPHOR
 *  voice) above the rows; LLM rows carry kind + latency chips; death rows
 *  carry their trade-ledger verdict badge (TRADE reads as a win, never red). */
import React from 'react';
import { console_ } from '../../raijinTheme';
import { Recommendation } from '../../raijinTypes';
import { ageWindow } from '../../pacing';
import { fmtMSS, llmKind, LLM_KIND_LABEL, logLayout, normalizeDashes, verdictBadge } from '../../console';
import { ZoneLabel, Micro, tnum } from './shared';
import { LlmReadCard, pickReadCard } from './LlmReadCard';

const GLYPH_COLOR: Record<Recommendation['category'], string> = {
    FIGHT: console_.dire,
    ITEM: console_.amber,
    TIMER: console_.blue,
    SKILL: console_.radiant,
    GENERAL: console_.chrome,
};

const TONE_COLOR = {
    radiant: console_.radiant,
    blue: console_.blue,
    amber: console_.amber,
    dire: console_.dire,
} as const;

/** Small mono chip after the row body. */
function RowChip({ text, color }: { text: string; color: string }) {
    return (
        <span style={{
            fontSize: 9.5, letterSpacing: '.16em', color,
            fontFamily: console_.mono, whiteSpace: 'nowrap',
            border: `1px solid ${console_.line2}`,
            padding: '1px 5px', marginLeft: 8, verticalAlign: '1px',
        }}>
            {text}
        </span>
    );
}

interface Props {
    recs: Recommendation[];
    /** Extrapolated game clock (s) — timecodes rows against the game, not walltime. */
    clock: number | null;
    nowMs: number;
}

export function Zone03Log({ recs, clock, nowMs }: Props) {
    const readCard = pickReadCard(recs, nowMs);
    // rc-audit row 28: recency × severity ordering; >10-min entries become
    // one-line footnotes — a min-9 death at min 58 is a footnote.
    const { full, footnotes } = logLayout(recs.filter(r => r !== readCard), nowMs);
    const notes = footnotes.slice(0, 3);
    const rows = full.slice(0, notes.length ? 5 : 8);
    return (
        <div style={{ padding: '20px 32px', minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ marginBottom: 12 }}>
                <ZoneLabel label="03 · LOG · WHY-FIRST" right={<Micro>AGES OUT, NEVER VANISHES</Micro>} />
            </div>
            {readCard && <LlmReadCard rec={readCard} nowMs={nowMs} />}
            {rows.length === 0 && !readCard ? (
                <span style={{ fontSize: 11, letterSpacing: '.18em', color: console_.ghost, fontFamily: console_.mono }}>
                    NO READS YET
                </span>
            ) : (
                <div style={{
                    display: 'grid', gridTemplateColumns: '58px 14px 1fr',
                    overflow: 'hidden', ...tnum,
                    // Row 32: the fold fades the last entry out — never a hard
                    // clip mid-token.
                    WebkitMaskImage: 'linear-gradient(180deg, #000 calc(100% - 26px), transparent)',
                    maskImage: 'linear-gradient(180deg, #000 calc(100% - 26px), transparent)',
                }}>
                    {rows.map((r, i) => {
                        const ageMs = nowMs - (r.receivedAt ?? nowMs);
                        const fade = Math.max(0.6, 1 - 0.4 * (ageMs / ageWindow(r)));
                        const rowClock = clock !== null ? Math.max(0, clock - ageMs / 1000) : null;
                        const kind = llmKind(r);
                        const badge = r.tags?.includes('death') ? verdictBadge(r.meta?.verdict as string) : null;
                        const latencyMs = kind && typeof r.meta?.latency_ms === 'number' ? r.meta.latency_ms : null;
                        const postMortem = kind && r.meta?.delivered_alive === false;
                        const cell: React.CSSProperties = {
                            padding: '11px 0',
                            borderTop: `1px solid ${console_.line2}`,
                            opacity: fade,
                        };
                        return (
                            <React.Fragment key={`${r.category}|${r.title}|${i}`}>
                                <span style={{ ...cell, fontSize: console_.tTimecode, color: console_.chrome, fontFamily: console_.mono }}>
                                    {rowClock !== null ? fmtMSS(rowClock) : '--:--'}
                                </span>
                                <span style={{ ...cell, color: kind ? console_.phos : (GLYPH_COLOR[r.category] ?? console_.chrome) }}>▮</span>
                                <div style={{
                                    ...cell,
                                    fontFamily: console_.reading,
                                    fontSize: console_.tLog,
                                    lineHeight: 1.5,
                                    color: console_.body,
                                    // A-5 field fix: the 2-line clamp cut coaching
                                    // mid-sentence — the WHY is the product; let it
                                    // wrap. The list scrolls/ages instead of clipping.
                                    overflowWrap: 'break-word',
                                }}>
                                    <b>{normalizeDashes(r.title.replace(/[.!]?$/, '.'))}</b>{' '}
                                    <span style={{ color: console_.muted }}>{normalizeDashes(r.reason || r.body)}</span>
                                    {badge && <RowChip text={badge.label} color={TONE_COLOR[badge.tone]} />}
                                    {kind && <RowChip text={LLM_KIND_LABEL[kind]} color={console_.phos} />}
                                    {latencyMs !== null && <RowChip text={`${(latencyMs / 1000).toFixed(0)}s`} color={console_.chrome} />}
                                    {postMortem && <RowChip text="ON RESPAWN" color={console_.phosDim} />}
                                    {r.meta?.nw_approx === true && <RowChip text="NW APPROX" color={console_.chrome} />}
                                </div>
                            </React.Fragment>
                        );
                    })}
                </div>
            )}
            {notes.length > 0 && (
                <div style={{ marginTop: 8, borderTop: `1px solid ${console_.line2}`, paddingTop: 6 }}>
                    <Micro>EARLIER</Micro>
                    {notes.map((r, i) => {
                        const ageMs = nowMs - (r.receivedAt ?? nowMs);
                        const rowClock = clock !== null ? Math.max(0, clock - ageMs / 1000) : null;
                        return (
                            <div
                                key={`fn|${r.category}|${r.title}|${i}`}
                                style={{
                                    fontSize: 11, fontFamily: console_.reading, color: console_.muted,
                                    opacity: 0.45, whiteSpace: 'nowrap', overflow: 'hidden',
                                    textOverflow: 'ellipsis', marginTop: 3, ...tnum,
                                }}
                            >
                                <span style={{ fontFamily: console_.mono, fontSize: 10 }}>
                                    {rowClock !== null ? fmtMSS(rowClock) : '--:--'}
                                </span>{' '}
                                {normalizeDashes(r.title.replace(/[.!]?$/, '.'))}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
