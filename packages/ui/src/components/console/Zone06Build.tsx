/** 06 · BUILD — THIS GAME: the itemization path from live ITEM recs.
 *
 *  Data honesty: STRATZ chips (cost / median minute / WR / N) and CDN icons
 *  render ONLY from the rec's own structured meta — engines without meta
 *  degrade to the verbatim-text path. WR is informational body text, never
 *  an alarm color: a 46% item you need is still the right buy. */
import React, { useState } from 'react';
import { console_ } from '../../raijinTheme';
import { ITEM_ICON_CDN, ItemRecMeta, Recommendation } from '../../raijinTypes';
import { GoldTarget, fmtMSS } from '../../console';
import { asOf } from '../../raijinTheme';
import { ZoneLabel, Micro, tnum } from './shared';

/** Icon that removes itself on CDN miss — never a broken-image glyph. */
function ItemIcon({ slug, size = 24 }: { slug: string; size?: number }) {
    const [ok, setOk] = useState(true);
    if (!ok) return null;
    return (
        <img
            src={`${ITEM_ICON_CDN}/${slug}.png`}
            alt=""
            aria-hidden
            onError={() => setOk(false)}
            style={{ width: Math.round(size * 1.375), height: size, display: 'block', flex: 'none' }}
        />
    );
}

/** Mono stat chips from structured ITEM meta — only real values render. */
function StatChips({ meta }: { meta: ItemRecMeta }) {
    const chips: string[] = [];
    if (typeof meta.cost === 'number') chips.push(`${meta.cost}G`);
    if (typeof meta.median_minute === 'number') chips.push(`MED ${Math.round(meta.median_minute)}'`);
    if (typeof meta.win_rate === 'number') chips.push(`${Math.round(meta.win_rate * 100)}% WR`);
    if (typeof meta.matches === 'number') {
        chips.push(`N=${meta.matches >= 1000 ? `${(meta.matches / 1000).toFixed(1)}K` : meta.matches}`);
    }
    if (!chips.length) return null;
    return (
        <span style={{
            display: 'inline-flex', gap: 10, fontSize: 10.5, letterSpacing: '.1em',
            color: console_.muted, fontFamily: console_.mono, whiteSpace: 'nowrap', ...tnum,
        }}>
            {chips.map(c => <span key={c}>{c}</span>)}
        </span>
    );
}

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
    const hasStratz = itemRecs.some(r => typeof r.meta?.win_rate === 'number' || typeof r.meta?.median_minute === 'number');
    const nextSlug = typeof next?.meta?.item === 'string' ? next.meta.item : null;
    const afterSlug = typeof after?.meta?.item === 'string' ? after.meta.item : null;

    return (
        <div style={{
            borderRight: `1px solid ${console_.line}`,
            padding: '16px 30px',
            display: 'flex', flexDirection: 'column', minWidth: 0,
        }}>
            <ZoneLabel
                label="06 · BUILD — THIS GAME"
                right={<Micro>{hasStratz ? 'STRATZ · YOUR BRACKET' : 'FROM LIVE RECS'}</Micro>}
            />
            {next ? (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginTop: 14 }}>
                    {nextSlug && <ItemIcon slug={nextSlug} size={32} />}
                    <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 15, fontFamily: console_.reading, fontWeight: 600, color: console_.ink }}>
                            {next.title}{' '}
                            <span style={{ fontSize: 12, color: console_.amber, fontFamily: console_.mono, letterSpacing: '.08em', ...tnum }}>
                                — NEXT{goldTarget?.recKey === `ITEM|${next.title}` ? ` · ${gold}/${goldTarget.cost}` : ''}
                            </span>
                        </div>
                        {next.meta && <div style={{ marginTop: 3 }}><StatChips meta={next.meta} /></div>}
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
                            <div style={{ minWidth: 0, flex: 1, opacity: 0.75, display: 'flex', gap: 10 }}>
                                {afterSlug && <ItemIcon slug={afterSlug} size={24} />}
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontSize: 15, fontFamily: console_.reading, fontWeight: 600, color: console_.body }}>
                                        {after.title}
                                    </div>
                                    {after.meta && <div style={{ marginTop: 3 }}><StatChips meta={after.meta} /></div>}
                                    <div style={{
                                        fontSize: 13, fontFamily: console_.reading, color: console_.muted, lineHeight: 1.4,
                                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as never, overflow: 'hidden',
                                    }}>
                                        {after.reason || after.body}
                                    </div>
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
