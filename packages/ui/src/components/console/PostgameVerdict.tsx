/** rc-audit rows 46/47 — the POSTGAME Zone01 takeover.
 *
 *  Replaces the live directive when the Director enters POSTGAME: urgency
 *  colors retire (no red here, win or lose), the headline is REVIEW:, and
 *  the body is the engine's deterministic verdict — what lost it, the one
 *  habit, the next drill, the personal line — all render-if-present. When
 *  an LLM closing read exists it speaks first (this is its home).
 */
import React from 'react';
import { console_ } from '../../raijinTheme';
import { PostGameReport, Recommendation } from '../../raijinTypes';
import { normalizeDashes } from '../../console';

interface Props {
    report: PostGameReport | null;
    closingRec: Recommendation | null;
    result: 'WIN' | 'LOSS' | 'UNKNOWN' | null;
}

const rowLabel: React.CSSProperties = {
    fontSize: 10, letterSpacing: '.22em', color: console_.chrome,
    flex: 'none', width: 118,
};

function VerdictRow({ k, text }: { k: string; text: string }) {
    return (
        <div style={{ display: 'flex', gap: 14, alignItems: 'baseline' }}>
            <span style={rowLabel}>{k}</span>
            <span style={{
                fontFamily: console_.reading, fontSize: 14.5, lineHeight: 1.5,
                color: console_.body, minWidth: 0,
            }}>
                {normalizeDashes(text)}
            </span>
        </div>
    );
}

export function PostgameVerdict({ report, closingRec, result }: Props) {
    const v = report?.verdict ?? null;
    const rows: Array<[string, string]> = [];
    if (v?.what_lost_it) rows.push(['WHAT LOST IT', v.what_lost_it]);
    if (v?.the_one_habit) rows.push(['THE ONE HABIT', v.the_one_habit]);
    if (v?.next_drill) rows.push(['NEXT DRILL', v.next_drill]);

    const resultColor = result === 'WIN' ? console_.radiant
        : result === 'LOSS' ? console_.muted /* urgency retired — no red postgame */
            : console_.chrome;

    return (
        <div style={{ padding: '24px 32px 20px', borderBottom: `1px solid ${console_.line}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, letterSpacing: '.26em', color: console_.chrome }}>
                    01 · REVIEW
                </span>
                {result && (
                    <span style={{ fontSize: 11, letterSpacing: '.2em', color: resultColor, fontWeight: 700 }}>
                        {result}
                    </span>
                )}
            </div>
            <div style={{
                fontFamily: console_.display, fontSize: 34, lineHeight: 1.05, fontWeight: 700,
                margin: '14px 0 12px', color: console_.ink, letterSpacing: '.005em',
            }}>
                REVIEW: <span style={{ color: console_.amber }}>THE GAME IS EVIDENCE NOW</span>
            </div>
            {closingRec && (
                <div style={{
                    fontFamily: console_.reading, fontSize: 15, lineHeight: 1.55,
                    color: console_.body, margin: '0 0 14px', maxWidth: '58ch',
                }}>
                    {normalizeDashes(closingRec.body)}
                </div>
            )}
            {rows.length > 0 && (
                <div style={{
                    display: 'flex', flexDirection: 'column', gap: 8,
                    borderTop: `1px solid ${console_.line2}`, paddingTop: 12,
                }}>
                    {rows.map(([k, text]) => <VerdictRow key={k} k={k} text={text} />)}
                </div>
            )}
            {v?.personal_line && (
                <div style={{
                    fontFamily: console_.mono, fontSize: 11.5, letterSpacing: '.06em',
                    color: console_.muted, marginTop: 12, fontVariantNumeric: 'tabular-nums',
                }}>
                    {normalizeDashes(v.personal_line)}
                </div>
            )}
            {!closingRec && rows.length === 0 && !v?.personal_line && (
                <div style={{ fontFamily: console_.reading, fontSize: 14, color: console_.muted }}>
                    Verdict pending — the report is still enriching.
                </div>
            )}
        </div>
    );
}
