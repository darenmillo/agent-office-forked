import React, { useState, useCallback } from 'react';
import { HeroData, Recommendation, RAIJIN_API } from '../raijinTypes';

const STEAM_CDN_HEROES = 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes';
const STEAM_CDN_ITEMS = 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items';

/** Some GSI item names don't match the CDN filename exactly. */
const ITEM_NAME_FIXES: Record<string, string> = {
    tpscroll: 'tp_scroll',
    tp_scroll: 'tp_scroll',
};

function itemCdnName(raw: string): string {
    const stripped = raw.replace(/^item_/, '');
    return ITEM_NAME_FIXES[stripped] ?? stripped;
}

function itemDisplayName(raw: string): string {
    return raw.replace(/^item_/, '').replace(/_/g, ' ');
}

interface Props {
    heroData: HeroData | null;
    recommendations: Recommendation[];
}

function formatTime(seconds: number): string {
    const neg = seconds < 0;
    const abs = Math.abs(seconds);
    const m = Math.floor(abs / 60);
    const s = abs % 60;
    return `${neg ? '-' : ''}${m}:${s.toString().padStart(2, '0')}`;
}

/* ------------------------------------------------------------------ */
/*  Item Slot — shows icon with fallback to text pill                 */
/* ------------------------------------------------------------------ */
function ItemSlot({ name, size }: { name: string | null; size: number }) {
    const [failed, setFailed] = useState(false);

    const handleError = useCallback(() => setFailed(true), []);

    const slotBase: React.CSSProperties = {
        width: size,
        height: size,
        borderRadius: 4,
        border: '1px solid rgba(79, 195, 247, 0.25)',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        flexShrink: 0,
    };

    // Empty slot
    if (!name) {
        return (
            <div style={{
                ...slotBase,
                background: 'rgba(0, 0, 0, 0.35)',
                opacity: 0.4,
            }} />
        );
    }

    const cdnName = itemCdnName(name);
    const url = `${STEAM_CDN_ITEMS}/${cdnName}.png`;
    const display = itemDisplayName(name);

    // Fallback text pill when image fails
    if (failed) {
        return (
            <div
                title={display}
                style={{
                    ...slotBase,
                    background: 'rgba(79, 195, 247, 0.1)',
                    padding: 2,
                }}
            >
                <span style={{
                    fontSize: Math.max(8, size / 4.5),
                    color: '#dfe6e9',
                    fontWeight: 500,
                    textAlign: 'center',
                    lineHeight: 1.1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    wordBreak: 'break-word',
                }}>
                    {display}
                </span>
            </div>
        );
    }

    return (
        <div
            title={display}
            style={{
                ...slotBase,
                background: 'rgba(0, 0, 0, 0.4)',
                boxShadow: '0 0 6px rgba(79, 195, 247, 0.2)',
            }}
        >
            <img
                src={url}
                alt={display}
                onError={handleError}
                style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                }}
            />
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  Items Grid — [6 main] | [3 backpack] | [neutral] | [TP]          */
/* ------------------------------------------------------------------ */
function ItemsGrid({ items }: { items: string[] }) {
    // Pad to at least 11 slots: 6 main + 3 backpack + 1 neutral + 1 TP
    const padded: (string | null)[] = [];
    for (let i = 0; i < 11; i++) {
        padded.push(items[i] ?? null);
    }

    const main = padded.slice(0, 6);
    const backpack = padded.slice(6, 9);
    const neutral = padded[9];
    const tp = padded[10];

    return (
        <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: '#636e72', marginBottom: 6, fontWeight: 600 }}>ITEMS</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* 6 main slots */}
                <div style={{ display: 'flex', gap: 4 }}>
                    {main.map((item, i) => (
                        <ItemSlot key={`main-${i}`} name={item} size={36} />
                    ))}
                </div>

                {/* Separator */}
                <div style={{
                    width: 1, height: 28,
                    background: 'rgba(79, 195, 247, 0.2)',
                    flexShrink: 0,
                }} />

                {/* 3 backpack slots — slightly smaller */}
                <div style={{ display: 'flex', gap: 3 }}>
                    {backpack.map((item, i) => (
                        <ItemSlot key={`bp-${i}`} name={item} size={28} />
                    ))}
                </div>

                {/* Separator */}
                <div style={{
                    width: 1, height: 28,
                    background: 'rgba(79, 195, 247, 0.2)',
                    flexShrink: 0,
                }} />

                {/* Neutral item */}
                <div style={{ position: 'relative' }}>
                    <ItemSlot name={neutral} size={30} />
                    <div style={{
                        position: 'absolute', bottom: -10, left: 0, right: 0,
                        textAlign: 'center', fontSize: 8, color: '#636e72', fontWeight: 600,
                    }}>N</div>
                </div>

                {/* TP */}
                <div style={{ position: 'relative' }}>
                    <ItemSlot name={tp} size={30} />
                    <div style={{
                        position: 'absolute', bottom: -10, left: 0, right: 0,
                        textAlign: 'center', fontSize: 8, color: '#636e72', fontWeight: 600,
                    }}>TP</div>
                </div>
            </div>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */
