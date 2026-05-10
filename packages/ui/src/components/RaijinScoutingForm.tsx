/** RaijinScoutingForm — pre-game / mid-game scouting modal (v5.0).
 *
 * Captures user-provided context that GSI can't see:
 *  - my hero + role + lane (drives multi-role HeroKnowledge selection)
 *  - 4 ally hero+role rows
 *  - 5 enemy hero+role rows
 *
 * Submits to POST /api/scouting (Raijin Phase 3 backend). Last submission is
 * persisted to localStorage so re-queue is fast.
 *
 * Auto-opens once per game when no scouting context exists. Re-openable
 * manually from the action bar; can also be re-submitted on death to update
 * mid-game enemy roles.
 *
 * Pip-Boy phosphor styling matches RaijinEnemyPicker. WCAG AA-compliant
 * amber palette. Honors prefers-reduced-motion. */
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { pip, glow, glowText } from '../raijinTheme';
import { HeroListEntry, RAIJIN_API } from '../raijinTypes';
import { useFocusTrap } from '../hooks/useFocusTrap';

const STORAGE_KEY = 'raijin.scouting.v5';

const ROLES = [
    { value: 'carry',         label: 'Carry (1)' },
    { value: 'mid',           label: 'Mid (2)' },
    { value: 'offlane',       label: 'Offlane (3)' },
    { value: 'soft_support',  label: 'Soft Sup (4)' },
    { value: 'hard_support',  label: 'Hard Sup (5)' },
] as const;

const LANES = [
    { value: '',     label: '— pick lane —' },
    { value: 'safe', label: 'Safe lane' },
    { value: 'mid',  label: 'Mid' },
    { value: 'off',  label: 'Off lane' },
    { value: 'jungle', label: 'Jungle' },
    { value: 'roam', label: 'Roaming' },
] as const;

type Role = typeof ROLES[number]['value'];

interface PlayerRow {
    hero: string;
    role: Role | '';
}

interface ScoutingState {
    my_hero: string;
    my_role: Role | '';
    my_lane: string;
    allies: PlayerRow[];   // length 4
    enemies: PlayerRow[];  // length 5
}

const EMPTY_ROW: PlayerRow = { hero: '', role: '' };
const INITIAL_STATE: ScoutingState = {
    my_hero: '',
    my_role: '',
    my_lane: '',
    allies: [EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW],
    enemies: [EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW, EMPTY_ROW],
};

function loadFromStorage(): ScoutingState {
    if (typeof window === 'undefined') return INITIAL_STATE;
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return INITIAL_STATE;
        const parsed = JSON.parse(raw) as Partial<ScoutingState>;
        return {
            my_hero: parsed.my_hero ?? '',
            my_role: (parsed.my_role as Role | '') ?? '',
            my_lane: parsed.my_lane ?? '',
            allies: Array.isArray(parsed.allies) && parsed.allies.length === 4
                ? parsed.allies.map(r => ({ hero: r?.hero ?? '', role: (r?.role as Role | '') ?? '' }))
                : INITIAL_STATE.allies,
            enemies: Array.isArray(parsed.enemies) && parsed.enemies.length === 5
                ? parsed.enemies.map(r => ({ hero: r?.hero ?? '', role: (r?.role as Role | '') ?? '' }))
                : INITIAL_STATE.enemies,
        };
    } catch {
        return INITIAL_STATE;
    }
}

function saveToStorage(state: ScoutingState): void {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
        // localStorage quota exceeded or disabled — fail silently, form still works
    }
}

interface Props {
    open: boolean;
    onClose: () => void;
    /** Called after a successful POST so the parent can reflect new state. */
    onConfirm: (payload: {
        my_hero: string;
        my_role: Role | '';
        my_lane: string;
        allies: PlayerRow[];
        enemies: PlayerRow[];
    }) => void;
}

