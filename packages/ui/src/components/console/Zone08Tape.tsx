/** 08 · TAPE — the 180-second forward horizon. Events drift toward NOW,
 *  recomputed every board tick.
 *
 *  rc-audit R1 (rows 21–23): label placement is deterministic — two lanes
 *  with per-lane min-gap; a crowded label shifts right on a leader tick
 *  while its time tick never moves; co-timed same-tone events merge
 *  ("0:45 · YASHA + MANTA"). Dire threat classes (enemy spikes, aegis)
 *  carry a leading band. An open rosh window shows its close bound when
 *  the engine knows it. Under three events with no rosh band the tape
 *  compresses (isTapeCompressed — the Director pass reuses the signal). */
import React from 'react';
import { console_ } from '../../raijinTheme';
import {
    TapeEvent, RoshTapeState, tapePct, fmtMSS,
} from '../../console';
import {
    layoutTapeLabels, isTapeCompressed, roshClosesIn, buybackTapeEvent, TapeBuyback,
} from '../../gapTape';
import { TimerRailData } from '../../raijinTypes';
import { ZoneLabel, PulseDot, tnum } from './shared';

const TONE_COLOR: Record<TapeEvent['tone'], string> = {
    blue: console_.blue,
    amber: console_.amber,
    gold: console_.gold,
    dire: console_.dire,
};

/** Reserved above-left % while the rosh-open banner owns that corner. */
const ROSH_OPEN_RESERVE_PCT = 20;

interface Props {
    events: TapeEvent[];
    rosh: RoshTapeState | null;
    clock: number | null;
    /** Optional timers payload — enables the late-game classes (row 22:
     *  rosh close bound, buyback) without re-deriving events. The Director
     *  pass wires it; absent = today's behavior. */
    rail?: (TimerRailData & { buyback?: TapeBuyback }) | null;
}

