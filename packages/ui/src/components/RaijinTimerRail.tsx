/** Timer rail v2 — broadcast chips with tabular numerals. Server sends
 *  absolute clock values every ~5s (TIMERS updates); this renders live
 *  countdowns client-side by extrapolating the game clock from the receive
 *  timestamp. Gold = imminent (<60s), radiant = up/ready, dire = Rosh window. */
import React, { useEffect, useState } from 'react';
import { bcast, bNum } from '../raijinTheme';
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

function Chip({ label, value, tone = 'neutral' }: {
    label: string; value: string; tone?: 'neutral' | 'soon' | 'up' | 'hot';
}) {
    const valueColor = tone === 'hot' ? bcast.dire
        : tone === 'soon' ? bcast.gold
        : tone === 'up' ? bcast.radiant
        : bcast.ink;
    return (
        <div
            style={{
                flex: '1 1 0',
                minWidth: 96,
                background: bcast.panel,
                border: `1px solid ${tone === 'hot' ? `${bcast.dire}66` : bcast.line}`,
                borderRadius: bcast.rSm,
                padding: '9px 12px',
                fontFamily: bcast.body,
            }}
        >
            <div style={{
                fontSize: 11,
                letterSpacing: '.1em',
                textTransform: 'uppercase',
                color: bcast.muted,
                fontWeight: 600,
            }}>
                {label}
            </div>
            <div style={{
                ...bNum,
                fontFamily: bcast.display,
                fontSize: 24,
                fontWeight: 700,
                marginTop: 2,
                color: valueColor,
            }}>
                {value}
            </div>
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
    const soon = (at: number) => (at - clock < 60 ? 'soon' : 'neutral') as 'soon' | 'neutral';
    const chips: React.ReactNode[] = [];

    if (rail.next_stack !== undefined) {
        chips.push(<Chip key="stack" label="Stack" value={fmt(rail.next_stack - clock)} tone={soon(rail.next_stack)} />);
    }
    if (rail.next_power_rune !== undefined) {
        chips.push(<Chip key="rune" label="Power rune" value={fmt(rail.next_power_rune - clock)} tone={soon(rail.next_power_rune)} />);
    }
    if (rail.next_bounty !== undefined) {
        chips.push(<Chip key="bounty" label="Bounty" value={fmt(rail.next_bounty - clock)} tone={soon(rail.next_bounty)} />);
    }
    if (rail.next_shrine) {
        chips.push(
            <Chip
                key="shrine"
                label={`Shrine +${rail.next_shrine.xp}xp`}
                value={fmt(rail.next_shrine.at - clock)}
                tone={soon(rail.next_shrine.at)}
            />,
        );
    }
    if (rail.tormentor) {
        const t = rail.tormentor;
        chips.push(
            <Chip
                key="torm"
                label="Tormentor"
                value={
                    t.status === 'up' ? 'UP' : t.at !== null && t.at !== undefined
                        ? fmt(t.at - clock) : '—'
                }
                tone={t.status === 'up' ? 'up' : 'neutral'}
            />,
        );
    }
    if (rail.roshan) {
        const r = rail.roshan;
        let value = '?';
        let tone: 'neutral' | 'hot' | 'up' = 'neutral';
        if (r.status === 'window') {
            value = 'WINDOW';
            tone = 'hot';
        } else if (r.status === 'dead' && r.early) {
            value = fmt(r.early - clock);
        } else if (r.status === 'up') {
            value = 'UP?';
            tone = 'up';
        }
        chips.push(<Chip key="rosh" label="Roshan" value={value} tone={tone} />);
    }
    if (rail.aegis?.expires_at !== undefined) {
        const left = rail.aegis.expires_at - clock;
        if (left > 0) {
            chips.push(<Chip key="aegis" label="Aegis" value={fmt(left)} tone={left < 60 ? 'hot' : 'neutral'} />);
        }
    }

    if (!chips.length) return null;
    return (
        <div
            role="list"
            aria-label="Objective timers"
            style={{ display: 'flex', gap: 8, alignItems: 'stretch', flexWrap: 'wrap' }}
        >
            {chips}
        </div>
    );
}
