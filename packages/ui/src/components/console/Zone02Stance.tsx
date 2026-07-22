/** 02 · STANCE — active stance word in its color, siblings ghosted.
 *  FLIPS/BREAKS cells render only when the stance engine actually sent those
 *  conditions (StanceData.inputs.flips_if / .breaks_if); otherwise the reason
 *  fills a single full-width cell. No condition is ever invented. */
import React from 'react';
import { console_, consoleStanceColor } from '../../raijinTheme';
import { StanceData } from '../../raijinTypes';
import { ZoneLabel, tnum } from './shared';

const STANCES: Array<'FARM' | 'FIGHT' | 'PUSH'> = ['FARM', 'FIGHT', 'PUSH'];

function conditionOf(inputs: Record<string, unknown> | undefined, key: string): string | null {
    const v = inputs?.[key];
    return typeof v === 'string' && v.trim() ? v : null;
}

export function Zone02Stance({ stance }: { stance: StanceData | null }) {
    const flipsIf = conditionOf(stance?.inputs, 'flips_if');
    const breaksIf = conditionOf(stance?.inputs, 'breaks_if');

    return (
        <div style={{ padding: '20px 32px', borderBottom: `1px solid ${console_.line}` }}>
            <ZoneLabel
                label="02 · STANCE"
                right={stance ? (
                    // rc-audit row 08: CONF only — the lock chip moved onto the
                    // stance word row (reserved, never clipped at the edge).
                    <span style={{
                        fontSize: 11, letterSpacing: '.14em', color: console_.chrome,
                        fontFamily: console_.mono, whiteSpace: 'nowrap', flexShrink: 0,
                    }}>
                        CONF <span style={{ color: console_.body, ...tnum }}>{Math.round(stance.confidence * 100)}%</span>
                    </span>
                ) : undefined}
            />
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 28, marginTop: 10 }}>
                {STANCES.map(s => {
                    const active = stance?.stance === s;
                    // rc-audit row 01: under a discipline lock the stance word
                    // dims — the directive is the one voice; this zone reads
                    // as a locked state, never a second imperative.
                    const locked = active && !!stance?.discipline;
                    return (
                        <span key={s} style={{
                            fontFamily: console_.display,
                            fontSize: active ? console_.tStance : console_.tStanceAlt,
                            fontWeight: active ? 700 : 600,
                            color: locked ? console_.muted
                                : active ? consoleStanceColor(s) : console_.ghost,
                            letterSpacing: active ? '.04em' : '.06em',
                        }}>
                            {s}
                        </span>
                    );
                })}
                {stance?.discipline && (
                    <span style={{
                        fontSize: 10, letterSpacing: '.2em', color: console_.amber,
                        fontFamily: console_.mono, border: `1px solid ${console_.amber}55`,
                        padding: '2px 8px', whiteSpace: 'nowrap', flexShrink: 0,
                        alignSelf: 'center',
                    }}>
                        DISCIPLINE LOCK
                    </span>
                )}
                {!stance && (
                    <span style={{
                        fontSize: 11, letterSpacing: '.18em', color: console_.ghost,
                        fontFamily: console_.mono, marginLeft: 'auto',
                    }}>
                        AWAITING STANCE ENGINE
                    </span>
                )}
            </div>
            {stance && (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: flipsIf && breaksIf ? '1fr 1fr' : '1fr',
                    marginTop: 12, borderTop: `1px solid ${console_.line2}`,
                }}>
                    {flipsIf || breaksIf ? (
                        <>
                            {flipsIf && (
                                <div style={{
                                    padding: '10px 24px 0 0',
                                    borderRight: breaksIf ? `1px solid ${console_.line2}` : 'none',
                                }}>
                                    <span style={{ fontSize: 10, letterSpacing: '.2em', color: console_.chrome, fontFamily: console_.mono }}>
                                        FLIPS TO FIGHT IF
                                    </span>
                                    <div style={{ fontSize: 13.5, color: console_.body, fontFamily: console_.reading, lineHeight: 1.45, marginTop: 4 }}>
                                        {flipsIf}
                                    </div>
                                </div>
                            )}
                            {breaksIf && (
                                <div style={{ padding: flipsIf ? '10px 0 0 24px' : '10px 24px 0 0' }}>
                                    <span style={{ fontSize: 10, letterSpacing: '.2em', color: console_.dire, fontFamily: console_.mono }}>
                                        BREAKS IF
                                    </span>
                                    <div style={{ fontSize: 13.5, color: console_.body, fontFamily: console_.reading, lineHeight: 1.45, marginTop: 4 }}>
                                        {breaksIf}
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div style={{ padding: '10px 0 0' }}>
                            <span style={{ fontSize: 10, letterSpacing: '.2em', color: console_.chrome, fontFamily: console_.mono }}>
                                WHY
                            </span>
                            <div style={{ fontSize: 13.5, color: console_.body, fontFamily: console_.reading, lineHeight: 1.45, marginTop: 4 }}>
                                {stance.reason}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
