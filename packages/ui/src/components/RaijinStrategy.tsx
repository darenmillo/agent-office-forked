import React, { useState } from 'react';
import { Recommendation } from '../raijinTypes';
import { pip, panelBase, labelStyle, glowText } from '../raijinTheme';

interface Props {
    recommendations: Recommendation[];
}

/** Category accent mapping */
const CAT_ACCENT: Record<string, string> = {
    coach: pip.catCoach,
    items: pip.catItem,
    timers: pip.catTimer,
    fight: pip.catFight,
    recent: pip.catRecent,
};

export function RaijinStrategy({ recommendations }: Props) {
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
    const toggle = (key: string) => setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));

    const general = recommendations.filter(r => r.tier === 'ANALYTICAL');
    const timers = recommendations.filter(r => r.category === 'TIMER');
    const items = recommendations.filter(r => r.category === 'ITEM');
    const fight = recommendations.filter(r => r.category === 'FIGHT');
    // All non-LLM GENERAL recs: gold warnings, CS checks, buyback, ult ready, game flow, etc.
    const coaching = recommendations.filter(r =>
        r.category === 'GENERAL' && r.tier !== 'ANALYTICAL'
    );
    // Separate knowledge (patch tips, hero playstyle) from active coaching
    const knowledge = coaching.filter(r =>
        r.title.includes('7.41') || r.title.includes('How to play') || r.title.includes('When to fight')
    );
    const activeCoaching = coaching.filter(r =>
        !r.title.includes('7.41') && !r.title.includes('How to play') && !r.title.includes('When to fight')
    );

    return (
        <div style={{ ...panelBase, overflowY: 'auto' }}>
            <h3 style={{
                margin: '0 0 12px',
                fontSize: pip.textLg,
                color: pip.amber,
                fontWeight: 700,
                fontFamily: pip.font,
                letterSpacing: 3,
                textTransform: 'uppercase',
                textShadow: glowText(pip.amber),
                borderBottom: `2px solid ${pip.amberFaint}`,
                paddingBottom: pip.sp2,
            }}>
                STRATEGY
            </h3>

            {/* FIGHT + ENEMY PREDICTIONS — most time-sensitive */}
            <Section
                title="ENEMY INTEL"
                count={fight.length}
                collapsed={collapsed['fight']}
                onToggle={() => toggle('fight')}
                accent={CAT_ACCENT.fight}
            >
                {fight.length === 0 ? (
                    <EmptyHint>Enemy predictions + fight targets appear once enemies are set.</EmptyHint>
                ) : (
                    fight.slice(0, 5).map((rec, i) => (
                        <RecCard key={i} rec={rec} accent={CAT_ACCENT.fight} />
                    ))
                )}
            </Section>

            {/* ACTIVE COACHING — gold, CS, buyback, ult ready, game flow */}
            {activeCoaching.length > 0 && (
                <Section
                    title="COACHING"
                    count={activeCoaching.length}
                    collapsed={collapsed['coaching']}
                    onToggle={() => toggle('coaching')}
                    accent={pip.amberBright}
                >
                    {activeCoaching.slice(0, 5).map((rec, i) => (
                        <RecCard key={i} rec={rec} accent={pip.amberBright} />
                    ))}
                </Section>
            )}

            {/* ITEM ADVICE — actionable */}
            <Section
                title="ITEM ADVICE"
                count={items.length}
                collapsed={collapsed['items']}
                onToggle={() => toggle('items')}
                accent={CAT_ACCENT.items}
            >
                {items.length === 0 ? (
                    <EmptyHint>Item suggestions will appear based on enemy lineup.</EmptyHint>
                ) : (
                    items.slice(0, 5).map((rec, i) => (
                        <RecCard key={i} rec={rec} accent={CAT_ACCENT.items} />
                    ))
                )}
            </Section>

            {/* RAIJIN SAYS — LLM coaching, limited to 2 to not dominate */}
            <Section
                title="RAIJIN SAYS"
                count={general.length}
                collapsed={collapsed['general']}
                onToggle={() => toggle('general')}
                accent={CAT_ACCENT.coach}
            >
                {general.length === 0 ? (
                    <EmptyHint>Coaching advice appears at milestones + on death.</EmptyHint>
                ) : (
                    general.slice(0, 2).map((rec, i) => (
                        <RecCard key={i} rec={rec} accent={CAT_ACCENT.coach} />
                    ))
                )}
            </Section>

            {/* KNOWLEDGE — patch tips, hero playstyle, tower state */}
            {knowledge.length > 0 && (
                <Section
                    title="GAME INTEL"
                    count={knowledge.length}
                    collapsed={collapsed['knowledge']}
                    onToggle={() => toggle('knowledge')}
                    accent={pip.amberBright}
                >
                    {knowledge.slice(0, 4).map((rec, i) => (
                        <RecCard key={i} rec={rec} accent={pip.amberBright} />
                    ))}
                </Section>
            )}

            {/* TIMERS — least urgent, at bottom */}
            <Section
                title="TIMERS"
                count={timers.length}
                collapsed={collapsed['timers'] ?? true}
                onToggle={() => toggle('timers')}
                accent={CAT_ACCENT.timers}
            >
                {timers.length === 0 ? (
                    <EmptyHint>Stack, rune, and Roshan timers.</EmptyHint>
                ) : (
                    timers.slice(0, 4).map((rec, i) => (
                        <RecCard key={i} rec={rec} accent={CAT_ACCENT.timers} />
                    ))
                )}
            </Section>
        </div>
    );
}

