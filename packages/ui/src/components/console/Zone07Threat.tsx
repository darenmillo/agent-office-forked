/** 07 · PRIMARY THREAT — the enemy that decides your next fight.
 *
 *  Selection: highest net worth on the enemy team (GC intel). The intel-age
 *  stamp is mandatory and computed from the real receive time. The spike
 *  sentence renders ONLY when a matchup/knowledge-tagged rec mentions this
 *  hero — never a canned line. */
import React from 'react';
import { console_ } from '../../raijinTheme';
import {
    EnemyIntelData, EnemyPlayerData, EnemySource, Recommendation,
    HERO_ICON_CDN, ITEM_ICON_CDN,
} from '../../raijinTypes';
import { fmtMSS } from '../../console';
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
    enemySource, onSourceClick, recs, nowMs,
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
    const ageMs = intelReceivedAt !== null ? nowMs - intelReceivedAt : null;
    const ageColor = ageMs === null ? console_.ghost
        : ageMs > 150_000 ? console_.dire
        : ageMs > 60_000 ? console_.amber
        : console_.chrome;
    const spike = threat ? spikeLineFor(threat, recs) : null;

    const sourceBadge = (
        <button
            onClick={onSourceClick}
            aria-label="Enemy intel source — click to set enemies manually"
            title="Enemy intel source — click to set enemies manually"
            style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                fontSize: 10.5, letterSpacing: '.1em', fontFamily: console_.mono,
                color: enemySource === 'none' ? console_.dire : console_.ghost,
                padding: 0,
            }}
        >
            {SOURCE_LABEL[enemySource]}
        </button>
    );

    return (
        <div style={{ padding: '16px 28px', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <ZoneLabel
                label="07 · PRIMARY THREAT"
                right={
                    <span style={{ fontSize: 10, letterSpacing: '.18em', color: ageColor, fontFamily: console_.mono, ...tnum }}>
                        {ageMs !== null ? `INTEL ${fmtMSS(ageMs / 1000)} OLD` : 'NO INTEL'}
                    </span>
                }
            />
            {threat ? (
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
                            {spike}
                        </div>
                    )}
                    <div style={{
                        marginTop: 'auto', paddingTop: 10,
                        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12,
                        fontSize: 10.5, letterSpacing: '.1em', color: console_.chrome,
                        fontFamily: console_.mono, ...tnum, minWidth: 0,
                    }}>
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {others.map(p => `${displayName(p.hero_name).toUpperCase()} ${(p.net_worth / 1000).toFixed(1)}k`).join(' · ')}
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
