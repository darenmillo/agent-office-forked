import React, { useState, useCallback } from 'react';
import { HeroData, Recommendation, RAIJIN_API } from '../raijinTypes';
import { pip, panelBase, labelStyle, glow, glowText } from '../raijinTheme';

const STEAM_CDN_HEROES = 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes';
const STEAM_CDN_ITEMS = 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items';

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

/* ── Item Slot ── */
function ItemSlot({ name, size }: { name: string | null; size: number }) {
    const [failed, setFailed] = useState(false);
    const handleError = useCallback(() => setFailed(true), []);

    const slotBase: React.CSSProperties = {
        width: size,
        height: size,
        border: `1px solid ${pip.amberFaint}`,
        borderRadius: 0,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: pip.font,
        flexShrink: 0,
    };

    if (!name) {
        return <div style={{ ...slotBase, background: pip.bgDeep, opacity: 0.35 }} />;
    }

    const cdnName = itemCdnName(name);
    const url = `${STEAM_CDN_ITEMS}/${cdnName}.png`;
    const display = itemDisplayName(name);

    if (failed) {
        return (
            <div title={display} style={{ ...slotBase, background: pip.bgInset, padding: 2 }}>
                <span style={{
                    fontSize: Math.max(9, size / 4),
                    color: pip.amberDim,
                    fontWeight: 600,
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
        <div title={display} style={{ ...slotBase, background: pip.bgDeep }}>
            <img
                src={url} alt={display} onError={handleError}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
        </div>
    );
}

/* ── Items Grid ── */
function ItemsGrid({ items }: { items: string[] }) {
    const padded: (string | null)[] = [];
    for (let i = 0; i < 11; i++) padded.push(items[i] ?? null);

    const main = padded.slice(0, 6);
    const backpack = padded.slice(6, 9);
    const neutral = padded[9];
    const tp = padded[10];

    return (
        <div style={{ marginBottom: pip.sp4 }}>
            <div style={{ ...labelStyle, marginBottom: pip.sp2 }}>INVENTORY</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: pip.sp3 }}>
                {/* 6 main slots */}
                <div style={{ display: 'flex', gap: 3 }}>
                    {main.map((item, i) => <ItemSlot key={`m-${i}`} name={item} size={38} />)}
                </div>

                {/* Separator */}
                <div style={{ width: 2, height: 30, background: pip.amberFaint, flexShrink: 0 }} />

                {/* 3 backpack */}
                <div style={{ display: 'flex', gap: 3 }}>
                    {backpack.map((item, i) => <ItemSlot key={`b-${i}`} name={item} size={30} />)}
                </div>

                {/* Separator */}
                <div style={{ width: 2, height: 30, background: pip.amberFaint, flexShrink: 0 }} />

                {/* Neutral */}
                <div style={{ position: 'relative' }}>
                    <ItemSlot name={neutral} size={32} />
                    <div style={{
                        ...labelStyle, position: 'absolute', bottom: -14,
                        left: 0, right: 0, textAlign: 'center',
                        fontSize: 9, letterSpacing: 1,
                    }}>N</div>
                </div>

                {/* TP */}
                <div style={{ position: 'relative' }}>
                    <ItemSlot name={tp} size={32} />
                    <div style={{
                        ...labelStyle, position: 'absolute', bottom: -14,
                        left: 0, right: 0, textAlign: 'center',
                        fontSize: 9, letterSpacing: 1,
                    }}>TP</div>
                </div>
            </div>
        </div>
    );
}

/* ── Stat Cell ── */
function Stat({ label, value, color }: { label: string; value: string | number; color?: string }) {
    const c = color || pip.amber;
    return (
        <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{
                fontSize: pip.textLg,
                fontWeight: 700,
                color: c,
                fontFamily: pip.font,
                textShadow: glowText(c),
                fontVariantNumeric: 'tabular-nums',
            }}>
                {value}
            </div>
            <div style={{ ...labelStyle, fontSize: pip.textXs }}>{label}</div>
        </div>
    );
}

