import React, { useState, useEffect, useRef } from 'react';
import { agentName, API } from '../agentNames';

interface ActivityEvent {
    type: string;  // task_done, task_failed, memory
    agent: string;
    title?: string;
    content?: string;
    time: number;
}

const TYPE_ICONS: Record<string, string> = {
    task_done: '✅',
    task_failed: '❌',
    memory: '🧠',
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
                    background: 'rgba(10,10,30,0.88)', border: '1px solid rgba(108,92,231,0.3)',
                    borderRadius: 8, padding: '6px 12px', color: '#dfe6e9', fontSize: 11, cursor: 'pointer',
                }}
            >
                📊 Activity Log ({events.length})
            </button>
        );
    }

    return (
        <div style={{
            position: 'absolute', right: 20, top: 20, width: 280, maxHeight: 300,
            background: 'rgba(10,10,30,0.88)', borderRadius: 12,
            border: '1px solid rgba(108,92,231,0.3)',
            padding: 10, zIndex: 10, pointerEvents: 'auto',
            display: 'flex', flexDirection: 'column',
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h3 style={{ margin: 0, fontSize: 13, color: '#dfe6e9' }}>📊 Activity Log</h3>
                <button onClick={() => setCollapsed(true)} style={{
                    background: 'none', border: 'none', color: '#b2bec3', cursor: 'pointer', fontSize: 14,
                }}>✕</button>
            </div>

            <div ref={scrollRef} style={{ overflowY: 'auto', flex: 1 }}>
                {events.length === 0 ? (
                    <p style={{ color: '#636e72', fontSize: 11, margin: 0 }}>No recent activity.</p>
                ) : (
                    events.map((ev, i) => (
                        <div key={i} style={{ marginBottom: 6, fontSize: 11, color: '#b2bec3', lineHeight: 1.4 }}>
                            <span style={{ color: '#636e72', marginRight: 4 }}>{formatTime(ev.time)}</span>
                            {TYPE_ICONS[ev.type] || '📌'}{' '}
                            <span style={{ color: '#6c5ce7' }}>{agentName(ev.agent)}</span>{' '}
                            {ev.type === 'memory' ? (
                                <span>learned: <em>{ev.content}</em></span>
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
