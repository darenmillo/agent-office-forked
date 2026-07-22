/** rc-audit rows 42/43 — the slim threat rail.
 *
 *  Below the compact threshold the full Zone07 card can't fit, but the
 *  audit's law is "threat NEVER fully drops": this one-line strip carries
 *  the primary threat, its likely next items (real predicted_build data or
 *  nothing), and the intel age. Also the threat surface in stack mode.
 */
import React from 'react';
import { console_ } from '../../raijinTheme';
import { EnemyIntelData } from '../../raijinTypes';
import { likelyNextLine } from '../../console';

interface Props {
    enemyIntel: EnemyIntelData | null;
    myTeam: string | null;
    enemyHeroNames: string[];
    intelReceivedAt: number | null;
    nowMs: number;
}

const label: React.CSSProperties = {
    fontSize: 10, letterSpacing: '.22em', color: console_.chrome, flex: 'none',
};

export function ThreatRail({ enemyIntel, myTeam, enemyHeroNames, intelReceivedAt, nowMs }: Props) {
    const enemies = (enemyIntel?.players ?? []).filter(
        p => myTeam && p.team && p.team.toLowerCase() !== myTeam.toLowerCase(),
    );
    const threat = enemies.length
        ? enemies.reduce((a, b) => (b.net_worth > a.net_worth ? b : a))
        : null;
    const threatLabel = threat
        ? threat.hero_name.replace(/^npc_dota_hero_/, '').replace(/_/g, ' ').toUpperCase()
        : null;
    const nextLine = threat ? likelyNextLine(threat.predicted_build) : null;
    const ageS = intelReceivedAt !== null ? Math.round((nowMs - intelReceivedAt) / 1000) : null;

    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 14, minWidth: 0,
            borderBottom: `1px solid ${console_.line}`,
            background: console_.base2, padding: '7px 16px',
            fontFamily: console_.mono, fontVariantNumeric: 'tabular-nums',
        }}>
            <span style={label}>07 · THREAT</span>
            {threat ? (
                <>
                    <span style={{
                        fontSize: 12, letterSpacing: '.08em', color: console_.ink,
                        fontWeight: 700, whiteSpace: 'nowrap', flex: 'none',
                    }}>
                        {threatLabel}
                        <span style={{ color: console_.dire, marginLeft: 8 }}>
                            {(threat.net_worth / 1000).toFixed(1)}k
                        </span>
                    </span>
                    {nextLine && (
                        <span style={{
                            fontSize: 11, color: console_.muted, overflow: 'hidden',
                            textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0,
                        }}>
                            {nextLine}
                        </span>
                    )}
                    {ageS !== null && (
                        <span style={{ ...label, marginLeft: 'auto', color: ageS > 60 ? console_.dire : console_.chrome }}>
                            INTEL {ageS}s
                        </span>
                    )}
                </>
            ) : (
                <span style={{ fontSize: 11, color: console_.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {enemyHeroNames.length
                        ? `${enemyHeroNames.length} KNOWN — AWAITING INTEL`
                        : 'NO ENEMY INTEL YET'}
                </span>
            )}
        </div>
    );
}
