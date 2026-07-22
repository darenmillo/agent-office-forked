/** 07 · PRIMARY THREAT — the enemy that decides your next fight.
 *
 *  Selection: highest net worth on the enemy team (GC intel). The intel-age
 *  stamp is mandatory and computed from the real receive time. The spike
 *  sentence renders ONLY when a matchup/knowledge-tagged rec mentions this
 *  hero — never a canned line.
 *
 *  rc-audit R1 (rows 34/35/36/38 + Stratz leverage §1/§2):
 *  - YOUR LANE 0:00–12:00: pre-lanes-end the zone leads with real lane
 *    matchup rows (win-it-only X% · stomp risk) — then yields to the threat.
 *  - Empty GC item slots collapse to one dim line; the enemy's likely next
 *    purchases render from the high-MMR guide cache (real-or-absent).
 *  - Roster tail: top-2 + '+N MORE'; the MANUAL badge keeps a reserved
 *    corner. */
import React from 'react';
import { console_ } from '../../raijinTheme';
import {
    EnemyIntelData, EnemyPlayerData, EnemySource, Recommendation,
    HERO_ICON_CDN, ITEM_ICON_CDN,
} from '../../raijinTypes';
import {
    fmtMSS, laneHonestLine, laneMatchupRows, laneRowLine, likelyNextLine,
    normalizeDashes, rosterTail, zone07Mode,
} from '../../console';
import { ZoneLabel, tnum } from './shared';

interface Props {
    enemyIntel: EnemyIntelData | null;
    intelReceivedAt: number | null;
    myTeam: string | null;
    enemyHeroNames: string[];
    enemySource: EnemySource;
    onSourceClick: () => void;
    recs: Recommendation[];
    nowMs: number;
    /** rc-audit rows 34/38: extrapolated game clock (s) — gates the lane
     *  card's 0:00–12:00 window. Unwired → lane leads only pre-threat. */
    clock?: number | null;
}

const SOURCE_LABEL: Record<EnemySource, string> = {
    bot: 'BOT ✓',
    gsi_draft: 'GSI DRAFT',
    manual: 'MANUAL',
    minimap: 'MINIMAP',
    capture: 'CAPTURE',
    none: 'UNKNOWN — SET',
};

function displayName(raw: string): string {
    return raw.replace(/^npc_dota_hero_/, '').replace(/_/g, ' ');
}

/** A matchup/knowledge rec that names this hero — the only honest spike line. */
function spikeLineFor(threat: EnemyPlayerData, recs: Recommendation[]): string | null {
    const name = displayName(threat.hero_name).toLowerCase();
    if (!name) return null;
    const rec = recs.find(r =>
        r.tags?.some(t => t === 'matchup' || t === 'knowledge')
        && `${r.title} ${r.reason ?? ''} ${r.body}`.toLowerCase().includes(name),
    );
    if (!rec) return null;
    return rec.reason || rec.body || rec.title;
}

