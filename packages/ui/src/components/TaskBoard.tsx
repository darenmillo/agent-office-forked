import React, { useState, useEffect } from 'react';
import { agentName, API } from '../agentNames';

interface Task {
    id: string;
    title: string;
    status: string;
    assigned_to: string;
    created_at: number;
    result?: string;
}

const STATUS_COLORS: Record<string, string> = {
    done: '#00b894',
    in_progress: '#fdcb6e',
    pending: '#b2bec3',
    failed: '#d63031',
    cancelled: '#636e72',
};

const STATUS_ICONS: Record<string, string> = {
    done: '✅',
    in_progress: '🔄',
    pending: '⏳',
    failed: '❌',
    cancelled: '🚫',
};

function timeAgo(ts: number): string {
    if (!ts) return '';
    const diff = Math.floor(Date.now() / 1000 - ts);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

export function TaskBoard() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [expanded, setExpanded] = useState<string | null>(null);

    useEffect(() => {
        const poll = async () => {
            try {
                const res = await fetch(`${API}/api/tasks`);
                const data = await res.json();
                setTasks(data.tasks || []);
            } catch { /* server offline */ }
        };
        poll();
        const id = setInterval(poll, 5000);
        return () => clearInterval(id);
    }, []);

    const active = tasks.filter(t => t.status !== 'cancelled' && t.status !== 'stale');

    return (
        <div style={{
            position: 'absolute', left: 20, top: 20, width: 300,
            background: 'rgba(10,10,30,0.88)', borderRadius: 12,
            border: '1px solid rgba(108,92,231,0.3)',
            padding: 14, zIndex: 10, pointerEvents: 'auto',
            maxHeight: '60vh', display: 'flex', flexDirection: 'column',
        }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 14, color: '#dfe6e9' }}>
                📋 Task Board
            </h3>

            {active.length === 0 ? (
                <p style={{ color: '#636e72', fontSize: 12, margin: 0 }}>
                    No tasks yet. Chat with Path to get started.
                </p>
            ) : (
                <div style={{ overflowY: 'auto', flex: 1 }}>
                    {active.map(task => {
                        const isExpanded = expanded === task.id;
                        const hasResult = task.status === 'done' && task.result;

                        return (
                            <div key={task.id} style={{
                                borderLeft: `3px solid ${STATUS_COLORS[task.status] || '#636e72'}`,
                                padding: '6px 8px', marginBottom: 6,
                                background: 'rgba(255,255,255,0.04)', borderRadius: '0 6px 6px 0',
                                cursor: hasResult ? 'pointer' : 'default',
                            }}
                            onClick={() => hasResult && setExpanded(isExpanded ? null : task.id)}
                            >
                                <div style={{ fontSize: 12, color: '#dfe6e9', fontWeight: 500, display: 'flex', justifyContent: 'space-between' }}>
                                    <span>{STATUS_ICONS[task.status] || '❓'} {task.title}</span>
                                    {hasResult && <span style={{ fontSize: 10, color: '#6c5ce7' }}>{isExpanded ? '▼' : '▶'}</span>}
                                </div>
                                <div style={{ fontSize: 10, color: '#b2bec3', marginTop: 2 }}>
                                    → {agentName(task.assigned_to)} · {timeAgo(task.created_at)}
                                </div>

                                {/* Result preview */}
                                {hasResult && !isExpanded && (
                                    <div style={{ fontSize: 10, color: '#636e72', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {task.result!.slice(0, 80)}...
                                    </div>
                                )}

                                {/* Expanded result */}
                                {isExpanded && task.result && (
                                    <div style={{
                                        fontSize: 11, color: '#dfe6e9', marginTop: 8,
                                        padding: 8, background: 'rgba(0,0,0,0.3)', borderRadius: 4,
                                        whiteSpace: 'pre-wrap', maxHeight: 250, overflowY: 'auto',
                                        lineHeight: 1.4,
                                    }}>
                                        {task.result}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
