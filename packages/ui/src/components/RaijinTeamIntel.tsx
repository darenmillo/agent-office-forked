import React from 'react';
import { HeroData, EnemyIntelData, EnemyPlayerData, EnemySource, ITEM_ICON_CDN } from '../raijinTypes';
import { pip, panelBase, labelStyle, glowText, glow } from '../raijinTheme';

interface Props {
    enemyIntel: EnemyIntelData | null;
    heroData: HeroData | null;
    enemySource?: EnemySource;
    onSourceClick?: () => void;
}

const PORTRAIT_API = 'http://localhost:4000/api/portrait';
const HERO_ICON_CDN = 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes';

/**
 * Team Intel Bar — Dota 2-style top panel.
 * Allies left | Player center with scores | Enemies right with items + NW.
 *
 * UX notes (UI/UX Pro Max guidelines):
 * - Data density: enemies get items (high-value), allies get names only (no data)
 * - Delay indicator always visible — player must know data is ~2 min old
 * - Contrast: all text meets 4.5:1 on dark backgrounds
 * - Spacing: 4px grid (pip.sp1 increments)
 */
export function RaijinTeamIntel({
    enemyIntel,
    heroData,
    enemySource = 'none',
    onSourceClick,
}: Props) {
    if (!heroData) return null;

    const myTeam = heroData.my_team || '';
    const allies = (heroData.allied_heroes || []).filter(h => h !== heroData.hero_name);
    const delay = enemyIntel?.delay_seconds ?? 0;

    // Separate enemy players from ally players in bot data
    const enemyPlayers = enemyIntel?.players.filter(p => p.team !== myTeam && p.hero_id > 0) ?? [];
    const fallbackEnemies = heroData.enemy_heroes || [];

    // Scores from bot data
    const ourScore = myTeam === 'radiant'
        ? enemyIntel?.radiant_score ?? heroData.kills  // fallback to own kills
        : enemyIntel?.dire_score ?? heroData.kills;
    const theirScore = myTeam === 'radiant'
        ? enemyIntel?.dire_score ?? 0
        : enemyIntel?.radiant_score ?? 0;

    return (
        <div style={{
            ...panelBase,
            gridColumn: '1 / -1',
            padding: `${pip.sp2}px ${pip.sp3}px`,
            display: 'flex',
            alignItems: 'center',
            gap: pip.sp2,
            minHeight: 90,
            position: 'relative',
        }}>
            {/* Enemy-source badge — tells the player where enemy data comes from */}
            <EnemySourceBadge source={enemySource} onClick={onSourceClick} />

            {/* ── ALLIES (left) ── */}
            <div style={{
                flex: 1,
                display: 'flex',
                gap: pip.sp2,
                justifyContent: 'flex-end',
            }}>
                {allies.length > 0 ? allies.slice(0, 4).map((hero, i) => (
                    <AllyCard key={i} heroName={hero} />
                )) : (
                    Array.from({ length: 4 }).map((_, i) => (
                        <PlaceholderCard key={i} />
                    ))
                )}
            </div>

            {/* ── CENTER: Player + Scores ── */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                minWidth: 140,
                padding: `0 ${pip.sp3}px`,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: pip.sp3 }}>
                    <span style={{
                        fontSize: pip.textLg,
                        fontWeight: 700,
                        color: pip.green,
                        fontFamily: pip.font,
                        textShadow: glowText(pip.green),
                    }}>
                        {ourScore}
                    </span>

                    <div style={{
                        border: `2px solid ${pip.amber}`,
                        boxShadow: glow(pip.amber, 6),
                        padding: 2,
                        position: 'relative',
                    }}>
                        <img
                            src={`${HERO_ICON_CDN}/${heroData.hero_name}.png`}
                            alt={heroData.hero_name}
                            style={{ width: 56, height: 32, display: 'block' }}
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                    </div>

                    <span style={{
                        fontSize: pip.textLg,
                        fontWeight: 700,
                        color: pip.red,
                        fontFamily: pip.font,
                        textShadow: glowText(pip.red),
                    }}>
                        {theirScore}
                    </span>
                </div>

                <div style={{
                    fontSize: pip.textXs,
                    color: pip.amberDim,
                    fontFamily: pip.font,
                    fontWeight: 700,
                    letterSpacing: 1,
                    marginTop: pip.sp1,
                    textTransform: 'uppercase',
                }}>
                    {heroData.hero_name.replace(/_/g, ' ')}
                </div>

                {/* Delay indicator */}
                <DelayBadge delay={delay} hasData={enemyPlayers.length > 0} />
            </div>

            {/* ── ENEMIES (right) ── */}
            <div style={{
                flex: 1,
                display: 'flex',
                gap: pip.sp2,
                justifyContent: 'flex-start',
                overflow: 'hidden',
            }}>
                {enemyPlayers.length > 0 ? (
                    enemyPlayers.slice(0, 5).map((p, i) => (
                        <EnemyCard key={i} player={p} delay={delay} />
                    ))
                ) : fallbackEnemies.length > 0 ? (
                    fallbackEnemies.slice(0, 5).map((name, i) => (
                        <EnemyCardFallback key={i} heroName={name} />
                    ))
                ) : (
                    Array.from({ length: 5 }).map((_, i) => (
                        <PlaceholderCard key={i} enemy />
                    ))
                )}
            </div>
        </div>
    );
}


