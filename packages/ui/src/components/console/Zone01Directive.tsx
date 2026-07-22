/** 01 · DIRECTIVE — THE one priority action, WHY-first, with the gold-target
 *  progress instrument. Pick logic is pacing.ts's pickPriorityAction,
 *  unchanged. The progress bar exists ONLY when a real rec stated a cost.
 *
 *  CRITICAL takeover (Round-2 B/CUT language): a fresh CRITICAL directive
 *  gets the red top rule + mono CRITICAL strip + oversized directive. One
 *  alarm at a time — this zone is the only place the board goes red. */
import React, { useRef } from 'react';
import { console_ } from '../../raijinTheme';
import { HeroData, Recommendation, effectiveUrgency } from '../../raijinTypes';
import { GoldTarget, goldEtaSeconds, fmtMSS } from '../../console';
import { DwellTracker, directiveIsStale, recKey } from '../../pacing';
import { ZoneLabel, StatusFlag, PulseDot, tnum } from './shared';

/** A CRITICAL directive runs at takeover intensity while younger than this. */
const CUT_FRESH_MS = 30_000;
/** Buyback instrument appears from this game clock on (noise gate). */
const BUYBACK_FROM_S = 25 * 60;

interface Props {
    action: Recommendation | null;
    heroData: HeroData;
    goldTarget: GoldTarget | null;
    clock: number | null;
    nowMs: number;
}

export function Zone01Directive({ action, heroData, goldTarget, clock, nowMs }: Props) {
    const urgency = action ? effectiveUrgency(action) : 'ROUTINE';
    // rc-audit row 02: red is budgeted. A CRITICAL key holds true red for 90s
    // from onset, then decays to the amber CRITICAL treatment; only a NEW
    // alarm (new key) re-arms red. Kills the 36-minute wallpaper.
    const dwellRef = useRef(new DwellTracker());
    const rawCritical = urgency === 'CRITICAL';
    const dwell = rawCritical && action ? dwellRef.current.state(recKey(action), nowMs) : null;
    const critical = rawCritical && dwell === 'red';
    const criticalDecayed = rawCritical && dwell === 'amber';
    const dead = !heroData.alive;
    const cutTakeover = !dead && critical && !!action
        && nowMs - (action.receivedAt ?? 0) < CUT_FRESH_MS;
    const stale = directiveIsStale(action, nowMs); // row 03 belt
    const gold = heroData.gold;
    const targetReached = !!goldTarget && gold >= goldTarget.cost;
    const eta = goldTarget ? goldEtaSeconds(goldTarget, gold, heroData.gpm) : null;
    const goldPct = goldTarget ? Math.min(100, (gold / goldTarget.cost) * 100) : 0;

    // rc-audit row 06: while the death panel is up it IS the critical surface —
    // this zone drops to a dim echo (flag included). One red surface, literally.
    const flag = dead
        ? <StatusFlag color={console_.muted} anim="d" label="DEAD" />
        : critical
            ? <StatusFlag color={console_.dire} anim="d" label="CRITICAL" />
            : criticalDecayed
                ? <StatusFlag color={console_.amber} anim="d" label="CRITICAL" />
                : targetReached
                    ? <StatusFlag color={console_.radiant} anim="a" label="SPIKE REACHED" />
                    : <StatusFlag color={console_.amber} anim="a" label="LIVE" />;

    const directiveText = dead
        ? '→ SEE RESPAWN PANEL'
        : action
            ? action.title
            : 'NO LIVE CALL — PLAY YOUR GAME';
    // A-5 sizing input: the plain-string length of whatever renders above
    // (the dead-state JSX is a fixed short line — treat it as such).
    const directiveLen = typeof directiveText === 'string' ? directiveText.length : 30;

    const whyText = dead
        ? 'Respawn coaching is on the panel — spend plan, verdict, check-in.'
        : action
            ? (action.reason || action.body)
            : 'The next read lands here.';

    const buybackCost = typeof heroData.buyback_cost === 'number' ? heroData.buyback_cost : null;
    const buybackCd = typeof heroData.buyback_cooldown === 'number' ? heroData.buyback_cooldown : 0;
    const showBuyback = buybackCost !== null && buybackCost > 0
        && clock !== null && clock >= BUYBACK_FROM_S;
    const buybackBanked = buybackCost !== null && gold >= buybackCost && buybackCd <= 0;

    return (
        <div style={{
            padding: '28px 32px 24px',
            borderBottom: `1px solid ${console_.line}`,
            borderTop: cutTakeover ? `3px solid ${console_.dire}` : '3px solid transparent',
            background: cutTakeover ? 'rgba(255,89,100,.04)' : 'transparent',
            transition: `background 220ms ${console_.ease}`,
        }}>
            {cutTakeover ? (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    fontSize: 12, letterSpacing: '.3em', color: console_.dire,
                    fontFamily: console_.mono,
                }}>
                    <PulseDot color={console_.dire} anim="d" />
                    CRITICAL{action?.category ? ` — ${action.category}` : ''}
                </div>
            ) : (
                <ZoneLabel label="01 · DIRECTIVE" right={flag} />
            )}
            <div
                className="console-fade"
                style={{
                    fontFamily: console_.display,
                    // A-5: long LLM reads promoted into the directive slot were
                    // clipping mid-sentence at 52px. Step the display size down
                    // with length instead of clamping — the words always win.
                    fontSize: cutTakeover ? 64
                        : directiveLen > 140 ? 22
                        : directiveLen > 60 ? 30
                        : console_.tDirective,
                    lineHeight: directiveLen > 60 ? 1.2 : 1.02,
                    fontWeight: 700,
                    margin: '16px 0 12px',
                    // dead = dim echo (row 06); decayed CRITICAL = amber (row 02)
                    color: dead ? console_.ghost
                        : critical ? console_.dire
                        : criticalDecayed ? console_.amber
                        : action ? console_.ink : console_.ghost,
                    letterSpacing: cutTakeover ? '-.005em' : '.005em',
                    textTransform: 'uppercase',
                    overflowWrap: 'break-word',
                }}
            >
                {directiveText}
            </div>
            {whyText && (
                <p style={{
                    margin: 0, fontSize: console_.tReading, lineHeight: 1.55,
                    color: console_.muted, fontFamily: console_.reading, maxWidth: '52ch',
                    overflowWrap: 'break-word',
                }}>
                    {whyText}
                    {stale && !dead && (
                        // row 03: numbers older than 60s stop asserting.
                        <span style={{
                            marginLeft: 8, fontSize: 10, letterSpacing: '.18em',
                            fontFamily: console_.mono, color: console_.chrome,
                            border: `1px solid ${console_.line}`, padding: '1px 5px',
                            verticalAlign: 'middle',
                        }}>
                            STALE {Math.round((nowMs - (action?.receivedAt ?? nowMs)) / 1000)}S
                        </span>
                    )}
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
                {showBuyback && (
                    <div style={{
                        display: 'flex', justifyContent: 'space-between', marginTop: 9,
                        fontSize: 11, letterSpacing: '.16em', fontFamily: console_.mono, ...tnum,
                    }}>
                        <span style={{ color: console_.chrome }}>
                            BUYBACK <span style={{ color: console_.body }}>{gold}/{buybackCost}G</span>
                        </span>
                        <span style={{ color: buybackBanked ? console_.radiant : console_.dire }}>
                            {buybackCd > 0
                                ? `ON COOLDOWN ${fmtMSS(buybackCd)}`
                                : buybackBanked ? 'BANKED — HOLD IT' : 'NOT BANKED — DO NOT DIE'}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