/* ── Main Component ── */
export function RaijinHeroDisplay({ heroData, recommendations }: Props) {
    const heroName = heroData?.hero_name || null;
    const portraitUrl = heroName ? `${RAIJIN_API}/api/portrait/${heroName}` : null;
    const fallbackUrl = heroName ? `${STEAM_CDN_HEROES}/${heroName}.png` : null;

    const itemRec = recommendations.find(r => r.category === 'ITEM' && r.priority >= 3);
    const skillRec = recommendations.find(r => r.category === 'SKILL');

    if (!heroData) {
        return (
            <div style={{
                ...panelBase,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
                <div style={{
                    textAlign: 'center',
                    color: pip.amber,
                    fontSize: pip.textXl,
                    fontWeight: 700,
                    fontFamily: pip.font,
                    textShadow: glowText(pip.amber, 8),
                    letterSpacing: 3,
                }}>
                    AWAITING SIGNAL...
                </div>
            </div>
        );
    }

    const hpPct = heroData.max_health > 0 ? (heroData.health / heroData.max_health) * 100 : 0;
    const manaPct = heroData.max_mana > 0 ? (heroData.mana / heroData.max_mana) * 100 : 0;
    const hpColor = hpPct > 50 ? pip.green : hpPct > 25 ? pip.amber : pip.red;

    return (
        <div style={{ ...panelBase, overflowY: 'auto' }}>
            {/* ── Portrait ── */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: pip.sp4 }}>
                <div style={{
                    width: 320, height: 200,
                    border: `2px solid ${pip.amber}`,
                    boxShadow: `${glow(pip.amber, 12)}, inset 0 0 40px rgba(0,0,0,0.6)`,
                    background: pip.bgDeep,
                    position: 'relative', overflow: 'hidden',
                }}>
                    {portraitUrl && (
                        <video
                            src={portraitUrl} autoPlay loop muted playsInline
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={(e) => {
                                const el = e.currentTarget;
                                if (fallbackUrl && el.parentElement) {
                                    el.style.display = 'none';
                                    el.parentElement.style.backgroundImage = `url(${fallbackUrl})`;
                                    el.parentElement.style.backgroundSize = 'cover';
                                    el.parentElement.style.backgroundPosition = 'center';
                                }
                            }}
                        />
                    )}
                    {/* Hero name overlay */}
                    <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0,
                        background: `linear-gradient(transparent, ${pip.bgDeep}ee)`,
                        padding: '16px 12px 8px',
                        textAlign: 'center',
                        fontSize: pip.textMd, fontWeight: 700,
                        color: pip.amber,
                        textTransform: 'uppercase',
                        letterSpacing: 3,
                        fontFamily: pip.font,
                        textShadow: glowText(pip.amber, 6),
                    }}>
                        {heroName?.replace(/_/g, ' ')}
                    </div>
                </div>
            </div>

            {/* ── HP / Mana ── */}
            <div style={{ marginBottom: pip.sp4 }}>
                <BarRow label="HP" pct={hpPct} color={hpColor} text={`${heroData.health}/${heroData.max_health}`} />
                <BarRow label="MP" pct={manaPct} color={pip.blue} text={`${heroData.mana}/${heroData.max_mana}`} textColor={pip.blue} />
            </div>

            {/* ── Stats ── */}
            <div style={{
                display: 'flex', justifyContent: 'space-around',
                padding: `${pip.sp3}px 0`,
                borderTop: `1px solid ${pip.amberFaint}`,
                borderBottom: `1px solid ${pip.amberFaint}`,
                marginBottom: pip.sp4,
            }}>
                <Stat label="LVL" value={heroData.level} />
                <Stat label="KDA" value={`${heroData.kills}/${heroData.deaths}/${heroData.assists}`} color={pip.amberBright} />
                <Stat label="GOLD" value={heroData.gold} color={pip.amberBright} />
                <Stat label="GPM" value={heroData.gpm} />
                <Stat label="LH" value={heroData.last_hits} />
            </div>

            {/* ── Clock + Status ── */}
            <div style={{
                display: 'flex', justifyContent: 'space-between',
                marginBottom: pip.sp4,
                fontSize: pip.textBase, color: pip.amberDim,
                fontFamily: pip.font, fontWeight: 600,
            }}>
                <span style={{ textShadow: glowText(pip.amberDim) }}>
                    {formatTime(heroData.clock_time)}
                </span>
                {!heroData.alive && (
                    <span style={{
                        color: pip.red, fontWeight: 700,
                        textShadow: glowText(pip.red, 6),
                    }}>
                        DEAD — RESPAWN {heroData.respawn_seconds}s
                    </span>
                )}
                <span>RELIABLE: {heroData.gold_reliable}g</span>
            </div>

            {/* ── Items ── */}
            <ItemsGrid items={heroData.items} />

            {/* ── Item Recommendation ── */}
            {itemRec && (
                <RecHighlight accent={pip.catItem} title={itemRec.title} body={itemRec.body} />
            )}

            {/* ── Skill Recommendation ── */}
            {skillRec && (
                <RecHighlight accent={pip.amber} title={skillRec.title} body={skillRec.body} />
            )}

            {/* Enemy heroes moved to RaijinTeamIntel top bar */}
        </div>
    );
}

/* ── Bar Row (HP / Mana) ── */
function BarRow({ label, pct, color, text, textColor }: {
    label: string; pct: number; color: string; text: string; textColor?: string;
}) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: pip.sp2, marginBottom: pip.sp1 }}>
            <span style={{ ...labelStyle, width: 24, fontSize: pip.textSm }}>{label}</span>
            <div style={{
                flex: 1, height: 16,
                background: pip.bgDeep,
                border: `1px solid ${pip.amberGhost}`,
            }}>
                <div style={{
                    width: `${pct}%`, height: '100%',
                    background: color,
                    transition: 'width 0.3s',
                    boxShadow: pct > 0 ? `0 0 6px ${color}44` : undefined,
                }} />
            </div>
            <span style={{
                fontSize: pip.textBase,
                color: textColor || pip.amber,
                fontFamily: pip.font,
                fontWeight: 600,
                width: 100, textAlign: 'right',
                fontVariantNumeric: 'tabular-nums',
            }}>
                {text}
            </span>
        </div>
    );
}

/* ── Recommendation Highlight ── */
function RecHighlight({ accent, title, body }: { accent: string; title: string; body: string }) {
    return (
        <div style={{
            padding: pip.sp3,
            marginBottom: pip.sp2,
            background: pip.bgInset,
            borderLeft: `3px solid ${accent}`,
        }}>
            <div style={{
                fontSize: pip.textMd, fontWeight: 700,
                color: accent, fontFamily: pip.font,
            }}>
                {title}
            </div>
            <div style={{
                fontSize: pip.textBase, color: pip.amberDim,
                fontFamily: pip.font, marginTop: pip.sp1,
                lineHeight: 1.5,
            }}>
                {body}
            </div>
        </div>
    );
}
