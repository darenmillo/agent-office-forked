import React, { useState, useEffect } from 'react';
import { eventBus } from '../events';
import { agentName, AGENT_NAMES, API } from '../agentNames';

interface AgentData {
    id: string;
    display_name: string;
    team: string;
    status: string;
    current_task_id: string | null;
}

interface Memory {
    content: string;
    created_at: number;
}

const AGENT_TAGLINES: Record<string, string> = {
    'agent_pm': 'Squad coordinator. Finds the optimal route.',
    'agent_dev': 'Patches everyone up. Writes the fixes.',
    'agent_qa': 'If it hasn\'t been verified, it hasn\'t been tested.',
    'agent_researcher': 'Grand Magus of research. Studies everything.',
    'agent_analyst': 'Backed by data, never by vibes.',
    'agent_skeptic': 'Every assumption can be questioned.',
    'agent_writer': 'Precise, elegant, hits the target every time.',
    'agent_collector': 'Collects every data point, clinical about it.',
    'agent_librarian': 'Organizes the stacks, maintains the flame.',
    'agent_habits': 'Tracks momentum. Just a wee pick-me-up.',
    'agent_voice': 'Voice-first robot. (V2 placeholder)',
    'agent_cryptobro': 'Untouchable. He is who he is.',
};

export function AgentInspector() {
    const [agentId, setAgentId] = useState<string | null>(null);
    const [agent, setAgent] = useState<AgentData | null>(null);
    const [memories, setMemories] = useState<Memory[]>([]);

    // Listen for agent clicks from the Phaser game
    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail?.agentId) {
                // Convert hyphen format (from Colyseus) to underscore (our DB format)
                const id = detail.agentId.replace(/-/g, '_');
                setAgentId(id);
            }
        };
        eventBus.addEventListener('agent-focus', handler);
        return () => eventBus.removeEventListener('agent-focus', handler);
    }, []);

    // Fetch agent data + memories when selected
    useEffect(() => {
        if (!agentId) return;

        const fetchData = async () => {
            try {
                const [agentsRes, memRes] = await Promise.all([
                    fetch(`${API}/api/agents`),
                    fetch(`${API}/api/agents/${agentId}/memories`),
                ]);
                const agentsData = await agentsRes.json();
                const memData = await memRes.json();

                const found = (agentsData.agents || []).find((a: AgentData) => a.id === agentId);
                setAgent(found || null);
                setMemories(memData.memories || []);
            } catch { /* offline */ }
        };
        fetchData();
    }, [agentId]);

    if (!agentId || !agent) return null;

    const statusColor = agent.status === 'working' ? '#fdcb6e'
        : agent.status === 'online' ? '#00b894'
        : agent.status === 'error' ? '#d63031'
        : '#b2bec3';

    return (
        <div style={{
            position: 'absolute', left: 20, bottom: 20, width: 280,
            background: 'rgba(10,10,30,0.92)', borderRadius: 12,
            border: '1px solid rgba(108,92,231,0.3)',
            padding: 14, zIndex: 10, pointerEvents: 'auto',
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: 15, color: '#dfe6e9' }}>
                    {agentName(agentId)}
                </h3>
                <button onClick={() => setAgentId(null)} style={{
                    background: 'none', border: 'none', color: '#b2bec3', cursor: 'pointer', fontSize: 14,
                }}>✕</button>
            </div>

            <div style={{ fontSize: 11, color: '#b2bec3', marginTop: 4, fontStyle: 'italic' }}>
                {AGENT_TAGLINES[agentId] || ''}
            </div>

            <div style={{ marginTop: 10, fontSize: 12 }}>
                <div style={{ color: '#b2bec3', marginBottom: 4 }}>
                    <span style={{
                        display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                        background: statusColor, marginRight: 6,
                    }} />
                    {agent.status} · {agent.team}
                </div>
            </div>

            {memories.length > 0 && (
                <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 11, color: '#6c5ce7', fontWeight: 600, marginBottom: 4 }}>
                        🧠 Memories
                    </div>
                    {memories.slice(0, 3).map((m, i) => (
                        <div key={i} style={{
                            fontSize: 10, color: '#b2bec3', marginBottom: 4, lineHeight: 1.4,
                            borderLeft: '2px solid rgba(108,92,231,0.3)', paddingLeft: 6,
                        }}>
                            {m.content.slice(0, 120)}{m.content.length > 120 ? '...' : ''}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
