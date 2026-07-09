/** THE READ — PHOSPHOR-language card for a fresh CHECK-IN or CLOSING-PLAN
 *  answer (Round-2 C: the amber-monochrome register is "the coach speaking").
 *
 *  Renders the newest fresh (≤60s) checkin/closing rec above the log; ambient
 *  reads stay as ordinary log rows. Latency honesty on the card: the measured
 *  call latency and an ON-RESPAWN badge when the answer arrived post-mortem. */
import React from 'react';
import { console_ } from '../../raijinTheme';
import { Recommendation } from '../../raijinTypes';
import { llmKind, LLM_KIND_LABEL, fmtMSS } from '../../console';
import { tnum } from './shared';

const FRESH_MS = 60_000;

/** Newest fresh checkin/closing rec, or null. */
export function pickReadCard(recs: Recommendation[], nowMs: number): Recommendation | null {
    const candidates = recs
        .filter(r => {
            const kind = llmKind(r);
            return kind === 'checkin' || kind === 'closing';
        })
        .filter(r => nowMs - (r.receivedAt ?? 0) < FRESH_MS)
        .sort((a, b) => (b.receivedAt ?? 0) - (a.receivedAt ?? 0));
    return candidates[0] ?? null;
}

/** Corner registration tick (PHOSPHOR frame language). */
function Tick({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
    const s: React.CSSProperties = { position: 'absolute', width: 10, height: 10 };
    const b = `1px solid ${console_.phos}`;
    if (pos === 'tl') Object.assign(s, { left: -1, top: -1, borderLeft: b, borderTop: b });
    if (pos === 'tr') Object.assign(s, { right: -1, top: -1, borderRight: b, borderTop: b });
    if (pos === 'bl') Object.assign(s, { left: -1, bottom: -1, borderLeft: b, borderBottom: b });
    if (pos === 'br') Object.assign(s, { right: -1, bottom: -1, borderRight: b, borderBottom: b });
    return <span style={s} aria-hidden />;
}

export function LlmReadCard({ rec, nowMs }: { rec: Recommendation; nowMs: number }) {
    const kind = llmKind(rec);
    if (!kind) return null;
    const latencyMs = typeof rec.meta?.latency_ms === 'number' ? rec.meta.latency_ms : null;
    const postMortem = rec.meta?.delivered_alive === false;
    const ageS = Math.max(0, (nowMs - (rec.receivedAt ?? nowMs)) / 1000);

    return (
        <div style={{
            position: 'relative',
            border: `1px solid ${console_.phosDim}`,
            padding: '12px 16px 14px',
            marginBottom: 14,
            background: 'rgba(217,185,106,.03)',
        }}>
            <Tick pos="tl" /><Tick pos="tr" /><Tick pos="bl" /><Tick pos="br" />
            <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                fontSize: 10, letterSpacing: '.26em', fontFamily: console_.mono,
                color: console_.phosDim, ...tnum,
            }}>
                <span>
                    {LLM_KIND_LABEL[kind]}
                    {postMortem && <span style={{ color: console_.phos }}> · ON RESPAWN</span>}
                </span>
                <span>
                    {latencyMs !== null && `READ IN ${(latencyMs / 1000).toFixed(0)}s · `}
                    {fmtMSS(ageS)} AGO
                </span>
            </div>
            <div style={{
                fontFamily: console_.display, fontSize: 21, lineHeight: 1.15, fontWeight: 600,
                color: console_.phosInk, margin: '8px 0 6px',
            }}>
                {rec.title}
            </div>
            <div style={{
                fontFamily: console_.reading, fontSize: 14.5, lineHeight: 1.55,
                color: console_.phos,
                display: '-webkit-box', WebkitLineClamp: 5,
                WebkitBoxOrient: 'vertical' as never, overflow: 'hidden',
            }}>
                {rec.reason ? <>{rec.body} <span style={{ color: console_.phosDim }}>{rec.reason}</span></> : rec.body}
            </div>
        </div>
    );
}
