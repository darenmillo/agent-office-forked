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
    /** Last known player team (radiant/dire) — gates the dossier's enemy
     *  filter. null = unknown → show NO enemies (never mixed teams). */
    myTeam?: string | null;
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

interface Claim { id: string; effect: string; n: number; tier?: string }
interface LeakProfile {
    headline?: string;
    patterns?: string[];
    matches?: number;
}

export function RaijinBriefingRoom({ visible, onOpenScouting, myTeam = null }: Props) {
    const [skin, setSkin] = useState<'broadcast' | 'dossier'>(() =>
        localStorage.getItem('raijin-briefing-skin') === 'dossier' ? 'dossier' : 'broadcast');
    const [leaks, setLeaks] = useState<LeakProfile | null>(null);
    const [leaksTried, setLeaksTried] = useState(false);
    const [enemies, setEnemies] = useState<string[]>([]);

    useEffect(() => {
        if (!visible) return;
        let cancelled = false;
        // v2 confidence-gated profile: CONFIRMED claims only reach the UI as
        // leaks (a wrong confident read tilts). Honest empty state when no mine.
        fetch(`${RAIJIN_API}/api/personal-patterns`)
            .then(r => (r.ok ? r.json() : null))
            .then(d => {
                if (cancelled) return;
                const confirmed: Claim[] = (d?.confirmed || []).filter((c: Claim) => !c.id?.startsWith('role_'));
                const role: Claim | undefined = (d?.confirmed || []).find((c: Claim) => c.id?.startsWith('role_'));
                if (confirmed.length || role) {
                    const tv = d?.trade_verdict_distribution;
                    const headline = tv?.caught_share != null
                        ? `${Math.round(tv.caught_share * 100)}% of your deaths were caught out of position`
                        : role?.effect;
                    setLeaks({
                        headline,
                        patterns: confirmed.slice(0, 4).map(c => `${c.effect}  (n=${c.n})`),
                        matches: d?.matches_analyzed,
                    });
                }
            })
            .catch(() => { /* honest empty state below */ })
            .finally(() => { if (!cancelled) setLeaksTried(true); });
        // Known enemies for a real dossier (no fabrication — names only until
        // scouted). Review P1: /api/enemy-intel returns ALL TEN players — the
        // old unfiltered map listed the player's own team (and own hero) as
        // "known enemies". Filter to the opposing team; unknown team → none.
        fetch(`${RAIJIN_API}/api/enemy-intel`)
            .then(r => (r.ok ? r.json() : null))
            .then(d => {
                if (cancelled) return;
                const mine = (myTeam || '').toLowerCase();
                const players: Array<{ hero_name?: string; hero?: string; team?: string | number }> =
                    d?.players || d?.enemies || [];
                const names: string[] = players
                    .filter(p => {
                        if (!mine) return false; // team unknown → never guess
                        const t = String(p.team ?? '').toLowerCase();
                        // team arrives as radiant/dire or Valve's 2/3
                        const norm = t === '2' ? 'radiant' : t === '3' ? 'dire' : t;
                        return norm !== '' && norm !== mine;
                    })
                    .map(p => p.hero_name || p.hero || '')
                    .filter(Boolean);
                setEnemies(names);
            })
            .catch(() => { /* none known yet */ });
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

            {/* Your leak profile — v2 CONFIRMED claims (evidence-gated) */}
            <div style={card}>
                <div style={label}>
                    Your CONFIRMED leaks{leaks?.matches ? ` · ${leaks.matches} games` : ''}
                </div>
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
                            ? 'No CONFIRMED profile yet — run /raijin-retro (needs enough games to graduate a claim).'
                            : 'Loading your mined patterns…'}
                    </div>
                )}
            </div>

            {/* Enemy dossier — real known enemies, no fabricated threat reads */}
            <div style={card}>
                <div style={label}>Enemy dossier{enemies.length ? ` · ${enemies.length} known` : ''}</div>
                {enemies.length ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                        {enemies.map((name, i) => (
                            <span key={i} style={{
                                fontSize: 14, color: t.ink, background: 'transparent',
                                border: `1px solid ${t.panelBorder}`, borderRadius: t.radius || 6,
                                padding: '3px 9px', fontWeight: 600,
                            }}>
                                {name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                            </span>
                        ))}
                    </div>
                ) : (
                    <div style={{ fontSize: 15, color: t.muted, lineHeight: 1.5 }}>
                        No enemies known yet. In pubs the draft rarely auto-fills —
                        scout them the moment the loadout screen shows.
                    </div>
                )}
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
                    ▸ {enemies.length ? 'REFINE SCOUTING' : 'OPEN SCOUTING'}
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
