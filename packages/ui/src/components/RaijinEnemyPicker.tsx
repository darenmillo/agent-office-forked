/** RaijinEnemyPicker — modal for manually setting enemy heroes when GSI draft
 * capture fails or the GC spectator bot hasn't acquired the match yet.
 *
 * Pipes through: GET /api/heroes -> hero grid -> POST /api/enemies.
 * Auto-opens via parent state when enemy_source === 'none'.
 * Every animation respects prefers-reduced-motion. WCAG AA-compliant amber
 * phosphor palette (amber primary, not amberDim, for body text). */
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { pip, glow, glowText } from '../raijinTheme';
import { HeroListEntry, RAIJIN_API, HERO_ICON_CDN } from '../raijinTypes';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface Props {
    open: boolean;
    onClose: () => void;
    onConfirm: (heroes: string[]) => void;
}

export function RaijinEnemyPicker({ open, onClose, onConfirm }: Props) {
    const [heroes, setHeroes] = useState<HeroListEntry[]>([]);
    const [selected, setSelected] = useState<string[]>([]);
    const [filter, setFilter] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const modalRef = useFocusTrap<HTMLDivElement>(open);

    // Fetch hero list once when opened
    useEffect(() => {
        if (!open || heroes.length > 0) return;
        let cancelled = false;
        setLoading(true);
        setError(null);
        fetch(`${RAIJIN_API}/api/heroes`)
            .then(r => r.json())
            .then((data: { heroes?: HeroListEntry[] }) => {
                if (cancelled) return;
                setHeroes(data.heroes ?? []);
            })
            .catch(() => {
                if (cancelled) return;
                setError('Could not load hero list. Is the Raijin engine running?');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, [open, heroes.length]);

    // Reset transient state whenever the modal closes
    useEffect(() => {
        if (!open) {
            setFilter('');
            setError(null);
            setSubmitting(false);
        }
    }, [open]);

    // Escape key closes
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    const filtered = useMemo(() => {
        const q = filter.trim().toLowerCase();
        if (!q) return heroes;
        return heroes.filter(h =>
            h.display.toLowerCase().includes(q) || h.name.toLowerCase().includes(q)
        );
    }, [heroes, filter]);

    const toggleHero = useCallback((name: string) => {
        setSelected(prev => {
            if (prev.includes(name)) return prev.filter(n => n !== name);
            if (prev.length >= 5) return prev;
            return [...prev, name];
        });
    }, []);

    const handleConfirm = useCallback(async () => {
        if (selected.length === 0 || submitting) return;
        setSubmitting(true);
        setError(null);
        try {
            const resp = await fetch(`${RAIJIN_API}/api/enemies`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ heroes: selected }),
            });
            if (!resp.ok) {
                const data = await resp.json().catch(() => ({}));
                throw new Error(data.error || `HTTP ${resp.status}`);
            }
            onConfirm(selected);
            setSelected([]);
            onClose();
        } catch (e: any) {
            setError(e.message || 'Failed to set enemies');
        } finally {
            setSubmitting(false);
        }
    }, [selected, submitting, onConfirm, onClose]);

    if (!open) return null;

    return (
        <>
            {/* prefers-reduced-motion: replace the fade-in with an instant opacity swap */}
            <style>{`
                @keyframes raijin-picker-fadein {
                    from { opacity: 0; }
                    to   { opacity: 1; }
                }
                @keyframes raijin-picker-slidein {
                    from { opacity: 0; transform: translateY(-6px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                .raijin-picker-scrim { animation: raijin-picker-fadein 180ms ease-out; }
                .raijin-picker-modal { animation: raijin-picker-slidein 220ms ease-out; }
                @media (prefers-reduced-motion: reduce) {
                    .raijin-picker-scrim,
                    .raijin-picker-modal {
                        animation: none;
                    }
                }
            `}</style>

            {/* Scrim — 50% black blocks the game area but does not fully hide it */}
            <div
                className="raijin-picker-scrim"
                onClick={onClose}
                style={{
                    position: 'fixed', inset: 0,
                    background: 'rgba(0, 0, 0, 0.5)',
                    zIndex: 100,
                }}
            />

            {/* Modal panel */}
            <div
                ref={modalRef}
                className="raijin-picker-modal"
                role="dialog"
                aria-modal="true"
                aria-label="Set enemy heroes"
                style={{
                    position: 'fixed',
                    top: '12%', left: '50%',
                    transform: 'translateX(-50%)',
                    width: 'min(720px, 90vw)',
                    maxHeight: '76vh',
                    display: 'flex', flexDirection: 'column',
                    background: pip.bgPanel,
                    border: `2px solid ${pip.amber}`,
                    boxShadow: glow(pip.amber, 16),
                    fontFamily: pip.font,
                    color: pip.amber,
                    zIndex: 101,
                }}
            >
                {/* Header */}
                <div style={{
                    padding: `${pip.sp3}px ${pip.sp4}px`,
                    borderBottom: `1px solid ${pip.amberFaint}`,
                    display: 'flex', alignItems: 'center', gap: pip.sp3,
                }}>
                    <span style={{
                        fontSize: pip.textLg, fontWeight: 700,
                        letterSpacing: 1,
                        textShadow: glowText(pip.amber, 6),
                    }}>
                        {'\u25B8'} SET ENEMY HEROES
                    </span>
                    <span style={{
                        flex: 1,
                        fontSize: pip.textSm,
                        color: pip.amber,
                    }}>
                        Click up to 5 enemies. Press Esc or click outside to cancel.
                    </span>
                    <button
                        onClick={onClose}
                        aria-label="Close enemy picker"
                        style={{
                            background: 'transparent',
                            border: `1px solid ${pip.amberFaint}`,
                            color: pip.amber,
                            padding: '6px 12px',
                            fontFamily: pip.font, fontSize: pip.textSm,
                            cursor: 'pointer',
                            minHeight: 32,
                        }}
                    >
                        CLOSE
                    </button>
                </div>

                {/* Search bar */}
                <div style={{ padding: `${pip.sp3}px ${pip.sp4}px` }}>
                    <input
                        type="text"
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                        placeholder="Search heroes…"
                        aria-label="Filter heroes"
                        autoFocus
                        style={{
                            width: '100%',
                            padding: '10px 12px',
                            background: pip.bgDeep,
                            border: `1px solid ${pip.amberFaint}`,
                            color: pip.amber,
                            fontFamily: pip.font,
                            fontSize: pip.textBase,
                            outline: 'none',
                        }}
                    />
                </div>

                {/* Selected strip */}
                {selected.length > 0 && (
                    <div style={{
                        padding: `0 ${pip.sp4}px ${pip.sp3}px`,
                        display: 'flex', gap: pip.sp2, flexWrap: 'wrap',
                    }}>
                        {selected.map(name => {
                            const entry = heroes.find(h => h.name === name);
                            return (
                                <button
                                    key={name}
                                    onClick={() => toggleHero(name)}
                                    aria-label={`Remove ${entry?.display ?? name}`}
                                    style={{
                                        background: pip.bgInset,
                                        border: `1px solid ${pip.amber}`,
                                        color: pip.amber,
                                        padding: '6px 12px',
                                        fontFamily: pip.font, fontSize: pip.textSm,
                                        cursor: 'pointer',
                                        textShadow: glowText(pip.amber, 4),
                                    }}
                                >
                                    {entry?.display ?? name} ×
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Hero grid */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: `${pip.sp2}px ${pip.sp4}px`,
                    borderTop: `1px solid ${pip.amberGhost}`,
                }}>
                    {loading && (
                        <div style={{
                            padding: pip.sp5, textAlign: 'center',
                            color: pip.amber, fontSize: pip.textBase,
                        }}>
                            Loading hero list…
                        </div>
                    )}
                    {error && (
                        <div style={{
                            padding: pip.sp4, textAlign: 'center',
                            color: pip.red, fontSize: pip.textBase,
                            border: `1px solid ${pip.red}`,
                            margin: pip.sp3,
                        }}>
                            {error}
                        </div>
                    )}
                    {!loading && !error && filtered.length === 0 && heroes.length > 0 && (
                        <div style={{
                            padding: pip.sp5, textAlign: 'center',
                            color: pip.amber, fontSize: pip.textBase,
                        }}>
                            No heroes match "{filter}"
                        </div>
                    )}
                    {!loading && !error && filtered.length > 0 && (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))',
                            gap: pip.sp2,
                        }}>
                            {filtered.map(h => {
                                const isSelected = selected.includes(h.name);
                                return (
                                    <button
                                        key={h.name}
                                        onClick={() => toggleHero(h.name)}
                                        aria-label={`${isSelected ? 'Deselect' : 'Select'} ${h.display}`}
                                        aria-pressed={isSelected}
                                        style={{
                                            background: isSelected ? pip.bgInset : pip.bgDeep,
                                            border: `2px solid ${isSelected ? pip.amber : pip.amberFaint}`,
                                            padding: 4,
                                            cursor: 'pointer',
                                            display: 'flex', flexDirection: 'column',
                                            alignItems: 'center', gap: 4,
                                            minHeight: 84,  // ≥ 44 + portrait
                                            fontFamily: pip.font,
                                            color: pip.amber,
                                            boxShadow: isSelected ? glow(pip.amber, 8) : undefined,
                                            outline: 'none',
                                        }}
                                    >
                                        <img
                                            src={`${HERO_ICON_CDN}/${h.name}.png`}
                                            alt=""
                                            loading="lazy"
                                            onError={e => {
                                                (e.currentTarget as HTMLImageElement).style.opacity = '0.3';
                                            }}
                                            style={{
                                                width: 76, height: 43,
                                                objectFit: 'cover',
                                            }}
                                        />
                                        <span style={{
                                            fontSize: pip.textXs,
                                            color: pip.amber,
                                            textAlign: 'center',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            width: '100%',
                                        }}>
                                            {h.display}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer — primary action */}
                <div style={{
                    padding: pip.sp3,
                    borderTop: `1px solid ${pip.amberFaint}`,
                    display: 'flex', alignItems: 'center', gap: pip.sp3,
                }}>
                    <span style={{
                        flex: 1,
                        fontSize: pip.textSm,
                        color: pip.amber,
                    }}>
                        {selected.length} / 5 selected
                    </span>
                    <button
                        onClick={handleConfirm}
                        disabled={selected.length === 0 || submitting}
                        style={{
                            background: selected.length > 0 && !submitting ? pip.bgInset : pip.bgDeep,
                            border: `2px solid ${selected.length > 0 && !submitting ? pip.green : pip.amberGhost}`,
                            color: selected.length > 0 && !submitting ? pip.green : pip.amberGhost,
                            padding: '10px 20px',
                            fontFamily: pip.font,
                            fontSize: pip.textBase,
                            fontWeight: 700,
                            letterSpacing: 1,
                            cursor: selected.length > 0 && !submitting ? 'pointer' : 'not-allowed',
                            textShadow: selected.length > 0 && !submitting
                                ? glowText(pip.green, 4) : undefined,
                            boxShadow: selected.length > 0 && !submitting
                                ? glow(pip.green, 6) : undefined,
                            minHeight: 44,
                        }}
                    >
                        {submitting ? 'SENDING…' : 'CONFIRM'}
                    </button>
                </div>
            </div>
        </>
    );
}
