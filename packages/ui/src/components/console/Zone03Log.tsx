/** 03 · LOG — the WHY-first coaching feed as timecoded instrument rows.
 *  Rows age toward 60% opacity over their pacing window and never vanish
 *  mid-read (visibility itself is still pacing.ts's call). */
import React from 'react';
import { console_ } from '../../raijinTheme';
import { Recommendation } from '../../raijinTypes';
import { ageWindow } from '../../pacing';
import { fmtMSS } from '../../console';
import { ZoneLabel, Micro, tnum } from './shared';

const GLYPH_COLOR: Record<Recommendation['category'], string> = {
    FIGHT: console_.dire,
    ITEM: console_.amber,
    TIMER: console_.blue,
    SKILL: console_.radiant,
    GENERAL: console_.chrome,
};

interface Props {
    recs: Recommendation[];
    /** Extrapolated game clock (s) — timecodes rows against the game, not walltime. */
    clock: number | null;
    nowMs: number;
}

export function Zone03Log({ recs, clock, nowMs }: Props) {
    const rows = recs.slice(0, 8);
    return (
        <div style={{ padding: '20px 32px', minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ marginBottom: 12 }}>
                <ZoneLabel label="03 · LOG · WHY-FIRST" right={<Micro>AGES OUT, NEVER VANISHES</Micro>} />
            </div>
            {rows.length === 0 ? (
                <span style={{ fontSize: 11, letterSpacing: '.18em', color: console_.ghost, fontFamily: console_.mono }}>
                    NO READS YET
                </span>
            ) : (
                <div style={{
                    display: 'grid', gridTemplateColumns: '58px 14px 1fr',
                    overflow: 'hidden', ...tnum,
                }}>
                    {rows.map((r, i) => {
                        const ageMs = nowMs - (r.receivedAt ?? nowMs);
                        const fade = Math.max(0.6, 1 - 0.4 * (ageMs / ageWindow(r)));
                        const rowClock = clock !== null ? Math.max(0, clock - ageMs / 1000) : null;
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
                                <span style={{ ...cell, color: GLYPH_COLOR[r.category] ?? console_.chrome }}>▮</span>
                                <div style={{
                                    ...cell,
                                    fontFamily: console_.reading,
                                    fontSize: console_.tLog,
                                    lineHeight: 1.5,
                                    color: console_.body,
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical' as never,
                                    overflow: 'hidden',
                                }}>
                                    <b>{r.title.replace(/[.!]?$/, '.')}</b>{' '}
                                    <span style={{ color: console_.muted }}>{r.reason || r.body}</span>
                                </div>
                            </React.Fragment>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
