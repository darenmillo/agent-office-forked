import React, { useState } from 'react';
import { Recommendation } from '../raijinTypes';

interface Props {
    recommendations: Recommendation[];
}

export function RaijinStrategy({ recommendations }: Props) {
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

    const toggle = (key: string) => setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));

    // Split recommendations by type
    const general = recommendations.filter(r => r.tier === 'ANALYTICAL');
    const timers = recommendations.filter(r => r.category === 'TIMER');
    const items = recommendations.filter(r => r.category === 'ITEM');
    const fight = recommendations.filter(r => r.category === 'FIGHT');

    return (
        <div style={panelStyle}>
            <h3 style={{ margin: '0 0 14px', fontSize: 20, color: '#b0bec5', fontWeight: 700 }}>
                Strategy
            </h3>

            {/* LLM Coaching Advice */}
            <Section
                title="Raijin Says"
                count={general.length}
                collapsed={collapsed['general']}
                onToggle={() => toggle('general')}
            >
                {general.length === 0 ? (
                    <div style={{ fontSize: 14, color: '#636e72' }}>
                        Coaching advice appears here during the game...
                    </div>
                ) : (
                    general.slice(0, 5).map((rec, i) => (
                        <RecCard key={i} rec={rec} accent="#5c6bc0" />
                    ))
                )}
            </Section>

            {/* Item Advice */}
            <Section
                title="Item Advice"
                count={items.length}
                collapsed={collapsed['items']}
                onToggle={() => toggle('items')}
            >
                {items.length === 0 ? (
                    <div style={{ fontSize: 14, color: '#636e72' }}>
                        Item suggestions will appear based on enemy lineup.
                    </div>
                ) : (
                    items.slice(0, 6).map((rec, i) => (
                        <RecCard key={i} rec={rec} accent="#fdcb6e" />
                    ))
                )}
            </Section>

            {/* Timers */}
            <Section
                title="Timers"
                count={timers.length}
                collapsed={collapsed['timers']}
                onToggle={() => toggle('timers')}
            >
                {timers.length === 0 ? (
                    <div style={{ fontSize: 14, color: '#636e72' }}>
                        Stack, rune, and Roshan timers will appear here.
                    </div>
                ) : (
                    timers.slice(0, 5).map((rec, i) => (
                        <RecCard key={i} rec={rec} accent="#00b894" />
                    ))
                )}
            </Section>

            {/* Fight Advice */}
            <Section
                title="Fight Targets"
                count={fight.length}
                collapsed={collapsed['fight']}
                onToggle={() => toggle('fight')}
            >
                {fight.length === 0 ? (
                    <div style={{ fontSize: 14, color: '#636e72' }}>
                        Fight prioritization will appear once scouting is loaded.
                    </div>
                ) : (
                    fight.slice(0, 5).map((rec, i) => (
                        <RecCard key={i} rec={rec} accent="#d63031" />
                    ))
                )}
            </Section>

            {/* All recent recommendations log */}
            <Section
                title="Recent"
                count={recommendations.length}
                collapsed={collapsed['recent']}
                onToggle={() => toggle('recent')}
            >
                {recommendations.slice(0, 10).map((rec, i) => (
                    <RecCard key={i} rec={rec} accent="#636e72" />
                ))}
            </Section>
        </div>
    );
}

function Section({ title, count, collapsed, onToggle, children }: {
    title: string; count: number; collapsed?: boolean;
    onToggle: () => void; children: React.ReactNode;
}) {
    return (
        <div style={{ marginBottom: 14 }}>
            <div
                onClick={onToggle}
                style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    cursor: 'pointer', padding: '6px 0', borderBottom: '1px solid rgba(92,107,192,0.2)',
                    marginBottom: 8,
                }}
            >
                <span style={{ fontSize: 16, fontWeight: 600, color: '#b0bec5' }}>{title}</span>
                <span style={{ fontSize: 13, color: '#636e72' }}>
                    {count > 0 && `(${count}) `}{collapsed ? '>' : 'v'}
                </span>
            </div>
            {!collapsed && children}
        </div>
    );
}

function RecCard({ rec, accent }: { rec: Recommendation; accent: string }) {
    const isUrgent = rec.priority >= 4;
    return (
        <div style={{
            borderLeft: `3px solid ${accent}`,
            padding: '6px 10px', marginBottom: 6,
            background: isUrgent ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)',
            borderRadius: '0 6px 6px 0',
        }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#dfe6e9' }}>
                {rec.title}
            </div>
            <div style={{ fontSize: 13, color: '#b2bec3', marginTop: 3, lineHeight: 1.4 }}>
                {rec.body}
            </div>
        </div>
    );
}

const panelStyle: React.CSSProperties = {
    background: 'rgba(10, 15, 40, 0.92)',
    borderRadius: 12,
    border: '1px solid rgba(92, 107, 192, 0.3)',
    padding: 18,
    overflowY: 'auto',
};