/* ── Collapsible Section ── */
function Section({ title, count, collapsed, onToggle, accent, children }: {
    title: string; count: number; collapsed?: boolean;
    onToggle: () => void; accent: string; children: React.ReactNode;
}) {
    return (
        <div style={{ marginBottom: pip.sp4 }}>
            <div
                onClick={onToggle}
                style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    cursor: 'pointer',
                    padding: `${pip.sp1}px 0`,
                    borderBottom: `1px solid ${pip.amberGhost}`,
                    marginBottom: pip.sp2,
                    transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = pip.bgHover; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
                <span style={{
                    fontSize: pip.textBase,
                    fontWeight: 700,
                    color: accent,
                    fontFamily: pip.font,
                    letterSpacing: 1,
                }}>
                    {collapsed ? '\u25B6' : '\u25BC'} {title}
                </span>
                {count > 0 && (
                    <span style={{
                        fontSize: pip.textSm,
                        color: pip.amberDim,
                        fontFamily: pip.font,
                        fontWeight: 600,
                    }}>
                        ({count})
                    </span>
                )}
            </div>
            {!collapsed && children}
        </div>
    );
}

/* ── Recommendation Card ── */
function RecCard({ rec, accent }: { rec: Recommendation; accent: string }) {
    const isUrgent = rec.priority >= 4;
    return (
        <div style={{
            borderLeft: `3px solid ${accent}`,
            padding: `${pip.sp2}px ${pip.sp3}px`,
            marginBottom: pip.sp2,
            background: isUrgent ? pip.bgHover : pip.bgInset,
        }}>
            <div style={{
                fontSize: pip.textBase,
                fontWeight: 700,
                color: isUrgent ? pip.amber : pip.amberDim,
                fontFamily: pip.font,
            }}>
                {rec.title}
            </div>
            <div style={{
                fontSize: pip.textBase,
                color: pip.amberDim,
                fontFamily: pip.font,
                marginTop: pip.sp1,
                lineHeight: 1.5,
                opacity: 0.85,
            }}>
                {rec.body}
            </div>
        </div>
    );
}

/* ── Empty state hint ── */
function EmptyHint({ children }: { children: React.ReactNode }) {
    return (
        <div style={{
            fontSize: pip.textBase,
            color: pip.amberGhost,
            fontFamily: pip.font,
            fontStyle: 'italic',
            padding: `${pip.sp1}px 0`,
        }}>
            {children}
        </div>
    );
}
