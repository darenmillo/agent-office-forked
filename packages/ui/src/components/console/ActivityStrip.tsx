/** A-7 — the pulse-check strip: a collapsible mini-terminal of engine
 *  activity (LLM calls with real latency, loud rec fires, failures, bot
 *  liveness, game boundaries) so the owner can keep an eye on what the
 *  engine is doing without tailing server logs.
 *
 *  Fixed overlay — mounts once at the RaijinRecs root so it survives the
 *  idle <-> live console surface switch. Collapsed it is a one-line pill
 *  (latest event + failure count); expanded it is a scrollback of the
 *  server's 200-event ring. Open state persists in localStorage. */
import React, { useEffect, useRef, useState } from 'react';
import { console_ } from '../../raijinTheme';
import { activityTone, ActivityTone } from '../../console';
import { ActivityEvent } from '../../raijinTypes';

const TONE: Record<ActivityTone, string> = {
    dire: console_.dire,
    phos: console_.phos,
    chrome: console_.chrome,
    amber: console_.amber,
    body: console_.body,
};

const OPEN_KEY = 'raijin_log_open';

function fmtWall(ts: number): string {
    const d = new Date(ts * 1000);
    return [d.getHours(), d.getMinutes(), d.getSeconds()]
        .map(n => String(n).padStart(2, '0'))
        .join(':');
}

export function ActivityStrip({ events }: { events: ActivityEvent[] }) {
    const [open, setOpen] = useState<boolean>(() => {
        try { return localStorage.getItem(OPEN_KEY) === '1'; } catch { return false; }
    });
    const scrollRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (open && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [events, open]);
    const toggle = () => setOpen(o => {
        const next = !o;
        try { localStorage.setItem(OPEN_KEY, next ? '1' : '0'); } catch { /* private mode */ }
        return next;
    });

    const last = events.length ? events[events.length - 1] : null;
    const failures = events.reduce((n, e) => n + (e.ok ? 0 : 1), 0);

    return (
        <div style={{
            position: 'fixed', left: 10, bottom: 10, zIndex: 60,
            fontFamily: console_.mono, fontSize: 11,
        }}>
            {open && (
                <div ref={scrollRef} style={{
                    marginBottom: 4, width: 540, maxHeight: 250, overflowY: 'auto',
                    background: 'rgba(4, 8, 10, 0.92)', border: `1px solid ${console_.line}`,
                    padding: '8px 12px',
                }}>
                    {events.length === 0 && (
                        <div style={{ color: console_.ghost, letterSpacing: '.14em' }}>
                            NO ACTIVITY YET — EVENTS LAND AS THE ENGINE WORKS
                        </div>
                    )}
                    {events.map((e, i) => (
                        <div key={`${e.ts}-${i}`} style={{ display: 'flex', gap: 10, lineHeight: 1.75, whiteSpace: 'nowrap' }}>
                            <span style={{ color: console_.ghost }}>{fmtWall(e.ts)}</span>
                            <span style={{ color: TONE[activityTone(e.kind, e.ok)], minWidth: 52, letterSpacing: '.1em' }}>
                                {e.kind.toUpperCase()}
                            </span>
                            <span style={{ color: console_.body, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {e.label}
                                {e.detail ? <span style={{ color: console_.chrome }}> · {e.detail}</span> : null}
                            </span>
                        </div>
                    ))}
                </div>
            )}
            <button
                onClick={toggle}
                aria-label={open ? 'Collapse the activity log' : 'Expand the activity log'}
                style={{
                    display: 'inline-flex', alignItems: 'center', gap: 10, maxWidth: 540,
                    background: 'rgba(4, 8, 10, 0.85)', border: `1px solid ${console_.line}`,
                    color: console_.chrome, padding: '4px 12px', cursor: 'pointer',
                    fontFamily: console_.mono, fontSize: 10, letterSpacing: '.16em',
                }}
            >
                LOG {open ? '▾' : '▸'}
                {failures > 0 && <span style={{ color: console_.dire }}>{failures} FAIL</span>}
                {!open && last && (
                    <span style={{
                        color: TONE[activityTone(last.kind, last.ok)],
                        maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap', textTransform: 'none', letterSpacing: 0,
                    }}>
                        {last.label}
                    </span>
                )}
            </button>
        </div>
    );
}
