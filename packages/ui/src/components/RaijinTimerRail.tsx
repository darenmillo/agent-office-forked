/** v6 Phase 12: timer rail — stack window, runes, wisdom shrine (+XP),
 *  Tormentor, Roshan window, aegis. Server sends absolute clock values every
 *  ~5s (TIMERS updates); this renders live countdowns client-side by
 *  extrapolating the game clock from the receive timestamp. */
import React, { useEffect, useState } from 'react';
import { pip } from '../raijinTheme';
import type { TimerRailData } from '../raijinTypes';

interface Props {
    rail: TimerRailData | null;
    receivedAt: number | null; // Date.now() when the update landed
}

function fmt(sec: number): string {
    if (sec <= 0) return 'now';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function Chip({ label, value, hot }: { label: string; value: string; hot?: boolean }) {
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: `${pip.sp1}px ${pip.sp3}px`,
                border: `1px solid ${hot ? pip.red : pip.amberFaint}`,
                background: pip.bgInset,
                minWidth: 74,
            }}
        >
            <span style={{ fontSize: pip.textXs, color: pip.amberDim, letterSpacing: 1 }}>
                {label}
            </span>
            <span
                style={{
                    fontSize: pip.textSm,
                    fontWeight: 700,
                    color: hot ? pip.red : pip.amberBright,
                }}
            >
                {value}
            </span>
        </div>
    );
}

export function RaijinTimerRail({ rail, receivedAt }: Props) {
    const [, tick] = useState(0);
    useEffect(() => {
        const id = setInterval(() => tick(t => t + 1), 1000);
        return () => clearInterval(id);
    }, []);

    if (!rail || receivedAt === null || rail.clock === undefined || rail.clock < 0) {
        return null;
    }
    // Extrapolated current game clock (server ticks ~1Hz; drift is bounded by
    // the ~5s TIMERS refresh)
    const clock = rail.clock + Math.floor((Date.now() - receivedAt) / 1000);
    const chips: React.ReactNode[] = [];

    if (rail.next_stack !== undefined) {
        chips.push(<Chip key="stack" label="STACK" value={fmt(rail.next_stack - clock)} />);
    }
    if (rail.next_power_rune !== undefined) {
        chips.push(<Chip key="rune" label="RUNE" value={fmt(rail.next_power_rune - clock)} />);
    }
    if (rail.next_bounty !== undefined) {
        chips.push(<Chip key="bounty" label="BOUNTY" value={fmt(rail.next_bounty - clock)} />);
    }
    if (rail.next_shrine) {
        chips.push(
            <Chip
                key="shrine"
                label={`SHRINE +${rail.next_shrine.xp}xp`}
                value={fmt(rail.next_shrine.at - clock)}
            />,
        );
    }
    if (rail.tormentor) {
        const t = rail.tormentor;
        chips.push(
            <Chip
                key="torm"
                label="TORM"
                value={
                    t.status === 'up' ? 'UP' : t.at !== null && t.at !== undefined
                        ? fmt(t.at - clock) : '—'
                }
            />,
        );
    }
    if (rail.roshan) {
        const r = rail.roshan;
        let value = '?';
        let hot = false;
        if (r.status === 'window') {
            value = 'WINDOW';
            hot = true;
        } else if (r.status === 'dead' && r.early) {
            value = fmt(r.early - clock);
        } else if (r.status === 'up') {
            value = 'UP?';
        }
        chips.push(<Chip key="rosh" label="ROSH" value={value} hot={hot} />);
    }
    if (rail.aegis?.expires_at !== undefined) {
        const left = rail.aegis.expires_at - clock;
        if (left > 0) {
            chips.push(<Chip key="aegis" label="AEGIS" value={fmt(left)} hot={left < 60} />);
        }
    }

    if (!chips.length) return null;
    return (
        <div
            style={{
                gridColumn: '1 / -1',
                display: 'flex',
                gap: pip.sp2,
                alignItems: 'stretch',
                fontFamily: pip.font,
            }}
        >
            {chips}
        </div>
    );
}
