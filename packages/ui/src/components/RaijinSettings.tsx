/** RaijinSettings — gear-opened modal for TTS voice coaching settings.
 *
 * Controls: enable toggle, minimum urgency threshold (CRITICAL / IMPORTANT),
 * TEST VOICE button. All changes POST to /api/settings/tts; backend broadcasts
 * SETTINGS_UPDATE so any other open clients stay in sync.
 *
 * UX: 50% black scrim, modal pinned centre, Esc to close, all animations
 * respect prefers-reduced-motion. */
import React, { useEffect, useState, useCallback } from 'react';
import { pip, glow, glowText } from '../raijinTheme';
import { RAIJIN_API, RecUrgency } from '../raijinTypes';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface Props {
    open: boolean;
    onClose: () => void;
    enabled: boolean;
    muted: boolean;
    minUrgency: RecUrgency;
    onApply: (partial: { enabled?: boolean; muted?: boolean; min_urgency?: RecUrgency }) => Promise<void>;
}

export function RaijinSettings({
    open,
    onClose,
    enabled,
    muted,
    minUrgency,
    onApply,
}: Props) {
    const [busy, setBusy] = useState(false);
    const [testStatus, setTestStatus] = useState<string | null>(null);
    const modalRef = useFocusTrap<HTMLDivElement>(open);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    const handleToggle = useCallback(async () => {
        setBusy(true);
        try {
            await onApply({ enabled: !enabled });
        } finally {
            setBusy(false);
        }
    }, [enabled, onApply]);

    const handleUrgency = useCallback(
        async (next: RecUrgency) => {
            setBusy(true);
            try {
                await onApply({ min_urgency: next });
            } finally {
                setBusy(false);
            }
        },
        [onApply]
    );

    const handleTestVoice = useCallback(async () => {
        setTestStatus('Sending test rec…');
        try {
            // Send a synthetic critical rec via the POST /api/enemies debug path
            // by triggering a known backend endpoint. The simplest test is to
            // request the backend generate a sample TTS — we use /api/settings/tts
            // with no changes just to confirm the roundtrip works, and the user
            // validates real speech by starting a game.
            const resp = await fetch(`${RAIJIN_API}/api/settings`);
            if (resp.ok) {
                setTestStatus('OK — start a game to hear real CRITICAL recs');
            } else {
                setTestStatus('Backend unreachable');
            }
        } catch {
            setTestStatus('Backend unreachable');
        }
        setTimeout(() => setTestStatus(null), 4000);
    }, []);

    if (!open) return null;

    return (
        <>
            <style>{`
                @keyframes raijin-settings-fadein {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .raijin-settings-scrim,
                .raijin-settings-modal {
                    animation: raijin-settings-fadein 180ms ease-out;
                }
                @media (prefers-reduced-motion: reduce) {
                    .raijin-settings-scrim,
                    .raijin-settings-modal {
                        animation: none;
                    }
                }
            `}</style>
            <div
                className="raijin-settings-scrim"
                onClick={onClose}
                style={{
                    position: 'fixed', inset: 0,
                    background: 'rgba(0, 0, 0, 0.5)',
                    zIndex: 100,
                }}
            />
            <div
                ref={modalRef}
                className="raijin-settings-modal"
                role="dialog"
                aria-modal="true"
                aria-label="Raijin settings"
                style={{
                    position: 'fixed',
                    top: '20%', left: '50%',
                    transform: 'translateX(-50%)',
                    width: 'min(480px, 90vw)',
                    background: pip.bgPanel,
                    border: `2px solid ${pip.amber}`,
                    boxShadow: glow(pip.amber, 16),
                    color: pip.amber,
                    fontFamily: pip.font,
                    zIndex: 101,
                    padding: pip.sp4,
                }}
            >
                {/* Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: pip.sp3,
                    borderBottom: `1px solid ${pip.amberFaint}`,
                    paddingBottom: pip.sp3,
                    marginBottom: pip.sp3,
                }}>
                    <span style={{
                        fontSize: pip.textLg,
                        fontWeight: 700,
                        letterSpacing: 2,
                        textShadow: glowText(pip.amber, 6),
                    }}>
                        {'\u25B8'} RAIJIN SETTINGS
                    </span>
                    <span style={{ flex: 1 }} />
                    <button
                        onClick={onClose}
                        aria-label="Close settings"
                        style={{
                            background: 'transparent',
                            border: `1px solid ${pip.amberFaint}`,
                            color: pip.amber,
                            padding: '6px 12px',
                            fontFamily: pip.font,
                            fontSize: pip.textSm,
                            cursor: 'pointer',
                            minHeight: 32,
                        }}
                    >
                        CLOSE
                    </button>
                </div>

                {/* TTS enable toggle */}
                <SettingRow
                    label="Voice Coaching (TTS)"
                    description="Speaks CRITICAL recs using a Storm Spirit voice. Off by default."
                >
                    <button
                        onClick={handleToggle}
                        disabled={busy}
                        aria-pressed={enabled}
                        style={{
                            background: enabled ? pip.bgInset : pip.bgDeep,
                            border: `2px solid ${enabled ? pip.green : pip.amberFaint}`,
                            color: enabled ? pip.green : pip.amber,
                            padding: '8px 16px',
                            fontFamily: pip.font,
                            fontSize: pip.textBase,
                            fontWeight: 700,
                            letterSpacing: 1,
                            cursor: busy ? 'wait' : 'pointer',
                            minHeight: 44,
                            textShadow: enabled ? glowText(pip.green, 4) : undefined,
                            boxShadow: enabled ? glow(pip.green, 4) : undefined,
                        }}
                    >
                        {enabled ? 'ON' : 'OFF'}
                    </button>
                </SettingRow>

                {/* Urgency threshold */}
                {enabled && (
                    <SettingRow
                        label="Minimum Urgency"
                        description="Only speak recs at or above this tier. CRITICAL is the safest default."
                    >
                        <div style={{ display: 'flex', gap: pip.sp2 }}>
                            {(['CRITICAL', 'IMPORTANT'] as const).map(tier => {
                                const active = minUrgency === tier;
                                return (
                                    <button
                                        key={tier}
                                        onClick={() => handleUrgency(tier)}
                                        disabled={busy}
                                        aria-pressed={active}
                                        style={{
                                            background: active ? pip.bgInset : pip.bgDeep,
                                            border: `2px solid ${active ? pip.amber : pip.amberFaint}`,
                                            color: active ? pip.amber : pip.amberFaint,
                                            padding: '8px 14px',
                                            fontFamily: pip.font,
                                            fontSize: pip.textSm,
                                            fontWeight: 700,
                                            letterSpacing: 1,
                                            cursor: busy ? 'wait' : 'pointer',
                                            minHeight: 44,
                                            textShadow: active ? glowText(pip.amber, 4) : undefined,
                                        }}
                                    >
                                        {tier}
                                    </button>
                                );
                            })}
                        </div>
                    </SettingRow>
                )}

                {/* Mute state reference */}
                {enabled && (
                    <div style={{
                        marginTop: pip.sp3,
                        padding: pip.sp2,
                        background: pip.bgDeep,
                        border: `1px solid ${pip.amberGhost}`,
                        fontSize: pip.textSm,
                        color: pip.amber,
                    }}>
                        Tip: mute in-game with the <strong>TTS ON</strong> button in the action bar.
                        {muted && (
                            <span style={{ color: pip.red, marginLeft: pip.sp2 }}>
                                (currently MUTED)
                            </span>
                        )}
                    </div>
                )}

                {/* Test voice button */}
                {enabled && (
                    <div style={{ marginTop: pip.sp4, textAlign: 'center' }}>
                        <button
                            onClick={handleTestVoice}
                            disabled={busy}
                            style={{
                                background: pip.bgInset,
                                border: `2px solid ${pip.amber}`,
                                color: pip.amber,
                                padding: '10px 20px',
                                fontFamily: pip.font,
                                fontSize: pip.textBase,
                                fontWeight: 700,
                                letterSpacing: 1,
                                cursor: busy ? 'wait' : 'pointer',
                                minHeight: 44,
                                textShadow: glowText(pip.amber, 4),
                            }}
                        >
                            TEST BACKEND
                        </button>
                        {testStatus && (
                            <div style={{
                                marginTop: pip.sp2,
                                fontSize: pip.textSm,
                                color: pip.amber,
                            }}>
                                {testStatus}
                            </div>
                        )}
                    </div>
                )}

                {/* Phase 5b.3 keyboard shortcuts footer */}
                <div style={{
                    marginTop: pip.sp4,
                    paddingTop: pip.sp3,
                    borderTop: `1px solid ${pip.amberGhost}`,
                    fontSize: pip.textSm,
                    color: pip.amber,
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: pip.sp3,
                }}>
                    <span style={{ color: pip.amberFaint, letterSpacing: 1 }}>SHORTCUTS</span>
                    <span><kbd style={{ color: pip.amber }}>Alt+M</kbd> mute</span>
                    <span><kbd style={{ color: pip.amber }}>Alt+S</kbd> settings</span>
                    <span><kbd style={{ color: pip.amber }}>Alt+H</kbd> history</span>
                    <span><kbd style={{ color: pip.amber }}>Esc</kbd> close</span>
                </div>
            </div>
        </>
    );
}

function SettingRow({
    label,
    description,
    children,
}: {
    label: string;
    description?: string;
    children: React.ReactNode;
}) {
    return (
        <div style={{
            display: 'flex', alignItems: 'center',
            gap: pip.sp4,
            padding: `${pip.sp2}px 0`,
            borderBottom: `1px solid ${pip.amberGhost}`,
        }}>
            <div style={{ flex: 1 }}>
                <div style={{
                    fontSize: pip.textBase,
                    fontWeight: 700,
                    color: pip.amber,
                }}>
                    {label}
                </div>
                {description && (
                    <div style={{
                        fontSize: pip.textSm,
                        color: pip.amber,  // not amberDim — AA contrast
                        marginTop: 2,
                        lineHeight: 1.4,
                    }}>
                        {description}
                    </div>
                )}
            </div>
            {children}
        </div>
    );
}
