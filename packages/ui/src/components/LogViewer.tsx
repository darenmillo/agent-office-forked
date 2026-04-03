import React, { useState, useEffect, useRef } from 'react';
import { API } from '../agentNames';
import { pip, glowText } from '../raijinTheme';

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

    const colorize = (line: string): string => {
        if (line.includes('[ToolLoop]')) return pip.amber;
        if (line.includes('[WorkLoop]')) return pip.green;
        if (line.includes('[RateLimit]')) return pip.amberBright;
        if (line.includes('[Memory]')) return pip.catItem;
        if (line.includes('[ExecLog]')) return pip.blue;
        if (line.includes('ERROR') || line.includes('error') || line.includes('failed')) return pip.red;
        if (line.includes('HTTP Request')) return pip.amberGhost;
        return pip.amberDim;
    };

    return (
        <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0, width: 420,
            background: 'rgba(10,10,6,0.96)',
            borderRight: `2px solid ${pip.amberFaint}`,
            display: 'flex', flexDirection: 'column',
            zIndex: 20, pointerEvents: 'auto',
            fontFamily: pip.font,
        }}>
            <div style={{
                padding: '8px 12px',
                borderBottom: `2px solid ${pip.amberFaint}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
                <span style={{
                    fontSize: 13, fontWeight: 700, color: pip.amber,
                    letterSpacing: 2,
                    textShadow: glowText(pip.amber),
                }}>
                    BOT MANAGER LOGS
                </span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <label style={{
                        fontSize: 10, color: pip.amberDim,
                        display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer',
                    }}>
                        <input
                            type="checkbox"
                            checked={autoScroll}
                            onChange={e => setAutoScroll(e.target.checked)}
                            style={{ width: 12, height: 12, accentColor: pip.amber }}
                        />
                        AUTO
                    </label>
                    <button onClick={onClose} style={{
                        background: 'none', border: `1px solid ${pip.amberGhost}`,
                        color: pip.amberDim, cursor: 'pointer', fontSize: 12,
                        fontFamily: pip.font, borderRadius: 0, padding: '1px 5px',
                    }}>X</button>
                </div>
            </div>

            <div ref={scrollRef} style={{
                flex: 1, overflowY: 'auto', padding: '6px 10px',
                fontSize: 10, lineHeight: 1.6,
            }}>
                {lines.length === 0 ? (
                    <div style={{ color: pip.amberFaint, padding: 20, textAlign: 'center' }}>
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