/* ── Ally Card (portrait + name only — no stats available) ── */
function AllyCard({ heroName }: { heroName: string }) {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: 72,
            flexShrink: 1,
        }}>
            <div style={{
                border: `1px solid ${pip.amberGhost}`,
                padding: 1,
            }}>
                <img
                    src={`${HERO_ICON_CDN}/${heroName}.png`}
                    alt={heroName}
                    style={{ width: 48, height: 27, display: 'block' }}
                    onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3'; }}
                />
            </div>
            <span style={{
                fontSize: pip.textXs,
                color: pip.amberDim,
                fontFamily: pip.font,
                fontWeight: 600,
                marginTop: 2,
                textTransform: 'uppercase',
                textAlign: 'center',
                lineHeight: 1.1,
                maxWidth: 72,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
            }}>
                {heroName.replace(/_/g, ' ')}
            </span>
        </div>
    );
}


/* ── Enemy Card (portrait + items + NW + KDA — the main intel) ── */
function EnemyCard({ player, delay }: { player: EnemyPlayerData; delay: number }) {
    const display = player.hero_name.replace(/_/g, ' ');
    const nwStr = player.net_worth >= 1000
        ? `${(player.net_worth / 1000).toFixed(1)}k`
        : `${player.net_worth}`;

    // Delay trust: border color dims with staleness
    const borderColor = delay < 60 ? pip.amberBright
        : delay <= 180 ? pip.amberFaint
        : pip.amberGhost;
    const itemOpacity = delay > 180 ? 0.6 : 1;

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            width: 150,
            flexShrink: 1,
            minWidth: 120,
            borderLeft: `2px solid ${pip.catFight}`,
            borderTop: `1px solid ${borderColor}`,
            borderRight: `1px solid ${borderColor}`,
            borderBottom: `1px solid ${borderColor}`,
            padding: `${pip.sp1}px ${pip.sp2}px`,
            background: pip.bgInset,
        }}>
            {/* Top row: portrait + name + level */}
            <div style={{ display: 'flex', alignItems: 'center', gap: pip.sp2, marginBottom: 3 }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                    <img
                        src={`${HERO_ICON_CDN}/${player.hero_name}.png`}
                        alt={display}
                        style={{ width: 40, height: 23, display: 'block' }}
                        onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3'; }}
                    />
                    {/* Level badge */}
                    <span style={{
                        position: 'absolute',
                        top: -3,
                        right: -3,
                        fontSize: 9,
                        fontWeight: 700,
                        color: pip.amber,
                        fontFamily: pip.font,
                        background: pip.bgDeep,
                        border: `1px solid ${pip.amberFaint}`,
                        padding: '0 2px',
                        lineHeight: '12px',
                    }}>
                        {player.level}
                    </span>
                </div>
                <div style={{ overflow: 'hidden', flex: 1 }}>
                    <div style={{
                        fontSize: pip.textXs,
                        fontWeight: 700,
                        color: pip.catFight,
                        fontFamily: pip.font,
                        textTransform: 'uppercase',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        lineHeight: 1.1,
                    }}>
                        {display}
                    </div>
                    <div style={{
                        fontSize: 9,
                        color: pip.amberDim,
                        fontFamily: pip.font,
                    }}>
                        {player.kills}/{player.deaths}/{player.assists}
                        <span style={{
                            color: pip.amberBright,
                            fontWeight: 700,
                            marginLeft: pip.sp2,
                        }}>
                            {nwStr}
                        </span>
                    </div>
                </div>
            </div>

            {/* Items row */}
            <div style={{
                display: 'flex',
                gap: 2,
                opacity: itemOpacity,
            }}>
                {Array.from({ length: 6 }).map((_, i) => {
                    const item = player.items[i];
                    if (item) {
                        return (
                            <img
                                key={i}
                                src={`${ITEM_ICON_CDN}/${item}.png`}
                                alt={item}
                                title={item.replace(/_/g, ' ')}
                                style={{
                                    width: 24,
                                    height: 18,
                                    display: 'block',
                                    border: `1px solid ${pip.amberGhost}`,
                                }}
                                onError={(e) => {
                                    const img = e.target as HTMLImageElement;
                                    img.style.display = 'none';
                                }}
                            />
                        );
                    }
                    return (
                        <div key={i} style={{
                            width: 24,
                            height: 18,
                            background: pip.bgDeep,
                            border: `1px solid ${pip.amberGhost}`,
                            opacity: 0.3,
                        }} />
                    );
                })}
            </div>
        </div>
    );
}


