/** Coaching feed (Phase 1, #3) — RecCard v2, WHY-FIRST.
 *
 * The verified centerpiece pattern: `rec.reason` renders as the primary
 * supporting line, the directive/title is the headline, `body` is tertiary
 * detail. Every card carries a category chip + a quiet "as of MM:SS" stamp
 * from receivedAt, and ages toward transparency instead of vanishing
 * mid-glance. Ordering/budgets come from the PacingController upstream.
 */
import React, { useState } from 'react';
import { Recommendation, effectiveUrgency } from '../raijinTypes';
import { bcast, bLabel, bNum, asOf } from '../raijinTheme';
import { ageWindow } from '../pacing';

interface Props {
    recommendations: Recommendation[];
}

/** Category -> accent stripe (broadcast palette; gold stays priority-only
 *  in the PriorityAction tile — the feed uses goldDim for items). */
const CAT_ACCENT: Record<Recommendation['category'], string> = {
    FIGHT: bcast.dire,
    ITEM: bcast.goldDim,
    TIMER: bcast.blue,
    SKILL: bcast.radiant,
    GENERAL: bcast.muted,
};

const CAT_LABEL: Record<Recommendation['category'], string> = {
    FIGHT: 'Fight', ITEM: 'Item', TIMER: 'Timer', SKILL: 'Skill', GENERAL: 'Coach',
};

export function RaijinStrategy({ recommendations }: Props) {
    const [showAll, setShowAll] = useState(false);
    const isKnowledge = (r: Recommendation) => !!r.tags?.some(
        t => t === 'knowledge' || t === 'patch' || t === 'phase',
    );

    // The pacing controller already ordered + budgeted; the feed just splits
    // the long-lived knowledge cards from the live stream.
    const live = recommendations.filter(r => !isKnowledge(r));
    const knowledge = recommendations.filter(isKnowledge);
    const shown = showAll ? live : live.slice(0, 8);

    return (
        <section
            aria-label="Coaching feed"
            style={{
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                overflowY: 'auto',
                paddingRight: 2,
                fontFamily: bcast.body,
            }}
        >
            <div style={{ ...bLabel, display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                <span>Coaching feed</span>
                <span>WHY-first</span>
            </div>

            {shown.length === 0 && (
                <div style={{
                    fontSize: bcast.tBody,
                    color: bcast.faint,
                    padding: '6px 2px',
                }}>
                    Reads land here as the game develops — fights, items, timers.
                </div>
            )}

            {shown.map((rec, i) => <RecCard key={`${rec.category}|${rec.title}|${rec.receivedAt}`} rec={rec} first={i === 0} />)}

            {live.length > 8 && (
                <button
                    onClick={() => setShowAll(v => !v)}
                    style={{
                        background: 'transparent',
                        border: `1px solid ${bcast.line}`,
                        borderRadius: bcast.rSm,
                        color: bcast.muted,
                        padding: '6px 10px',
                        fontFamily: bcast.body,
                        fontSize: bcast.tLabel,
                        cursor: 'pointer',
                    }}
                >
                    {showAll ? 'SHOW FEWER' : `SHOW ALL (${live.length})`}
                </button>
            )}

            {knowledge.length > 0 && (
                <>
                    <div style={{ ...bLabel, fontSize: 11, marginTop: 4 }}>Game intel</div>
                    {knowledge.slice(0, 4).map(rec => (
                        <RecCard key={`${rec.category}|${rec.title}|${rec.receivedAt}`} rec={rec} />
                    ))}
                </>
            )}
        </section>
    );
}

/* ── RecCard v2 — WHY-first ── */
function RecCard({ rec, first = false }: { rec: Recommendation; first?: boolean }) {
    const urgency = effectiveUrgency(rec);
    const isCritical = urgency === 'CRITICAL';
    const accent = isCritical ? bcast.dire : CAT_ACCENT[rec.category] ?? bcast.muted;
    // Age decay: fade the card through the back half of its shelf life.
    const age = Date.now() - (rec.receivedAt ?? Date.now());
    const window = ageWindow(rec);
    const decay = Math.min(Math.max((age / window - 0.5) * 2, 0), 0.55);
    const why = rec.reason?.trim();

    return (
        <article
            className="raijin-rec-card"
            style={{
                background: bcast.panel,
                border: `1px solid ${bcast.line}`,
                borderLeft: `3px solid ${accent}`,
                borderRadius: bcast.rSm,
                padding: '11px 12px',
                opacity: 1 - decay,
                animation: first ? `raijin-rec-rise .35s ${bcast.ease} both` : undefined,
            }}
        >
            <style>{`
                @keyframes raijin-rec-rise {
                    from { opacity: 0; transform: translateY(8px); }
                    to { transform: none; }
                }
                @media (prefers-reduced-motion: reduce) {
                    .raijin-rec-card { animation: none !important; }
                }
            `}</style>
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 8, marginBottom: 4,
            }}>
                <span style={{
                    fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase',
                    fontWeight: 600, color: accent,
                }}>
                    {isCritical ? 'CRITICAL' : CAT_LABEL[rec.category] ?? rec.category}
                </span>
                <span style={{ ...bNum, fontSize: 12, color: bcast.faint }}>{asOf(rec.receivedAt)}</span>
            </div>
            <div style={{
                fontSize: bcast.tRec,
                fontWeight: 600,
                lineHeight: 1.25,
                color: isCritical ? bcast.dire : bcast.ink,
            }}>
                {rec.title}
            </div>
            {why ? (
                <div style={{ fontSize: bcast.tSub, color: bcast.muted, lineHeight: 1.45, marginTop: 5 }}>
                    <b style={{ color: bcast.ink, fontWeight: 600 }}>Why:</b> {why}
                    {rec.body && rec.body !== why && (
                        <span style={{ color: bcast.faint }}> · {rec.body}</span>
                    )}
                </div>
            ) : (
                rec.body && (
                    <div style={{ fontSize: bcast.tSub, color: bcast.muted, lineHeight: 1.45, marginTop: 5 }}>
                        {rec.body}
                    </div>
                )
            )}
        </article>
    );
}