export function Zone07Threat({
    enemyIntel, intelReceivedAt, myTeam, enemyHeroNames,
    enemySource, onSourceClick, recs, nowMs, clock = null,
}: Props) {
    const enemies = (enemyIntel?.players ?? []).filter(
        p => myTeam && p.team && p.team.toLowerCase() !== myTeam.toLowerCase(),
    );
    const threat = enemies.length
        ? enemies.reduce((a, b) => (b.net_worth > a.net_worth ? b : a))
        : null;
    const others = threat
        ? enemies.filter(p => p !== threat).sort((a, b) => b.net_worth - a.net_worth)
        : [];
    const laneRows = laneMatchupRows(enemyIntel?.lane_matchups, enemies, 3);
    const mode = zone07Mode(!!threat, laneRows.length, clock);
    const ageMs = intelReceivedAt !== null ? nowMs - intelReceivedAt : null;
    const ageColor = ageMs === null ? console_.ghost
        : ageMs > 150_000 ? console_.dire
        : ageMs > 60_000 ? console_.amber
        : console_.chrome;
    const spike = threat ? spikeLineFor(threat, recs) : null;
    const likelyNext = threat ? likelyNextLine(threat.predicted_build) : null;
    const honestLane = laneHonestLine(laneRows);

    const sourceBadge = (
        <button
            onClick={onSourceClick}
            aria-label="Enemy intel source — click to set enemies manually"
            title="Enemy intel source — click to set enemies manually"
            style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                fontSize: 10.5, letterSpacing: '.1em', fontFamily: console_.mono,
                color: enemySource === 'none' ? console_.dire : console_.ghost,
                padding: 0, flex: 'none',
            }}
        >
            {SOURCE_LABEL[enemySource]}
        </button>
    );

    return (
        <div style={{ padding: '16px 28px', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <ZoneLabel
                label={mode === 'lane' ? '07 · YOUR LANE — VS THIS LINEUP' : '07 · PRIMARY THREAT'}
                right={
                    <span style={{ fontSize: 10, letterSpacing: '.18em', color: mode === 'lane' ? console_.chrome : ageColor, fontFamily: console_.mono, ...tnum }}>
                        {mode === 'lane' ? 'STRATZ · YOUR BRACKET'
                            : ageMs !== null ? `INTEL ${fmtMSS(ageMs / 1000)} OLD` : 'NO INTEL'}
                    </span>
                }
            />
            {mode === 'lane' ? (
                <>
                    <div style={{ marginTop: 12, fontSize: 10, letterSpacing: '.22em', color: console_.gold, fontFamily: console_.mono }}>
                        0:00–12:00 · WIN YOUR LANE
                    </div>
                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 7 }}>
                        {laneRows.map(row => (
                            <div key={row.heroId} style={{
                                fontSize: 12.5, fontFamily: console_.mono, letterSpacing: '.04em',
                                color: console_.body, whiteSpace: 'nowrap', overflow: 'hidden',
                                textOverflow: 'ellipsis', ...tnum,
                            }}>
                                {laneRowLine(row)}
                            </div>
                        ))}
                    </div>
                    {honestLane && (
                        <div style={{
                            marginTop: 10, paddingTop: 8, borderTop: `1px solid ${console_.line2}`,
                            fontSize: 10.5, letterSpacing: '.14em', color: console_.amber, fontFamily: console_.mono, ...tnum,
                        }}>
                            {honestLane}
                        </div>
                    )}
                    <div style={{ marginTop: 'auto', paddingTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
                        {sourceBadge}
                    </div>
                </>
            ) : mode === 'threat' && threat ? (
                <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 14 }}>
                        <img
                            src={`${HERO_ICON_CDN}/${threat.hero_name.replace(/^npc_dota_hero_/, '')}.png`}
                            alt={displayName(threat.hero_name)}
                            style={{ width: 76, height: 43, display: 'block', flex: 'none' }}
                            onError={e => { (e.target as HTMLImageElement).style.opacity = '0.3'; }}
                        />
                        <div style={{ minWidth: 0 }}>
                            <div style={{
                                fontFamily: console_.display, fontSize: console_.tThreat, fontWeight: 700,
                                color: console_.ink, textTransform: 'uppercase',
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}>
                                {displayName(threat.hero_name)}{' '}
                                <span style={{ fontSize: 13, color: console_.dire, fontFamily: console_.mono, ...tnum }}>
                                    LV {threat.level} · {(threat.net_worth / 1000).toFixed(1)}k
                                </span>
                            </div>
                            {threat.items.length > 0 ? (
                                <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                                    {Array.from({ length: 6 }).map((_, i) => {
                                        const item = threat.items[i];
                                        return item ? (
                                            <img
                                                key={i}
                                                src={`${ITEM_ICON_CDN}/${item}.png`}
                                                alt={item}
                                                title={item.replace(/_/g, ' ')}
                                                style={{ width: 30, height: 22, display: 'block', border: `1px solid ${console_.line2}` }}
                                                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                            />
                                        ) : (
                                            <span key={i} style={{
                                                width: 30, height: 22, display: 'block',
                                                border: `1px solid ${console_.line2}`, opacity: 0.6,
                                            }} />
                                        );
                                    })}
                                </div>
                            ) : (
                                // Row 35: absent GC data is one dim line, not six broken slots.
                                <div style={{ marginTop: 6, fontSize: 10, letterSpacing: '.16em', color: console_.ghost, fontFamily: console_.mono }}>
                                    ITEMS · AWAITING GC BOT
                                </div>
                            )}
                            {likelyNext && (
                                <div style={{ marginTop: 5, fontSize: 10.5, letterSpacing: '.1em', color: console_.amber, fontFamily: console_.mono, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', ...tnum }}>
                                    {likelyNext}
                                </div>
                            )}
                        </div>
                    </div>
                    {spike && (
                        <div style={{
                            fontFamily: console_.reading, fontSize: 14, lineHeight: 1.55,
                            color: console_.muted, marginTop: 12,
                            borderTop: `1px solid ${console_.line2}`, paddingTop: 10,
                            display: '-webkit-box', WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical' as never, overflow: 'hidden',
                        }}>
                            {normalizeDashes(spike)}
                        </div>
                    )}
                    <div style={{
                        marginTop: 'auto', paddingTop: 10,
                        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12,
                        fontSize: 10.5, letterSpacing: '.1em', color: console_.chrome,
                        fontFamily: console_.mono, ...tnum, minWidth: 0,
                    }}>
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {rosterTail(others)}
                        </span>
                        {sourceBadge}
                    </div>
                </>
            ) : (
                <>
                    <div style={{
                        marginTop: 14, fontSize: 11, letterSpacing: '.18em',
                        color: console_.ghost, fontFamily: console_.mono, lineHeight: 1.8,
                    }}>
                        NO ENEMY INTEL — GC BOT DELIVERS ITEMS + NET WORTH
                        {enemyHeroNames.length > 0 && (
                            <div style={{ color: console_.chrome, letterSpacing: '.1em', marginTop: 6 }}>
                                KNOWN: {enemyHeroNames.map(h => displayName(h).toUpperCase()).join(' · ')}
                            </div>
                        )}
                    </div>
                    <div style={{ marginTop: 'auto', paddingTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
                        {sourceBadge}
                    </div>
                </>
            )}
        </div>
    );
}
