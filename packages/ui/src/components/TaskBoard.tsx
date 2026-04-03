import React, { useState, useEffect } from 'react';
import { agentName, API } from '../agentNames';
import { pip, glowText } from '../raijinTheme';

interface Task {
    id: string;
    title: string;
    status: string;
    assigned_to: string;
    created_at: number;
    result?: string;
}

const STATUS_COLORS: Record<string, string> = {
    done: pip.green,
    in_progress: pip.amber,
    pending: pip.amberDim,
    failed: pip.red,
    cancelled: pip.amberFaint,
};

const STATUS_LABELS: Record<string, string> = {
    done: 'DONE',
    in_progress: 'EXEC',
    pending: 'WAIT',
    failed: 'FAIL',
    cancelled: 'VOID',
};

function timeAgo(ts: number): string {
    if (!ts) return '';
    const diff = Math.floor(Date.now() / 1000 - ts);
    if (diff < 60) return 'now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
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
            position: 'absolute', left: 56, top: 20, width: 300,
            background: 'rgba(13,13,8,0.92)',
            border: `2px solid ${pip.amberFaint}`,
            borderRadius: 0,
            padding: 14, zIndex: 10, pointerEvents: 'auto',
            maxHeight: '60vh', display: 'flex', flexDirection: 'column',
            fontFamily: pip.font,
        }}>
            <h3 style={{
                margin: '0 0 10px', fontSize: 14, fontWeight: 700,
                color: pip.amber, letterSpacing: 2,
                textShadow: glowText(pip.amber),
            }}>
                TASK BOARD
            </h3>

            {active.length === 0 ? (
                <p style={{ color: pip.amberFaint, fontSize: 12, margin: 0 }}>
                    No tasks. Chat with Path to get started.
                </p>
            ) : (
                <div style={{ overflowY: 'auto', flex: 1 }}>
                    {active.map(task => {
                        const isExpanded = expanded === task.id;
                        const hasResult = task.status === 'done' && task.result;
                        const statusColor = STATUS_COLORS[task.status] || pip.amberFaint;

                        return (
                            <div key={task.id} style={{
                                borderLeft: `3px solid ${statusColor}`,
                                padding: '6px 8px', marginBottom: 6,
                                background: pip.bgInset,
                                cursor: hasResult ? 'pointer' : 'default',
                            }}
                            onClick={() => hasResult && setExpanded(isExpanded ? null : task.id)}
                            >
                                <div style={{
                                    fontSize: 12, color: pip.amber, fontWeight: 600,
                                    display: 'flex', justifyContent: 'space-between',
                                }}>
                                    <span>[{STATUS_LABELS[task.status] || '?'}] {task.title}</span>
                                    {hasResult && <span style={{ fontSize: 10, color: pip.amberDim }}>{isExpanded ? '\u25BC' : '\u25B6'}</span>}
                                </div>
                                <div style={{ fontSize: 10, color: pip.amberDim, marginTop: 2 }}>
                                    {'\u2192'} {agentName(task.assigned_to)} {'\u00B7'} {timeAgo(task.created_at)}
                                </div>

                                {hasResult && !isExpanded && (
                                    <div style={{
                                        fontSize: 10, color: pip.amberFaint, marginTop: 4,
                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                    }}>
                                        {task.result!.slice(0, 80)}...
                                    </div>
                                )}

                                {isExpanded && task.result && (
                                    <div style={{
                                        fontSize: 11, color: pip.amberDim, marginTop: 8,
                                        padding: 8, background: pip.bgDeep,
                                        whiteSpace: 'pre-wrap', maxHeight: 250, overflowY: 'auto',
                                        lineHeight: 1.4, border: `1px solid ${pip.amberGhost}`,
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
