import React, { useState, useEffect, useRef } from 'react';
import { agentName, API } from '../agentNames';
import { pip, glowText } from '../raijinTheme';

interface ActivityEvent {
    type: string;
    agent: string;
    title?: string;
    content?: string;
    time: number;
}

const TYPE_LABELS: Record<string, string> = {
    task_done: '[DONE]',
    task_failed: '[FAIL]',
    memory: '[MEM]',
};

function formatTime(ts: number): string {
    if (!ts) return '';
    const d = new Date(ts * 1000);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function SystemLog() {
    const [events, setEvents] = useState<ActivityEvent[]>([]);
    const [collapsed, setCollapsed] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const poll = async () => {
            try {
                const res = await fetch(`${API}/api/activity`);
                const data = await res.json();
                setEvents(data.events || []);
            } catch { /* offline */ }
        };
        poll();
        const id = setInterval(poll, 5000);
        return () => clearInterval(id);
    }, []);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [events]);

    if (collapsed) {
        return (
            <button
                onClick={() => setCollapsed(false)}
                style={{
                    position: 'absolute', right: 20, top: 20, zIndex: 10, pointerEvents: 'auto',
                    background: 'rgba(13,13,8,0.88)',
                    border: `1px solid ${pip.amberFaint}`,
                    borderRadius: 0, padding: '6px 12px',
                    color: pip.amber, fontSize: 11, cursor: 'pointer',
                    fontFamily: pip.font, fontWeight: 700, letterSpacing: 1,
                }}
            >
                ACTIVITY ({events.length})
            </button>
        );
    }

    return (
        <div style={{
            position: 'absolute', right: 20, top: 20, width: 280, maxHeight: 300,
            background: 'rgba(13,13,8,0.88)',
            border: `2px solid ${pip.amberFaint}`,
            borderRadius: 0,
            padding: 10, zIndex: 10, pointerEvents: 'auto',
            display: 'flex', flexDirection: 'column',
            fontFamily: pip.font,
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h3 style={{
                    margin: 0, fontSize: 13, fontWeight: 700,
                    color: pip.amber, letterSpacing: 2,
                    textShadow: glowText(pip.amber),
                }}>ACTIVITY LOG</h3>
                <button onClick={() => setCollapsed(true)} style={{
                    background: 'none', border: `1px solid ${pip.amberGhost}`,
                    color: pip.amberDim, cursor: 'pointer', fontSize: 12,
                    fontFamily: pip.font, borderRadius: 0, padding: '1px 5px',
                }}>X</button>
            </div>

            <div ref={scrollRef} style={{ overflowY: 'auto', flex: 1 }}>
                {events.length === 0 ? (
                    <p style={{ color: pip.amberFaint, fontSize: 11, margin: 0 }}>No recent activity.</p>
                ) : (
                    events.map((ev, i) => (
                        <div key={i} style={{ marginBottom: 6, fontSize: 11, color: pip.amberDim, lineHeight: 1.4 }}>
                            <span style={{ color: pip.amberFaint, marginRight: 4 }}>{formatTime(ev.time)}</span>
                            <span style={{ color: ev.type === 'task_failed' ? pip.red : pip.green }}>
                                {TYPE_LABELS[ev.type] || '[EVT]'}
                            </span>{' '}
                            <span style={{ color: pip.amber }}>{agentName(ev.agent)}</span>{' '}
                            {ev.type === 'memory' ? (
                                <span>learned: {ev.content}</span>
                            ) : (
                                <span>{ev.type === 'task_done' ? 'completed' : 'failed'}: {ev.title}</span>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
