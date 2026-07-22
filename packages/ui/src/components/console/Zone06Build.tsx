/** 06 · BUILD — THIS GAME: the itemization path from live ITEM recs.
 *
 *  Data honesty: STRATZ chips (cost / median minute / WR / N) and CDN icons
 *  render ONLY from the rec's own structured meta — engines without meta
 *  degrade to the verbatim-text path. WR is informational body text, never
 *  an alarm color: a 46% item you need is still the right buy.
 *
 *  rc-audit R1:
 *  - Row 09: card anatomy = provenance. Only engine-slotted recs with an
 *    item slug wear build-card clothes; anything else in a slot position
 *    renders as the nag species (amber rule-line, no slot label).
 *  - Row 11: evidence never truncates — chips live on their own line,
 *    prose clamps around them.
 *  - Row 13: recs the directive owns don't repeat here (directiveKey prop).
 *  - Row 14: when the directive IS the gold target, the NEXT echo collapses
 *    to a slim reference and AFTER takes the lead card. */
import React, { useState } from 'react';
import { console_ } from '../../raijinTheme';
import { ITEM_ICON_CDN, ItemRecMeta, Recommendation } from '../../raijinTypes';
import {
    GoldTarget, cardSpecies, filterDirectiveOwned, fmtMSS, itemChips,
    mergeNextEcho, normalizeDashes, selectBuildSlots,
} from '../../console';
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

/** Mono stat chips — chips wrap, never clip (row 12); AFTER compacts MED. */
function StatChips({ meta, compact }: { meta: ItemRecMeta; compact?: boolean }) {
    const chips = itemChips(meta, { compact });
    if (!chips.length) return null;
    return (
        <span style={{
            display: 'inline-flex', flexWrap: 'wrap', gap: '3px 10px', fontSize: 10.5, letterSpacing: '.1em',
            color: console_.muted, fontFamily: console_.mono, ...tnum,
        }}>
            {chips.map(c => <span key={c} style={{ whiteSpace: 'nowrap' }}>{c}</span>)}
        </span>
    );
}

/** Row 09: the nag species — a rule-line. No slot label, no card frame. */
function NagLine({ rec }: { rec: Recommendation }) {
    return (
        <div style={{
            marginTop: 14, borderLeft: `2px solid ${console_.amber}`, paddingLeft: 10,
            fontSize: 13, fontFamily: console_.reading, color: console_.muted, lineHeight: 1.4,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as never, overflow: 'hidden',
        }}>
            <b style={{ color: console_.body }}>{rec.title.replace(/[.!]?$/, '.')}</b>{' '}
            {normalizeDashes(rec.reason || rec.body)}
        </div>
    );
}

/** The build-species card (lead or after column). */
function BuildCard({ rec, slug, label, echo, compact, lead }: {
    rec: Recommendation; slug: string | null; label: string;
    echo?: string; compact?: boolean; lead: boolean;
}) {
    return (
        <div style={{ minWidth: lead ? 0 : 140, flex: 1, opacity: lead ? 1 : 0.75, display: 'flex', gap: lead ? 14 : 10 }}>
            {slug && <ItemIcon slug={slug} size={lead ? 32 : 24} />}
            <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 15, fontFamily: console_.reading, fontWeight: 600, color: lead ? console_.ink : console_.body }}>
                    {rec.title}{' '}
                    <span style={{ fontSize: 12, color: console_.amber, fontFamily: console_.mono, letterSpacing: '.08em', ...tnum }}>
                        — {label}{echo ?? ''}
                    </span>
                </div>
                {rec.meta && <div style={{ marginTop: 3 }}><StatChips meta={rec.meta} compact={compact} /></div>}
                <div style={{
                    fontSize: 13, fontFamily: console_.reading, color: console_.muted, lineHeight: 1.4,
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as never, overflow: 'hidden',
                }}>
                    {normalizeDashes(rec.reason || rec.body)}
                </div>
            </div>
        </div>
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
    /** rc-audit row 13: `category|title` key the Zone01 directive owns —
     *  recs it owns render there, not here. */
    directiveKey?: string | null;
    /** rc-audit row 14: the directive IS the gold-target item — drop the
     *  identical echo; AFTER takes the lead card. */
    directiveIsGoldTarget?: boolean;
}