/* ── Enemy Card Fallback (hero name only, no bot data yet) ── */
function EnemyCardFallback({ heroName }: { heroName: string }) {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: 150,
            flexShrink: 1,
            minWidth: 120,
            borderLeft: `2px solid ${pip.catFight}`,
            border: `1px solid ${pip.amberGhost}`,
            padding: `${pip.sp1}px ${pip.sp2}px`,
            background: pip.bgInset,
            justifyContent: 'center',
            minHeight: 60,
        }}>
            <img
                src={`${HERO_ICON_CDN}/${heroName}.png`}
                alt={heroName}
                style={{ width: 40, height: 23, display: 'block', opacity: 0.6 }}
                onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.2'; }}
            />
            <span style={{
                fontSize: pip.textXs,
                color: pip.catFight,
                fontFamily: pip.font,
                fontWeight: 700,
                textTransform: 'uppercase',
                marginTop: 3,
            }}>
                {heroName.replace(/_/g, ' ')}
            </span>
            <span style={{
                fontSize: 9,
                color: pip.amberGhost,
                fontFamily: pip.font,
                fontStyle: 'italic',
            }}>
                awaiting intel...
            </span>
        </div>
    );
}


/* ── Placeholder Card (no data at all) ── */
function PlaceholderCard({ enemy }: { enemy?: boolean }) {
    return (
        <div style={{
            width: enemy ? 170 : 72,
            minHeight: 50,
            border: `1px solid ${pip.amberGhost}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0.3,
            flexShrink: enemy ? 0 : 1,
        }}>
            <span style={{
                fontSize: pip.textSm,
                color: pip.amberGhost,
                fontFamily: pip.font,
            }}>
                ?
            </span>
        </div>
    );
}


/* ── Delay Badge ── */
function DelayBadge({ delay, hasData }: { delay: number; hasData: boolean }) {
    if (!hasData) {
        return (
            <span style={{
                fontSize: 9,
                color: pip.amberGhost,
                fontFamily: pip.font,
                fontStyle: 'italic',
                marginTop: 2,
            }}>
                BOT CONNECTING...
            </span>
        );
    }

    const minutes = Math.round(delay / 60);
    const isStale = delay > 180;
    const color = isStale ? pip.red : pip.amberDim;

    return (
        <span style={{
            fontSize: 9,
            color,
            fontFamily: pip.font,
            fontWeight: 700,
            letterSpacing: 1,
            marginTop: 2,
            textShadow: isStale ? glowText(pip.red, 4) : undefined,
        }}>
            INTEL ~{minutes > 0 ? `${minutes}m` : `${delay}s`} AGO
        </span>
    );
}

/* ── Enemy source badge — pinned top-left of the team intel bar ── */
function EnemySourceBadge({
    source,
    onClick,
}: {
    source: EnemySource;
    onClick?: () => void;
}) {
    const config: Record<EnemySource, { label: string; color: string; clickable: boolean }> = {
        gsi_draft: { label: 'ENEMIES: GSI DRAFT \u2713', color: pip.amberBright, clickable: false },
        bot: { label: 'ENEMIES: BOT \u2713', color: pip.green, clickable: false },
        manual: { label: 'ENEMIES: MANUAL', color: pip.amber, clickable: true },
        none: { label: 'ENEMIES: UNKNOWN \u2014 click to set', color: pip.red, clickable: true },
    };
    const cfg = config[source];
    const interactive = cfg.clickable && !!onClick;
    return (
        <button
            type="button"
            onClick={interactive ? onClick : undefined}
            disabled={!interactive}
            aria-label={cfg.label}
            style={{
                position: 'absolute',
                top: 4,
                left: 8,
                zIndex: 5,
                background: 'transparent',
                border: `1px solid ${cfg.color}`,
                color: cfg.color,
                padding: '3px 8px',
                fontFamily: pip.font,
                fontSize: pip.textXs,
                fontWeight: 700,
                letterSpacing: 1,
                cursor: interactive ? 'pointer' : 'default',
                textShadow: glowText(cfg.color, 4),
            }}
        >
            {cfg.label}
        </button>
    );
}
