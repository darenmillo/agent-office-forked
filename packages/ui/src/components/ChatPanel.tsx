import React, { useState, useRef, useEffect } from 'react';
import { API } from '../agentNames';

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
        // Keep last 100 messages to avoid bloating localStorage
        localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-100)));
    } catch { /* full storage */ }
}

export function ChatPanel() {
    const [messages, setMessages] = useState<Message[]>(loadHistory);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Persist messages to localStorage on change
    useEffect(() => { saveHistory(messages); }, [messages]);

    const scrollToBottom = () => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    };

    // Auto-scroll on mount
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
            background: 'rgba(10,10,30,0.92)', borderRadius: 12,
            border: '1px solid rgba(108,92,231,0.3)',
            display: 'flex', flexDirection: 'column',
            zIndex: 10, pointerEvents: 'auto',
        }}>
            <div style={{
                padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.1)',
                fontSize: 14, fontWeight: 600, color: '#dfe6e9',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
                <span>💬 Office Chat</span>
                <button onClick={clearHistory} title="New conversation" style={{
                    background: 'none', border: 'none', color: '#636e72', cursor: 'pointer', fontSize: 11,
                }}>New Thread</button>
            </div>

            <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
                {messages.map((m, i) => (
                    <div key={i} style={{
                        marginBottom: 8,
                        textAlign: m.sender === 'You' ? 'right' : 'left',
                    }}>
                        <span style={{
                            display: 'inline-block',
                            background: m.sender === 'You' ? 'rgba(108,92,231,0.4)' : 'rgba(255,255,255,0.08)',
                            color: '#dfe6e9', fontSize: 12, padding: '6px 10px',
                            borderRadius: 8, maxWidth: '85%', textAlign: 'left',
                            wordBreak: 'break-word', whiteSpace: 'pre-wrap',
                        }}>
                            {m.sender !== 'You' && (
                                <div style={{ fontSize: 10, color: m.sender === 'System' ? '#fdcb6e' : '#6c5ce7', marginBottom: 2, fontWeight: 600 }}>
                                    {m.sender} {m.time && <span style={{ color: '#636e72', fontWeight: 400 }}>{m.time}</span>}
                                </div>
                            )}
                            {m.text}
                        </span>
                    </div>
                ))}
                {loading && (
                    <div style={{ color: '#b2bec3', fontSize: 11, fontStyle: 'italic' }}>
                        Path is thinking...
                    </div>
                )}
            </div>

            <div style={{ padding: 8, borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', gap: 6 }}>
                <input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendMessage()}
                    placeholder="Talk to Path..."
                    disabled={loading}
                    style={{
                        flex: 1, padding: '6px 10px', fontSize: 12,
                        background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: 6, color: '#dfe6e9', outline: 'none',
                    }}
                />
                <button
                    onClick={sendMessage}
                    disabled={loading}
                    style={{
                        padding: '6px 12px', fontSize: 12, fontWeight: 600,
                        background: '#6c5ce7', border: 'none', borderRadius: 6,
                        color: '#fff', cursor: 'pointer',
                    }}
                >
                    Send
                </button>
            </div>
        </div>
    );
}