export function RaijinScoutingForm({ open, onClose, onConfirm }: Props) {
    const [state, setState] = useState<ScoutingState>(loadFromStorage);
    const [heroes, setHeroes] = useState<HeroListEntry[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const modalRef = useFocusTrap<HTMLDivElement>(open);

    // Fetch hero list once when opened (cache across opens)
    useEffect(() => {
        if (!open || heroes.length > 0) return;
        let cancelled = false;
        fetch(`${RAIJIN_API}/api/heroes`)
            .then(r => r.json())
            .then((data: { heroes?: HeroListEntry[] }) => {
                if (!cancelled) setHeroes(data.heroes ?? []);
            })
            .catch(() => {
                if (!cancelled) setError('Could not load hero list. Is the Raijin engine running?');
            });
        return () => { cancelled = true; };
    }, [open, heroes.length]);

    // Escape key closes
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    // Reset transient state when closed
    useEffect(() => {
        if (!open) {
            setSubmitting(false);
            setError(null);
        }
    }, [open]);

    const heroOptions = useMemo(() =>
        heroes.map(h => ({ value: h.name, label: h.display })),
        [heroes],
    );

    const heroDisplayMap = useMemo(() => {
        const m = new Map<string, string>();
        for (const h of heroes) m.set(h.name, h.display);
        return m;
    }, [heroes]);

    /** Convert a free-text input to a canonical hero name (key).
     *  Accepts both display name ("Storm Spirit") and key ("storm_spirit"). */
    const canonicalize = useCallback((input: string): string => {
        const trimmed = input.trim();
        if (!trimmed) return '';
        // Already canonical (matches a known key)?
        if (heroDisplayMap.has(trimmed.toLowerCase())) return trimmed.toLowerCase();
        // Match against display names (case-insensitive)
        const match = heroes.find(h => h.display.toLowerCase() === trimmed.toLowerCase());
        if (match) return match.name;
        // Best-effort: lowercase + underscore
        return trimmed.toLowerCase().replace(/\s+/g, '_');
    }, [heroes, heroDisplayMap]);

    const handleSubmit = useCallback(async () => {
        if (submitting) return;
        setSubmitting(true);
        setError(null);

        // Build the API payload: drop empty rows; canonicalize hero names.
        const cleanAllies = state.allies
            .filter(r => r.hero.trim() && r.role)
            .map(r => ({ hero: canonicalize(r.hero), role: r.role as Role }));
        const cleanEnemies = state.enemies
            .filter(r => r.hero.trim() && r.role)
            .map(r => ({ hero: canonicalize(r.hero), role: r.role as Role }));

        const payload: Record<string, unknown> = {};
        if (state.my_hero.trim()) payload.my_hero = canonicalize(state.my_hero);
        if (state.my_role) payload.my_role = state.my_role;
        if (state.my_lane) payload.my_lane = state.my_lane;
        if (cleanAllies.length > 0) payload.allies = cleanAllies;
        if (cleanEnemies.length > 0) payload.enemies = cleanEnemies;

        try {
            const resp = await fetch(`${RAIJIN_API}/api/scouting`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!resp.ok) {
                const data = await resp.json().catch(() => ({}));
                throw new Error(data.error || `HTTP ${resp.status}`);
            }
            saveToStorage(state);
            onConfirm({
                my_hero: state.my_hero,
                my_role: state.my_role,
                my_lane: state.my_lane,
                allies: state.allies,
                enemies: state.enemies,
            });
            onClose();
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Failed to submit scouting';
            setError(msg);
        } finally {
            setSubmitting(false);
        }
    }, [state, submitting, canonicalize, onConfirm, onClose]);

    const updateAlly = useCallback((idx: number, patch: Partial<PlayerRow>) => {
        setState(prev => ({
            ...prev,
            allies: prev.allies.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
        }));
    }, []);

    const updateEnemy = useCallback((idx: number, patch: Partial<PlayerRow>) => {
        setState(prev => ({
            ...prev,
            enemies: prev.enemies.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
        }));
    }, []);

    const clearAll = useCallback(() => {
        setState(INITIAL_STATE);
    }, []);

    if (!open) return null;

    return (
        <>
            <style>{`
                @keyframes raijin-scouting-fadein { from { opacity: 0; } to { opacity: 1; } }
                @keyframes raijin-scouting-slidein {
                    from { opacity: 0; transform: translateY(-6px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                .raijin-scouting-scrim { animation: raijin-scouting-fadein 180ms ease-out; }
                .raijin-scouting-modal { animation: raijin-scouting-slidein 220ms ease-out; }
                @media (prefers-reduced-motion: reduce) {
                    .raijin-scouting-scrim, .raijin-scouting-modal { animation: none; }
                }
            `}</style>

            <div
                className="raijin-scouting-scrim"
                onClick={onClose}
                style={{
                    position: 'fixed', inset: 0,
                    background: 'rgba(0, 0, 0, 0.5)',
                    zIndex: 100,
                }}
            />

            <div
                ref={modalRef}
                className="raijin-scouting-modal"
                role="dialog"
                aria-modal="true"
                aria-label="Scouting report — set hero roles before queuing"
                style={{
                    position: 'fixed',
                    top: '6%', left: '50%',
                    transform: 'translateX(-50%)',
                    width: 'min(820px, 95vw)',
                    maxHeight: '88vh',
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
                        fontSize: pip.textLg, fontWeight: 700, letterSpacing: 1,
                        textShadow: glowText(pip.amber, 6),
                    }}>
                        {'▸'} SCOUTING REPORT
                    </span>
                    <span style={{ flex: 1, fontSize: pip.textSm, color: pip.amber }}>
                        Tag heroes + roles. Esc or click outside to close.
                    </span>
                    <button
                        onClick={clearAll}
                        aria-label="Clear all fields"
                        style={{
                            background: 'transparent',
                            border: `1px solid ${pip.amberFaint}`,
                            color: pip.amber,
                            padding: '6px 12px',
                            fontFamily: pip.font, fontSize: pip.textSm,
                            cursor: 'pointer', minHeight: 32,
                        }}
                    >
                        CLEAR
                    </button>
                    <button
                        onClick={onClose}
                        aria-label="Close scouting form"
                        style={{
                            background: 'transparent',
                            border: `1px solid ${pip.amberFaint}`,
                            color: pip.amber,
                            padding: '6px 12px',
                            fontFamily: pip.font, fontSize: pip.textSm,
                            cursor: 'pointer', minHeight: 32,
                        }}
                    >
                        CLOSE
                    </button>
                </div>

                {/* Datalist for hero autocomplete (shared by all hero inputs) */}
                <datalist id="raijin-hero-list">
                    {heroOptions.map(o => (
                        <option key={o.value} value={o.label} />
                    ))}
                </datalist>

                {/* Body — scrollable */}
                <div style={{
                    flex: 1, overflowY: 'auto',
                    padding: pip.sp4, display: 'flex', flexDirection: 'column', gap: pip.sp4,
                }}>
                    {/* MY HERO row */}
                    <FormSection title="MY HERO + ROLE">
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: '2fr 1.2fr 1fr',
                            gap: pip.sp2,
                        }}>
                            <HeroInput
                                value={state.my_hero}
                                onChange={v => setState(prev => ({ ...prev, my_hero: v }))}
                                placeholder="Your hero (e.g. Necrophos)"
                            />
                            <RoleSelect
                                value={state.my_role}
                                onChange={v => setState(prev => ({ ...prev, my_role: v }))}
                            />
                            <LaneSelect
                                value={state.my_lane}
                                onChange={v => setState(prev => ({ ...prev, my_lane: v }))}
                            />
                        </div>
                    </FormSection>

                    {/* ALLIES — 4 rows */}
                    <FormSection title="ALLIES (4)">
                        {state.allies.map((row, i) => (
                            <div
                                key={`ally-${i}`}
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: '2fr 1.5fr',
                                    gap: pip.sp2,
                                    marginBottom: pip.sp1,
                                }}
                            >
                                <HeroInput
                                    value={row.hero}
                                    onChange={v => updateAlly(i, { hero: v })}
                                    placeholder={`Ally ${i + 1}`}
                                />
                                <RoleSelect
                                    value={row.role}
                                    onChange={v => updateAlly(i, { role: v })}
                                />
                            </div>
                        ))}
                    </FormSection>

                    {/* ENEMIES — 5 rows */}
                    <FormSection title="ENEMIES (5)">
                        {state.enemies.map((row, i) => (
                            <div
                                key={`enemy-${i}`}
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: '2fr 1.5fr',
                                    gap: pip.sp2,
                                    marginBottom: pip.sp1,
                                }}
                            >
                                <HeroInput
                                    value={row.hero}
                                    onChange={v => updateEnemy(i, { hero: v })}
                                    placeholder={`Enemy ${i + 1}`}
                                />
                                <RoleSelect
                                    value={row.role}
                                    onChange={v => updateEnemy(i, { role: v })}
                                />
                            </div>
                        ))}
                    </FormSection>

                    {error && (
                        <div style={{
                            padding: pip.sp3,
                            border: `1px solid ${pip.red}`,
                            color: pip.red,
                            fontSize: pip.textSm,
                        }}>
                            {error}
                        </div>
                    )}
                </div>

                {/* Footer — submit */}
                <div style={{
                    padding: pip.sp3,
                    borderTop: `1px solid ${pip.amberFaint}`,
                    display: 'flex', alignItems: 'center', gap: pip.sp3,
                }}>
                    <span style={{ flex: 1, fontSize: pip.textSm, color: pip.amber }}>
                        Empty rows skipped. You can update mid-game on death.
                    </span>
                    <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        style={{
                            background: !submitting ? pip.bgInset : pip.bgDeep,
                            border: `2px solid ${!submitting ? pip.green : pip.amberGhost}`,
                            color: !submitting ? pip.green : pip.amberGhost,
                            padding: '10px 20px',
                            fontFamily: pip.font,
                            fontSize: pip.textBase,
                            fontWeight: 700,
                            letterSpacing: 1,
                            cursor: !submitting ? 'pointer' : 'not-allowed',
                            textShadow: !submitting ? glowText(pip.green, 4) : undefined,
                            boxShadow: !submitting ? glow(pip.green, 6) : undefined,
                            minHeight: 44,
                        }}
                    >
                        {submitting ? 'SENDING…' : 'SUBMIT SCOUTING'}
                    </button>
                </div>
            </div>
        </>
    );
}