export function RaijinHeroDisplay({ heroData, recommendations }: Props) {
    const heroName = heroData?.hero_name || null;
    const portraitUrl = heroName ? `${RAIJIN_API}/api/portrait/${heroName}` : null;
    const fallbackUrl = heroName ? `${STEAM_CDN_HEROES}/${heroName}.png` : null;

    // Find next item recommendation
    const itemRec = recommendations.find(r => r.category === 'ITEM' && r.priority >= 3);
    // Find skill recommendation
    const skillRec = recommendations.find(r => r.category === 'SKILL');

    if (!heroData) {
        return (
            <div style={{
                ...panelStyle,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
                <div style={{ textAlign: 'center', color: '#4fc3f7', fontSize: 22, fontWeight: 600 }}>
                    Waiting for Dota 2...
                </div>
            </div>
        );
    }

    const hpPct = heroData.max_health > 0 ? (heroData.health / heroData.max_health) * 100 : 0;
    const manaPct = heroData.max_mana > 0 ? (heroData.mana / heroData.max_mana) * 100 : 0;
    const hpColor = hpPct > 50 ? '#00b894' : hpPct > 25 ? '#fdcb6e' : '#d63031';

    return (
        <div style={panelStyle}>
            {/* Zoltar Portrait — large and prominent */}
            <div style={{
                display: 'flex', justifyContent: 'center', marginBottom: 16,
            }}>
                <div style={{
                    width: 320, height: 200, borderRadius: 12, overflow: 'hidden',
                    border: '2px solid rgba(79, 195, 247, 0.5)',
                    boxShadow: '0 0 30px rgba(79, 195, 247, 0.3), 0 0 60px rgba(79, 195, 247, 0.1)',
                    background: 'rgba(0,0,0,0.5)', position: 'relative',
                }}>
                    {portraitUrl && (
                        <video
                            src={portraitUrl}
                            autoPlay loop muted playsInline
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={(e) => {
                                const el = e.currentTarget;
                                if (fallbackUrl) {
                                    const parent = el.parentElement;
                                    if (parent) {
                                        el.style.display = 'none';
                                        parent.style.backgroundImage = `url(${fallbackUrl})`;
                                        parent.style.backgroundSize = 'cover';
                                        parent.style.backgroundPosition = 'center';
                                    }
                                }
                            }}
                        />
                    )}
                    {/* Hero name overlay */}
                    <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0,
                        background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
                        padding: '12px 10px 6px', textAlign: 'center',
                        fontSize: 16, fontWeight: 700, color: '#4fc3f7',
                        textTransform: 'uppercase', letterSpacing: 2,
                    }}>
                        {heroName?.replace(/_/g, ' ')}
                    </div>
                </div>
            </div>

            {/* HP / Mana bars */}
            <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 13, color: '#b2bec3', width: 28, fontWeight: 600 }}>HP</span>
                    <div style={{ flex: 1, height: 14, background: 'rgba(0,0,0,0.4)', borderRadius: 4 }}>
                        <div style={{
                            width: `${hpPct}%`, height: '100%', borderRadius: 4,
                            background: hpColor, transition: 'width 0.3s',
                        }} />
                    </div>
                    <span style={{ fontSize: 13, color: '#dfe6e9', width: 80, textAlign: 'right', fontWeight: 500 }}>
                        {heroData.health}/{heroData.max_health}
                    </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, color: '#b2bec3', width: 28, fontWeight: 600 }}>MP</span>
                    <div style={{ flex: 1, height: 14, background: 'rgba(0,0,0,0.4)', borderRadius: 4 }}>
                        <div style={{
                            width: `${manaPct}%`, height: '100%', borderRadius: 4,
                            background: '#74b9ff', transition: 'width 0.3s',
                        }} />
                    </div>
                    <span style={{ fontSize: 13, color: '#dfe6e9', width: 80, textAlign: 'right', fontWeight: 500 }}>
                        {heroData.mana}/{heroData.max_mana}
                    </span>
                </div>
            </div>

            {/* Stats row */}
            <div style={{
                display: 'flex', justifyContent: 'space-around', alignItems: 'center',
                padding: '10px 0', borderTop: '1px solid rgba(79,195,247,0.15)',
                borderBottom: '1px solid rgba(79,195,247,0.15)', marginBottom: 12,
            }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 28, fontWeight: 700, color: '#4fc3f7' }}>
                        {heroData.level}
                    </div>
                    <div style={{ fontSize: 11, color: '#636e72', fontWeight: 600 }}>LEVEL</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 600, color: '#dfe6e9' }}>
                        {heroData.kills}/{heroData.deaths}/{heroData.assists}
                    </div>
                    <div style={{ fontSize: 11, color: '#636e72', fontWeight: 600 }}>KDA</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 600, color: '#fdcb6e' }}>
                        {heroData.gold}
                    </div>
                    <div style={{ fontSize: 11, color: '#636e72', fontWeight: 600 }}>GOLD</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 600, color: '#dfe6e9' }}>
                        {heroData.gpm}
                    </div>
                    <div style={{ fontSize: 11, color: '#636e72', fontWeight: 600 }}>GPM</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 600, color: '#dfe6e9' }}>
                        {heroData.last_hits}
                    </div>
                    <div style={{ fontSize: 11, color: '#636e72', fontWeight: 600 }}>LH</div>
                </div>
            </div>

            {/* Clock + alive status */}
            <div style={{
                display: 'flex', justifyContent: 'space-between', marginBottom: 12,
                fontSize: 15, color: '#b2bec3', fontWeight: 500,
            }}>
                <span>{formatTime(heroData.clock_time)}</span>
                {!heroData.alive && (
                    <span style={{ color: '#d63031', fontWeight: 700, fontSize: 16 }}>
                        DEAD - Respawn: {heroData.respawn_seconds}s
                    </span>
                )}
                <span>Reliable: {heroData.gold_reliable}g</span>
            </div>

            {/* Items grid — icon-based with CDN images */}
            <ItemsGrid items={heroData.items} />

            {/* Next item recommendation */}
            {itemRec && (
                <div style={{
                    padding: 12, borderRadius: 8, marginBottom: 10,
                    background: 'rgba(253,203,110,0.1)',
                    border: '1px solid rgba(253,203,110,0.3)',
                }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#fdcb6e' }}>
                        {itemRec.title}
                    </div>
                    <div style={{ fontSize: 13, color: '#dfe6e9', marginTop: 4 }}>
                        {itemRec.body}
                    </div>
                </div>
            )}

            {/* Skill recommendation */}
            {skillRec && (
                <div style={{
                    padding: 12, borderRadius: 8,
                    background: 'rgba(79,195,247,0.1)',
                    border: '1px solid rgba(79,195,247,0.3)',
                }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#4fc3f7' }}>
                        {skillRec.title}
                    </div>
                    <div style={{ fontSize: 13, color: '#dfe6e9', marginTop: 4 }}>
                        {skillRec.body}
                    </div>
                </div>
            )}
        </div>
    );
}

const panelStyle: React.CSSProperties = {
    background: 'rgba(20, 40, 80, 0.92)',
    borderRadius: 12,
    border: '1px solid rgba(79, 195, 247, 0.3)',
    padding: 20,
    overflowY: 'auto',
};