export function Zone06Build({
    itemRecs, gold, goldTarget, intelReceivedAt, clock, nowMs,
    directiveKey = null, directiveIsGoldTarget = false,
}: Props) {
    // B5: engine-declared meta.build_slot wins; positional fallback when absent.
    const { next, after, pivots: rawPivots } = selectBuildSlots(itemRecs);
    const pivots = filterDirectiveOwned(rawPivots, directiveKey);
    const nextSpecies = cardSpecies(next);
    const afterSpecies = cardSpecies(after);
    const merged = mergeNextEcho(directiveIsGoldTarget, !!next && nextSpecies === 'build');
    const intelClock = intelReceivedAt !== null && clock !== null
        ? Math.max(0, clock - (nowMs - intelReceivedAt) / 1000)
        : null;
    const hasStratz = itemRecs.some(r => typeof r.meta?.win_rate === 'number' || typeof r.meta?.median_minute === 'number');
    const nextSlug = typeof next?.meta?.item === 'string' ? next.meta.item : null;
    const afterSlug = typeof after?.meta?.item === 'string' ? after.meta.item : null;
    const nextEcho = !merged && goldTarget?.recKey === (next ? `ITEM|${next.title}` : '')
        ? ` · ${gold}/${goldTarget?.cost}` : '';

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
                nextSpecies === 'nag' ? (
                    <>
                        <NagLine rec={next} />
                        {after && afterSpecies === 'build' && (
                            <div style={{ display: 'flex', marginTop: 10 }}>
                                <BuildCard rec={after} slug={afterSlug} label="AFTER" lead />
                            </div>
                        )}
                        {after && afterSpecies === 'nag' && <NagLine rec={after} />}
                    </>
                ) : merged ? (
                    <>
                        <div style={{
                            marginTop: 14, fontSize: 11, letterSpacing: '.14em',
                            color: console_.chrome, fontFamily: console_.mono, ...tnum,
                        }}>
                            NEXT ▸ {next.title.toUpperCase()} — IN DIRECTIVE
                        </div>
                        {after && afterSpecies === 'build' && (
                            <div style={{ display: 'flex', marginTop: 10 }}>
                                <BuildCard rec={after} slug={afterSlug} label="AFTER" lead />
                            </div>
                        )}
                    </>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginTop: 14 }}>
                        <BuildCard rec={next} slug={nextSlug} label="NEXT" echo={nextEcho} lead />
                        {after && afterSpecies === 'build' && (
                            <>
                                <span style={{ color: console_.ghost, fontSize: 16, flex: 'none' }}>→</span>
                                <BuildCard rec={after} slug={afterSlug} label="AFTER" compact lead={false} />
                            </>
                        )}
                    </div>
                )
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
                                    minWidth: 0,
                                    padding: i === 0 && pivots.length > 1 ? '0 20px 0 0' : i === 1 ? '0 0 0 20px' : undefined,
                                    borderRight: i === 0 && pivots.length > 1 ? `1px solid ${console_.line2}` : 'none',
                                }}
                            >
                                <b style={{
                                    display: 'block', fontSize: 13, fontFamily: console_.reading, color: console_.ink,
                                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                }}>
                                    {p.title.replace(/[.!]?$/, '.')}
                                </b>
                                {/* Row 11: the evidence line renders whole — prose clamps below it. */}
                                {p.meta && <div style={{ margin: '2px 0' }}><StatChips meta={p.meta} /></div>}
                                <div style={{
                                    fontSize: 13, fontFamily: console_.reading, lineHeight: 1.45, color: console_.muted,
                                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as never, overflow: 'hidden',
                                }}>
                                    {normalizeDashes(p.reason || p.body)}
                                </div>
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
