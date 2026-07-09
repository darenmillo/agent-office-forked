/** 08 · TAPE — the 180-second forward horizon. Events drift toward NOW,
 *  recomputed every board tick. Labels alternate above/below the line and
 *  right-anchor past 82% so nothing clips. Rosh renders as a band: gold
 *  fade while pending, dire re-anchored at NOW when the window opens. */
import React from 'react';
import { console_ } from '../../raijinTheme';
import {
    TapeEvent, RoshTapeState, tapePct, tapeRightAnchor, fmtMSS,
} from '../../console';
import { ZoneLabel, PulseDot, tnum } from './shared';

const TONE_COLOR: Record<TapeEvent['tone'], string> = {
    blue: console_.blue,
    amber: console_.amber,
    gold: console_.gold,
    dire: console_.dire,
};

interface Props {
    events: TapeEvent[];
    rosh: RoshTapeState | null;
    clock: number | null;
}

export function Zone08Tape({ events, rosh, clock }: Props) {
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
            <div style={{ position: 'relative', height: 84, marginTop: 14 }}>
                {/* baseline + 30s minor ticks */}
                <div style={{ position: 'absolute', left: 0, right: 0, top: 38, height: 1, background: console_.line }} />
                <div style={{
                    position: 'absolute', left: 0, right: 0, top: 32, height: 13,
                    background: `repeating-linear-gradient(90deg, ${console_.line} 0 1px, transparent 1px calc(100%/6))`,
                }} />
                {/* NOW tick */}
                <div style={{ position: 'absolute', left: 0, top: 26, width: 2, height: 25, background: console_.amber }} />
                <div style={{ position: 'absolute', left: 0, top: 58, fontSize: 10, letterSpacing: '.18em', color: console_.amber }}>
                    NOW
                </div>
                {/* Rosh band */}
                {rosh?.state === 'pending' && (
                    <>
                        <div style={{
                            position: 'absolute', left: `${tapePct(rosh.secondsUntil)}%`, right: 0, top: 38, height: 1,
                            background: `linear-gradient(90deg, ${console_.gold}88, transparent)`,
                        }} />
                        <div style={{ position: 'absolute', left: `${tapePct(rosh.secondsUntil)}%`, top: 30, width: 1, height: 17, background: console_.gold }} />
                        <div style={{
                            position: 'absolute', left: `${tapePct(rosh.secondsUntil)}%`, top: 8,
                            fontSize: 11, letterSpacing: '.12em', color: console_.gold, whiteSpace: 'nowrap', ...tnum,
                            transform: tapeRightAnchor(rosh.secondsUntil) ? 'translateX(-100%)' : 'none',
                        }}>
                            ROSH WINDOW {fmtMSS(rosh.secondsUntil)}
                        </div>
                    </>
                )}
                {rosh?.state === 'open' && (
                    <>
                        <div style={{
                            position: 'absolute', left: 0, right: 0, top: 38, height: 1,
                            background: `linear-gradient(90deg, ${console_.dire}aa, transparent)`,
                        }} />
                        <div style={{
                            position: 'absolute', left: 0, top: 8,
                            fontSize: 11, letterSpacing: '.18em', color: console_.dire,
                            display: 'flex', alignItems: 'center', gap: 8,
                        }}>
                            <PulseDot color={console_.dire} anim="d" />
                            ROSH WINDOW OPEN
                        </div>
                    </>
                )}
                {/* events — alternate above/below in time order */}
                {events.map((e, i) => {
                    const pct = tapePct(e.secondsUntil);
                    const above = i % 2 === 1;
                    // Rosh-open owns the above-left slot; shift colliding labels down.
                    const labelTop = above ? 8 : 58;
                    const color = TONE_COLOR[e.tone];
                    return (
                        <React.Fragment key={e.key}>
                            <div style={{
                                position: 'absolute', left: `${pct}%`, top: 30, width: 1, height: 17,
                                background: color, opacity: e.tone === 'blue' && above ? 0.7 : 1,
                            }} />
                            <div style={{
                                position: 'absolute', left: `${pct}%`, top: labelTop,
                                fontSize: 11, letterSpacing: '.12em', color, whiteSpace: 'nowrap', ...tnum,
                                opacity: e.tone === 'blue' && above ? 0.8 : 1,
                                transform: tapeRightAnchor(e.secondsUntil) ? 'translateX(-100%)' : 'none',
                            }}>
                                {e.key === 'item-eta' ? e.label : `${e.label} ${fmtMSS(e.secondsUntil)}`}
                            </div>
                        </React.Fragment>
                    );
                })}
            </div>
        </div>
    );
}
