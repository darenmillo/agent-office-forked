import React, { useState, useEffect } from 'react';
import { eventBus } from '../events';
import { agentName, AGENT_NAMES, API } from '../agentNames';
import { pip, glowText } from '../raijinTheme';

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

    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail?.agentId) {
                const id = detail.agentId.replace(/-/g, '_');
                setAgentId(id);
            }
        };
        eventBus.addEventListener('agent-focus', handler);
        return () => eventBus.removeEventListener('agent-focus', handler);
    }, []);

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

    const statusColor = agent.status === 'working' ? pip.amber
        : agent.status === 'online' ? pip.green
        : agent.status === 'error' ? pip.red
        : pip.amberDim;

    return (
        <div style={{
            position: 'absolute', left: 56, bottom: 20, width: 280,
            background: 'rgba(13,13,8,0.92)',
            border: `2px solid ${pip.amberFaint}`,
            borderRadius: 0,
            padding: 14, zIndex: 10, pointerEvents: 'auto',
            fontFamily: pip.font,
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{
                    margin: 0, fontSize: 15, fontWeight: 700,
                    color: pip.amber, letterSpacing: 1,
                    textShadow: glowText(pip.amber),
                }}>
                    {agentName(agentId)}
                </h3>
                <button onClick={() => setAgentId(null)} style={{
                    background: 'none', border: `1px solid ${pip.amberGhost}`,
                    color: pip.amberDim, cursor: 'pointer', fontSize: 12,
                    fontFamily: pip.font, borderRadius: 0, padding: '1px 5px',
                }}>X</button>
            </div>

            <div style={{ fontSize: 11, color: pip.amberDim, marginTop: 4, fontStyle: 'italic' }}>
                {AGENT_TAGLINES[agentId] || ''}
            </div>

            <div style={{ marginTop: 10, fontSize: 12 }}>
                <div style={{ color: pip.amberDim, marginBottom: 4 }}>
                    <span style={{
                        display: 'inline-block', width: 8, height: 8,
                        background: statusColor, marginRight: 6,
                        boxShadow: `0 0 4px ${statusColor}`,
                    }} />
                    {agent.status.toUpperCase()} {'\u00B7'} {agent.team}
                </div>
            </div>

            {memories.length > 0 && (
                <div style={{ marginTop: 10 }}>
                    <div style={{
                        fontSize: 11, color: pip.amber, fontWeight: 700,
                        marginBottom: 4, letterSpacing: 1,
                    }}>
                        MEMORIES
                    </div>
                    {memories.slice(0, 3).map((m, i) => (
                        <div key={i} style={{
                            fontSize: 10, color: pip.amberDim, marginBottom: 4, lineHeight: 1.4,
                            borderLeft: `2px solid ${pip.amberFaint}`, paddingLeft: 6,
                        }}>
                            {m.content.slice(0, 120)}{m.content.length > 120 ? '...' : ''}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
