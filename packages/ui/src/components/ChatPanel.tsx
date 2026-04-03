import React, { useState, useRef, useEffect } from 'react';
import { API } from '../agentNames';
import { pip, glowText } from '../raijinTheme';

interface Message {
    sender: string;
    text: string;
    time?: string;
}

const STORAGE_KEY = 'agent-office-chat-history';

function loadHistory(): Message[] {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) return JSON.parse(stored);
    } catch { /* corrupt storage */ }
    return [{ sender: 'System', text: 'Chat with Path Palmer (PM) to create tasks.' }];
}

function saveHistory(messages: Message[]) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-100)));
    } catch { /* full storage */ }
}

export function ChatPanel() {
    const [messages, setMessages] = useState<Message[]>(loadHistory);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => { saveHistory(messages); }, [messages]);

    const scrollToBottom = () => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    };

    useEffect(() => { setTimeout(scrollToBottom, 100); }, []);

    const sendMessage = async () => {
        const text = input.trim();
        if (!text || loading) return;

        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setInput('');
        setMessages(prev => [...prev, { sender: 'You', text, time }]);
        setLoading(true);
        setTimeout(scrollToBottom, 50);

        try {
            const res = await fetch(`${API}/api/agents/agent_pm/message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: text,
                    sender: 'daren',
                    history: messages.slice(-10).map(m => ({
                        role: m.sender === 'You' ? 'user' : 'assistant',
                        content: m.text,
                    })),
                }),
            });
            const data = await res.json();
            setMessages(prev => [...prev, {
                sender: 'Path',
                text: data.reply || '(no response)',
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            }]);
        } catch {
            setMessages(prev => [...prev, { sender: 'System', text: 'Failed to reach bot manager.' }]);
        } finally {
            setLoading(false);
            setTimeout(scrollToBottom, 50);
        }
    };

    const clearHistory = () => {
        const fresh = [{ sender: 'System', text: 'New conversation started.', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }];
        setMessages(fresh);
    };

    return (
        <div style={{
            position: 'absolute', right: 20, bottom: 20, width: 320, height: 420,
            background: 'rgba(13,13,8,0.92)',
            border: `2px solid ${pip.amberFaint}`,
            borderRadius: 0,
            display: 'flex', flexDirection: 'column',
            zIndex: 10, pointerEvents: 'auto',
            fontFamily: pip.font,
        }}>
            <div style={{
                padding: '10px 14px',
                borderBottom: `2px solid ${pip.amberFaint}`,
                fontSize: 14, fontWeight: 700, color: pip.amber,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                letterSpacing: 2,
                textShadow: glowText(pip.amber),
            }}>
                <span>OFFICE CHAT</span>
                <button onClick={clearHistory} title="New conversation" style={{
                    background: 'none', border: `1px solid ${pip.amberGhost}`,
                    color: pip.amberDim, cursor: 'pointer', fontSize: 10,
                    fontFamily: pip.font, fontWeight: 600, padding: '2px 6px',
                    borderRadius: 0, letterSpacing: 1,
                }}>NEW</button>
            </div>

            <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
                {messages.map((m, i) => (
                    <div key={i} style={{
                        marginBottom: 8,
                        textAlign: m.sender === 'You' ? 'right' : 'left',
                    }}>
                        <span style={{
                            display: 'inline-block',
                            background: m.sender === 'You' ? pip.amberGhost : pip.bgInset,
                            border: `1px solid ${m.sender === 'You' ? pip.amberFaint : pip.amberGhost}`,
                            color: pip.amberDim, fontSize: 12, padding: '6px 10px',
                            borderRadius: 0, maxWidth: '85%', textAlign: 'left',
                            wordBreak: 'break-word', whiteSpace: 'pre-wrap',
                        }}>
                            {m.sender !== 'You' && (
                                <div style={{
                                    fontSize: 10, marginBottom: 2, fontWeight: 700,
                                    letterSpacing: 1,
                                    color: m.sender === 'System' ? pip.amber : pip.green,
                                }}>
                                    {m.sender.toUpperCase()} {m.time && <span style={{ color: pip.amberFaint, fontWeight: 400 }}>{m.time}</span>}
                                </div>
                            )}
                            {m.text}
                        </span>
                    </div>
                ))}
                {loading && (
                    <div style={{ color: pip.amberFaint, fontSize: 11, fontStyle: 'italic' }}>
                        Path is thinking...
                    </div>
                )}
            </div>

            <div style={{ padding: 8, borderTop: `2px solid ${pip.amberFaint}`, display: 'flex', gap: 6 }}>
                <input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendMessage()}
                    placeholder="Talk to Path..."
                    disabled={loading}
                    style={{
                        flex: 1, padding: '6px 10px', fontSize: 12,
                        background: pip.bgInset, border: `1px solid ${pip.amberFaint}`,
                        borderRadius: 0, color: pip.amber, outline: 'none',
                        fontFamily: pip.font,
                    }}
                />
                <button
                    onClick={sendMessage}
                    disabled={loading}
                    style={{
                        padding: '6px 12px', fontSize: 12, fontWeight: 700,
                        background: pip.amberGhost, border: `2px solid ${pip.amber}`,
                        borderRadius: 0, color: pip.amber, cursor: 'pointer',
                        fontFamily: pip.font, letterSpacing: 1,
                    }}
                >
                    SEND
                </button>
            </div>
        </div>
    );
}
