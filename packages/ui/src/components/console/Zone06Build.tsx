/** 06 · BUILD — THIS GAME: the itemization path from live ITEM recs.
 *
 *  Data honesty: the design's STRATZ WR%/N= chips and item icons are OMITTED —
 *  no WS feed carries win rates, and rec titles can't be reliably mapped to
 *  CDN icon slugs (backend ask: structured item fields on ITEM recs). The
 *  path (next → after) and situational pivots are the top live ITEM recs
 *  verbatim, gold progress is the real reading. */
import React from 'react';
import { console_ } from '../../raijinTheme';
import { Recommendation } from '../../raijinTypes';
import { GoldTarget, fmtMSS } from '../../console';
import { asOf } from '../../raijinTheme';
import { ZoneLabel, Micro, tnum } from './shared';

interface Props {
    itemRecs: Recommendation[];
    gold: number;
    goldTarget: GoldTarget | null;
    intelReceivedAt: number | null;
    /** Extrapolated game clock (s) at the intel receive moment — for the stamp. */
    clock: number | null;
    nowMs: number;
}

export function Zone06Build({ itemRecs, gold, goldTarget, intelReceivedAt, clock, nowMs }: Props) {
    const next = itemRecs[0] ?? null;
    const after = itemRecs[1] ?? null;
    const pivots = itemRecs.slice(2, 4);
    const intelClock = intelReceivedAt !== null && clock !== null
        ? Math.max(0, clock - (nowMs - intelReceivedAt) / 1000)
        : null;

    return (
        <div style={{
            borderRight: `1px solid ${console_.line}`,
            padding: '16px 30px',
            display: 'flex', flexDirection: 'column', minWidth: 0,
        }}>
            <ZoneLabel label="06 · BUILD — THIS GAME" right={<Micro>FROM LIVE RECS</Micro>} />
            {next ? (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginTop: 14 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 15, fontFamily: console_.reading, fontWeight: 600, color: console_.ink }}>
                            {next.title}{' '}
                            <span style={{ fontSize: 12, color: console_.amber, fontFamily: console_.mono, letterSpacing: '.08em', ...tnum }}>
                                — NEXT{goldTarget?.recKey === `ITEM|${next.title}` ? ` · ${gold}/${goldTarget.cost}` : ''}
                            </span>
                        </div>
                        <div style={{
                            fontSize: 13, fontFamily: console_.reading, color: console_.muted, lineHeight: 1.4,
                            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as never, overflow: 'hidden',
                        }}>
                            {next.reason || next.body}
                        </div>
                    </div>
                    {after && (
                        <>
                            <span style={{ color: console_.ghost, fontSize: 16, flex: 'none' }}>→</span>
                            <div style={{ minWidth: 0, flex: 1, opacity: 0.75 }}>
                                <div style={{ fontSize: 15, fontFamily: console_.reading, fontWeight: 600, color: console_.body }}>
                                    {after.title}
                                </div>
                                <div style={{
                                    fontSize: 13, fontFamily: console_.reading, color: console_.muted, lineHeight: 1.4,
                                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as never, overflow: 'hidden',
                                }}>
                                    {after.reason || after.body}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            ) : (
                <span style={{
                    marginTop: 14, fontSize: 11, letterSpacing: '.18em',
                    color: console_.ghost, fontFamily: console_.mono,
                }}>
                    NO ITEM CALL YET
                </span>
            )}
            {pivots.length > 0 && (
                <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '14px 0 10px' }}>
                        <span style={{ fontSize: 10, letterSpacing: '.22em', color: console_.gold, whiteSpace: 'nowrap', fontFamily: console_.mono }}>
                            SITUATIONAL · THIS LINEUP
                        </span>
                        <span style={{ flex: 1, height: 1, background: console_.line2 }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: pivots.length > 1 ? '1fr 1fr' : '1fr' }}>
                        {pivots.map((p, i) => (
                            <div
                                key={`${p.title}|${i}`}
                                style={{
                                    fontSize: 13, fontFamily: console_.reading, lineHeight: 1.45,
                                    color: console_.muted, minWidth: 0,
                                    padding: i === 0 && pivots.length > 1 ? '0 20px 0 0' : i === 1 ? '0 0 0 20px' : undefined,
                                    borderRight: i === 0 && pivots.length > 1 ? `1px solid ${console_.line2}` : 'none',
                                    display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as never, overflow: 'hidden',
                                }}
                            >
                                <b style={{ color: console_.ink }}>{p.title.replace(/[.!]?$/, '.')}</b>{' '}
                                {p.reason || p.body}
                            </div>
                        ))}
                    </div>
                </>
            )}
            <div style={{
                marginTop: 'auto', paddingTop: 10, fontSize: 11, letterSpacing: '.14em',
                color: console_.chrome, fontFamily: console_.mono, ...tnum,
            }}>
                {intelReceivedAt !== null
                    ? `RE-EVALUATES ON ENEMY ITEM INTEL · LAST ${intelClock !== null ? fmtMSS(intelClock) : asOf(intelReceivedAt)}`
                    : 'NO ENEMY ITEM INTEL YET'}
            </div>
        </div>
    );
}