export function Zone08Tape({ events, rosh, clock, rail }: Props) {
    const compressed = isTapeCompressed(events, rosh);
    const closesIn = clock !== null ? roshClosesIn(rail ?? null, clock) : null;
    const buyback = clock !== null ? buybackTapeEvent(rail ?? null, clock) : null;
    const allEvents = buyback ? [...events, buyback] : events;

    const placements = layoutTapeLabels(allEvents, {
        reserveAboveLeftPct: rosh?.state === 'open' ? ROSH_OPEN_RESERVE_PCT : 0,
        singleLane: compressed,
    });

    // Lane geometry: the compressed tape halves its height (row 23) and
    // runs a single below lane; freed pixels are the Director's to give.
    const H = compressed ? 46 : 84;
    const baseTop = compressed ? 16 : 38;
    const tickTop = baseTop - 8;
    const laneTop: Record<'above' | 'below', number> = {
        above: compressed ? baseTop + 12 : 8,
        below: compressed ? baseTop + 12 : 58,
    };

    return (
        <div style={{
            borderTop: `1px solid ${console_.line}`,
            padding: '18px 36px 0',
            background: console_.base2,
            position: 'relative',
            fontFamily: console_.mono,
        }}>
            <ZoneLabel
                label="08 · TAPE — NEXT 180 SECONDS"
                right={
                    <span style={{ fontSize: 11, letterSpacing: '.26em', color: console_.chrome, ...tnum }}>
                        NOW T+{clock !== null ? fmtMSS(clock) : '--:--'}
                    </span>
                }
            />
            <div style={{ position: 'relative', height: H, marginTop: 14 }}>
                {/* baseline + 30s minor ticks */}
                <div style={{ position: 'absolute', left: 0, right: 0, top: baseTop, height: 1, background: console_.line }} />
                <div style={{
                    position: 'absolute', left: 0, right: 0, top: baseTop - 6, height: 13,
                    background: `repeating-linear-gradient(90deg, ${console_.line} 0 1px, transparent 1px calc(100%/6))`,
                }} />
                {/* NOW tick */}
                <div style={{ position: 'absolute', left: 0, top: tickTop - 4, width: 2, height: 25, background: console_.amber }} />
                <div style={{
                    position: 'absolute', left: compressed ? 8 : 0, top: compressed ? tickTop - 4 : baseTop + 20,
                    fontSize: 10, letterSpacing: '.18em', color: console_.amber,
                }}>
                    NOW
                </div>
                {/* Rosh band */}
                {rosh?.state === 'pending' && (
                    <>
                        <div style={{
                            position: 'absolute', left: `${tapePct(rosh.secondsUntil)}%`, right: 0, top: baseTop, height: 1,
                            background: `linear-gradient(90deg, ${console_.gold}88, transparent)`,
                        }} />
                        <div style={{ position: 'absolute', left: `${tapePct(rosh.secondsUntil)}%`, top: baseTop - 8, width: 1, height: 17, background: console_.gold }} />
                        <div style={{
                            position: 'absolute', left: `${tapePct(rosh.secondsUntil)}%`, top: compressed ? laneTop.below : 8,
                            fontSize: 11, letterSpacing: '.12em', color: console_.gold, whiteSpace: 'nowrap', ...tnum,
                            transform: tapePct(rosh.secondsUntil) > 82 ? 'translateX(-100%)' : 'none',
                        }}>
                            ROSH WINDOW {fmtMSS(rosh.secondsUntil)}
                        </div>
                    </>
                )}
                {rosh?.state === 'open' && (
                    <>
                        <div style={{
                            position: 'absolute', left: 0,
                            right: closesIn !== null ? `${100 - tapePct(closesIn)}%` : 0,
                            top: baseTop, height: 1,
                            background: `linear-gradient(90deg, ${console_.dire}aa, transparent)`,
                        }} />
                        {closesIn !== null && (
                            <div style={{ position: 'absolute', left: `${tapePct(closesIn)}%`, top: baseTop - 8, width: 1, height: 17, background: console_.dire }} />
                        )}
                        <div style={{
                            position: 'absolute', left: 0, top: compressed ? laneTop.below : 8,
                            fontSize: 11, letterSpacing: '.18em', color: console_.dire,
                            display: 'flex', alignItems: 'center', gap: 8, ...tnum,
                        }}>
                            <PulseDot color={console_.dire} anim="d" />
                            ROSH WINDOW OPEN{closesIn !== null ? ` · CLOSES ${fmtMSS(closesIn)}` : ''}
                        </div>
                    </>
                )}
                {/* events — deterministic lanes, leader ticks, bands (row 21/22) */}
                {placements.map(p => {
                    const color = TONE_COLOR[p.tone];
                    const merged = p.key.includes('+');
                    const label = p.key.startsWith('item-eta')
                        ? p.label
                        : merged
                            ? `${fmtMSS(p.secondsUntil)} · ${p.label}`
                            : `${p.label} ${fmtMSS(p.secondsUntil)}`;
                    const dim = p.tone === 'blue' && p.lane === 'above';
                    return (
                        <React.Fragment key={p.key}>
                            {p.band && (
                                <div style={{
                                    position: 'absolute',
                                    left: `${Math.max(0, p.tickPct - 4)}%`, width: '4%',
                                    top: baseTop - 6, height: 13,
                                    background: `linear-gradient(90deg, transparent, ${color})`,
                                    opacity: 0.3,
                                }} />
                            )}
                            <div style={{
                                position: 'absolute', left: `${p.tickPct}%`, top: baseTop - 8, width: 1, height: 17,
                                background: color, opacity: dim ? 0.7 : 1,
                            }} />
                            {p.leader && (
                                <div style={{
                                    position: 'absolute',
                                    left: `${p.tickPct}%`, width: `${p.labelPct - p.tickPct}%`,
                                    top: p.lane === 'above' ? laneTop.above + 14 : laneTop.below - 3,
                                    height: 1, background: color, opacity: 0.45,
                                }} />
                            )}
                            <div style={{
                                position: 'absolute', left: `${p.labelPct}%`, top: laneTop[p.lane],
                                fontSize: 11, letterSpacing: '.12em', color, whiteSpace: 'nowrap', ...tnum,
                                opacity: dim ? 0.8 : 1,
                            }}>
                                {label}
                            </div>
                        </React.Fragment>
                    );
                })}
            </div>
        </div>
    );
}
