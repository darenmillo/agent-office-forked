import React, { useState, useEffect, useRef } from 'react';
import { API } from '../agentNames';

/**
 * Live log viewer — polls /api/logs/tail and displays bot_manager
 * terminal output. Toggle-able via button in top bar.
 */
export function LogViewer({ visible, onClose }: { visible: boolean; onClose: () => void }) {
    const [lines, setLines] = useState<string[]>([]);
    const [autoScroll, setAutoScroll] = useState(true);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!visible) return;

        const poll = async () => {
            try {
                const res = await fetch(`${API}/api/logs/tail?n=200`);
                const data = await res.json();
                setLines(data.lines || []);
            } catch { /* offline */ }
        };
        poll();
        const id = setInterval(poll, 3000);
        return () => clearInterval(id);
    }, [visible]);

    useEffect(() => {
        if (autoScroll && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [lines, autoScroll]);

    if (!visible) return null;

    // Color-code log lines
    const colorize = (line: string): string => {
        if (line.includes('[ToolLoop]')) return '#6c5ce7';
        if (line.includes('[WorkLoop]')) return '#00b894';
        if (line.includes('[RateLimit]')) return '#fdcb6e';
        if (line.includes('[Memory]')) return '#e17055';
        if (line.includes('[ExecLog]')) return '#74b9ff';
        if (line.includes('ERROR') || line.includes('error') || line.includes('failed')) return '#d63031';
        if (line.includes('HTTP Request')) return '#636e72';
        return '#b2bec3';
    };

    return (
        <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0, width: 420,
            background: 'rgba(5,5,15,0.95)', borderRight: '1px solid rgba(108,92,231,0.3)',
            display: 'flex', flexDirection: 'column',
            zIndex: 20, pointerEvents: 'auto',
        }}>
            <div style={{
                padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.1)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#dfe6e9' }}>
                    📟 Bot Manager Logs
                </span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <label style={{ fontSize: 10, color: '#b2bec3', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={autoScroll}
                            onChange={e => setAutoScroll(e.target.checked)}
                            style={{ width: 12, height: 12 }}
                        />
                        Auto-scroll
                    </label>
                    <button onClick={onClose} style={{
                        background: 'none', border: 'none', color: '#b2bec3', cursor: 'pointer', fontSize: 14,
                    }}>✕</button>
                </div>
            </div>

            <div ref={scrollRef} style={{
                flex: 1, overflowY: 'auto', padding: '6px 10px',
                fontFamily: 'Consolas, "Courier New", monospace',
                fontSize: 10, lineHeight: 1.6,
            }}>
                {lines.length === 0 ? (
                    <div style={{ color: '#636e72', padding: 20, textAlign: 'center' }}>
                        No logs yet. Start the bot manager to see output.
                    </div>
                ) : (
                    lines.map((line, i) => (
                        <div key={i} style={{ color: colorize(line), whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                            {line}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
