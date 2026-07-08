/** BriefingRoom (Phase 1, #8) — the queue-time surface.
 *
 * Replaces the dead pre-game wall: while the engine is ready but no hero is
 * live, this frame surfaces (a) your leak profile (the personal-patterns
 * miner finally gets a UI), (b) the enemy dossier once enemies are known,
 * and (c) a queue checklist that routes to SCOUTING.
 *
 * SKIN-AGNOSTIC by design (owner decision: B spine, A dossier as an option):
 * the layout is one component; `skin` swaps the token set — 'broadcast'
 * (Direction B) or 'dossier' (Direction A MATCH DOSSIER, amber terminal).
 * Data honesty: every slot renders a real empty state when its feed hasn't
 * landed — nothing is fabricated.
 */
import React, { useEffect, useState } from 'react';
import { RAIJIN_API } from '../raijinTypes';
import { bcast, pip } from '../raijinTheme';

interface Props {
    visible: boolean;
    onOpenScouting: () => void;
}

interface SkinTokens {
    font: string;
    display: string;
    panelBg: string;
    panelBorder: string;
    ink: string;
    muted: string;
    accent: string;
    radius: number;
}

const SKINS: Record<'broadcast' | 'dossier', SkinTokens> = {
    broadcast: {
        font: bcast.body,
        display: bcast.display,
        panelBg: bcast.panel,
        panelBorder: bcast.line,
        ink: bcast.ink,
        muted: bcast.muted,
        accent: bcast.gold,
        radius: bcast.r,
    },
    dossier: {
        font: pip.font,
        display: pip.font,
        panelBg: pip.bgPanel,
        panelBorder: pip.amberFaint,
        ink: pip.amberBright,
        muted: pip.amber,
        accent: pip.amberBright,
        radius: 0,
    },
};

interface LeakProfile {
    headline?: string;
    patterns?: string[];
}

export function RaijinBriefingRoom({ visible, onOpenScouting }: Props) {
    const [skin, setSkin] = useState<'broadcast' | 'dossier'>(() =>
        localStorage.getItem('raijin-briefing-skin') === 'dossier' ? 'dossier' : 'broadcast');
    const [leaks, setLeaks] = useState<LeakProfile | null>(null);
    const [leaksTried, setLeaksTried] = useState(false);

    useEffect(() => {
        if (!visible) return;
        let cancelled = false;
        // Personal-patterns miner output — graceful empty state if the engine
        // doesn't expose it yet (the miner writes data/raijin/personal/).
        fetch(`${RAIJIN_API}/api/personal-patterns`)
            .then(r => (r.ok ? r.json() : null))
            .then(d => {
                if (cancelled) return;
                if (d && (d.headline || d.patterns?.length)) {
                    setLeaks({ headline: d.headline, patterns: d.patterns });
                }
            })
            .catch(() => { /* endpoint absent — honest empty state below */ })
            .finally(() => { if (!cancelled) setLeaksTried(true); });
        return () => { cancelled = true; };
    }, [visible]);

    if (!visible) return null;
    const t = SKINS[skin];

    const card: React.CSSProperties = {
        background: t.panelBg,
        border: `1px solid ${t.panelBorder}`,
        borderRadius: t.radius,
        padding: 16,
        fontFamily: t.font,
        minWidth: 0,
    };
    const label: React.CSSProperties = {
        fontSize: 12,
        letterSpacing: '.16em',
        textTransform: 'uppercase',
        color: t.muted,
        fontWeight: 600,
        marginBottom: 8,
    };

    return (
        <section
            aria-label="Briefing room (queue prep)"
            style={{
                gridColumn: '1 / -1',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: 12,
                fontFamily: t.font,
            }}
        >
            <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'baseline', gap: 12 }}>
                <h2 style={{
                    margin: 0,
                    fontFamily: t.display,
                    fontSize: 26,
                    fontWeight: 700,
                    color: t.ink,
                    letterSpacing: skin === 'dossier' ? '.08em' : '.01em',
                }}>
                    {skin === 'dossier' ? 'MATCH DOSSIER' : 'Briefing room'}
                </h2>
                <span style={{ fontSize: 14, color: t.muted }}>
                    engine ready — waiting for a game
                </span>
                <span style={{ flex: 1 }} />
                <button
                    onClick={() => {
                        const next = skin === 'broadcast' ? 'dossier' : 'broadcast';
                        setSkin(next);
                        localStorage.setItem('raijin-briefing-skin', next);
                    }}
                    aria-label="Toggle briefing skin"
                    style={{
                        background: 'transparent',
                        border: `1px solid ${t.panelBorder}`,
                        borderRadius: t.radius || 6,
                        color: t.muted,
                        padding: '4px 10px',
                        fontFamily: t.font,
                        fontSize: 12,
                        cursor: 'pointer',
                    }}
                >
                    SKIN: {skin === 'broadcast' ? 'BROADCAST' : 'DOSSIER'}
                </button>
            </div>

            {/* Your leak profile — the patterns miner gets a UI */}
            <div style={card}>
                <div style={label}>Your leak profile</div>
                {leaks?.patterns?.length ? (
                    <>
                        {leaks.headline && (
                            <div style={{ fontSize: 17, color: t.ink, fontWeight: 600, marginBottom: 8, lineHeight: 1.35 }}>
                                {leaks.headline}
                            </div>
                        )}
                        {leaks.patterns.slice(0, 4).map((p, i) => (
                            <div key={i} style={{ fontSize: 15, color: t.muted, lineHeight: 1.5 }}>• {p}</div>
                        ))}
                    </>
                ) : (
                    <div style={{ fontSize: 15, color: t.muted, lineHeight: 1.5 }}>
                        {leaksTried
                            ? 'No mined profile exposed by the engine yet — run /raijin-retro to refresh personal patterns.'
                            : 'Loading your mined patterns…'}
                    </div>
                )}
            </div>

            {/* Enemy dossier — fills from scouting/draft once enemies are known */}
            <div style={card}>
                <div style={label}>Enemy dossier</div>
                <div style={{ fontSize: 15, color: t.muted, lineHeight: 1.5 }}>
                    Threat cards build here as enemies are known (draft, bot, or scouting).
                    In pubs the draft rarely auto-fills —
                </div>
                <button
                    onClick={onOpenScouting}
                    style={{
                        marginTop: 10,
                        background: 'transparent',
                        border: `1px solid ${t.accent}`,
                        borderRadius: t.radius || 6,
                        color: t.accent,
                        padding: '7px 14px',
                        fontFamily: t.font,
                        fontSize: 13,
                        fontWeight: 700,
                        letterSpacing: '.06em',
                        cursor: 'pointer',
                    }}
                >
                    ▸ OPEN SCOUTING
                </button>
            </div>

            {/* Queue checklist — turns the 0:00 burst wall into a ritual */}
            <div style={card}>
                <div style={label}>Queue checklist</div>
                {[
                    'Set your role (top right) so the right surfaces lead',
                    'Voice on? Alt+M toggles the in-ear coach',
                    'Scout enemies the moment the draft shows',
                ].map((line, i) => (
                    <div key={i} style={{ fontSize: 15, color: t.ink, lineHeight: 1.7 }}>
                        <span style={{ color: t.accent, fontWeight: 700 }}>{i + 1}.</span> {line}
                    </div>
                ))}
            </div>
        </section>
    );
}
