/** 01 · DIRECTIVE — THE one priority action, WHY-first, with the gold-target
 *  progress instrument. Pick logic is pacing.ts's pickPriorityAction,
 *  unchanged. The progress bar exists ONLY when a real rec stated a cost. */
import React from 'react';
import { console_ } from '../../raijinTheme';
import { HeroData, Recommendation, effectiveUrgency } from '../../raijinTypes';
import { GoldTarget, goldEtaSeconds, fmtMSS } from '../../console';
import { ZoneLabel, StatusFlag, tnum } from './shared';

interface Props {
    action: Recommendation | null;
    heroData: HeroData;
    goldTarget: GoldTarget | null;
}

export function Zone01Directive({ action, heroData, goldTarget }: Props) {
    const urgency = action ? effectiveUrgency(action) : 'ROUTINE';
    const critical = urgency === 'CRITICAL';
    const dead = !heroData.alive;
    const gold = heroData.gold;
    const targetReached = !!goldTarget && gold >= goldTarget.cost;
    const eta = goldTarget ? goldEtaSeconds(goldTarget, gold, heroData.gpm) : null;
    const goldPct = goldTarget ? Math.min(100, (gold / goldTarget.cost) * 100) : 0;

    const flag = critical || dead
        ? <StatusFlag color={console_.dire} anim="d" label={dead ? 'DEAD' : 'CRITICAL'} />
        : targetReached
            ? <StatusFlag color={console_.radiant} anim="a" label="SPIKE REACHED" />
            : <StatusFlag color={console_.amber} anim="a" label="LIVE" />;

    const directiveText = dead
        ? <>SPEND <span style={{ color: console_.dire, ...tnum }}>{gold}G</span> BEFORE RESPAWN</>
        : action
            ? action.title
            : 'NO LIVE CALL — PLAY YOUR GAME';

    const whyText = dead
        ? 'Buying from the fountain shop converts dead time into your next timing.'
        : action
            ? (action.reason || action.body)
            : 'The next read lands here.';

    return (
        <div style={{ padding: '28px 32px 24px', borderBottom: `1px solid ${console_.line}` }}>
            <ZoneLabel label="01 · DIRECTIVE" right={flag} />
            <div
                className="console-fade"
                style={{
                    fontFamily: console_.display,
                    fontSize: console_.tDirective,
                    lineHeight: 1.02,
                    fontWeight: 700,
                    margin: '16px 0 12px',
                    color: critical || dead ? console_.dire : action ? console_.ink : console_.ghost,
                    letterSpacing: '.005em',
                    textTransform: 'uppercase',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical' as never,
                    overflow: 'hidden',
                }}
            >
                {directiveText}
            </div>
            {whyText && (
                <p style={{
                    margin: 0, fontSize: console_.tReading, lineHeight: 1.55,
                    color: console_.muted, fontFamily: console_.reading, maxWidth: '52ch',
                    display: '-webkit-box', WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical' as never, overflow: 'hidden',
                }}>
                    {whyText}
                </p>
            )}
            <div style={{ marginTop: 18 }}>
                <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    fontSize: 11, letterSpacing: '.16em', color: console_.chrome,
                    marginBottom: 7, fontFamily: console_.mono, ...tnum,
                }}>
                    {goldTarget ? (
                        <>
                            <span>{gold} / {goldTarget.cost} G</span>
                            <span style={{ color: console_.body }}>
                                {targetReached
                                    ? 'COMPLETE — SHOP ON NEXT BACK'
                                    : `−${goldTarget.cost - gold}${eta !== null ? ` · ≈${fmtMSS(eta)}` : ''}`}
                            </span>
                        </>
                    ) : (
                        <>
                            <span>{gold} G</span>
                            <span>GPM {heroData.gpm}</span>
                        </>
                    )}
                </div>
                {goldTarget && (
                    <div style={{ height: 2, background: console_.line, position: 'relative' }}>
                        <div style={{
                            position: 'absolute', left: 0, top: 0, bottom: 0,
                            width: `${goldPct}%`,
                            background: targetReached ? console_.radiant : console_.amber,
                        }} />
                        <div style={{
                            position: 'absolute', left: `${goldPct}%`, top: -3,
                            width: 1, height: 8,
                            background: targetReached ? console_.radiant : console_.amber,
                        }} />
                    </div>
                )}
            </div>
        </div>
    );
}