// ─────────────────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────────────────

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div>
            <div style={{
                fontSize: pip.textSm,
                fontWeight: 700,
                color: pip.amberDim,
                letterSpacing: 2,
                textTransform: 'uppercase',
                marginBottom: pip.sp2,
            }}>
                {title}
            </div>
            {children}
        </div>
    );
}

function HeroInput({ value, onChange, placeholder }: {
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
}) {
    return (
        <input
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            list="raijin-hero-list"
            spellCheck={false}
            autoCapitalize="words"
            style={{
                width: '100%',
                padding: '8px 10px',
                background: pip.bgDeep,
                border: `1px solid ${pip.amberFaint}`,
                color: pip.amber,
                fontFamily: pip.font,
                fontSize: pip.textBase,
                outline: 'none',
                minHeight: 36,
            }}
        />
    );
}

function RoleSelect({ value, onChange }: {
    value: string;
    onChange: (v: Role | '') => void;
}) {
    return (
        <select
            value={value}
            onChange={e => onChange(e.target.value as Role | '')}
            aria-label="Role"
            style={{
                width: '100%',
                padding: '8px 10px',
                background: pip.bgDeep,
                border: `1px solid ${pip.amberFaint}`,
                color: pip.amber,
                fontFamily: pip.font,
                fontSize: pip.textBase,
                outline: 'none',
                minHeight: 36,
            }}
        >
            <option value="">— role —</option>
            {ROLES.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
            ))}
        </select>
    );
}

function LaneSelect({ value, onChange }: {
    value: string;
    onChange: (v: string) => void;
}) {
    return (
        <select
            value={value}
            onChange={e => onChange(e.target.value)}
            aria-label="Lane"
            style={{
                width: '100%',
                padding: '8px 10px',
                background: pip.bgDeep,
                border: `1px solid ${pip.amberFaint}`,
                color: pip.amber,
                fontFamily: pip.font,
                fontSize: pip.textBase,
                outline: 'none',
                minHeight: 36,
            }}
        >
            {LANES.map(l => (
                <option key={l.value} value={l.value}>{l.label}</option>
            ))}
        </select>
    );
}
