/** PriorityAction (Phase 1, #4) — ONE directive, WHY-first, broadcast language.
 *
 * Rebuilt from the old ActionBar: a single 44px directive with its reason as
 * the primary supporting line (Direction B "the reason is the tile"). The
 * pick comes from the PacingController (urgency outranks priority; role
 * reweights) — the old private 2-minute filter + reduce() moved there.
 */
import React from 'react';
import { Recommendation, HeroData, effectiveUrgency } from '../raijinTypes';
import { bcast, bLabel, bChip, bNum, asOf } from '../raijinTheme';
import { pickPriorityAction, Role } from '../pacing';

interface Props {
    recommendations: Recommendation[];
    heroData: HeroData | null;
    role?: Role | null;
    ttsEnabled?: boolean;
    ttsMuted?: boolean;
    onToggleMute?: () => void;
}

const CAT_LABEL: Record<Recommendation['category'], string> = {
    ITEM: 'Item', SKILL: 'Skill', TIMER: 'Timer', FIGHT: 'Fight', GENERAL: 'Coach',
};

export function RaijinActionBar({
    recommendations,
    heroData,
    role = null,
    ttsEnabled = false,
    ttsMuted = false,
    onToggleMute,
}: Props) {
    const now = Date.now();
    const action = pickPriorityAction(recommendations, now, role);
    const urgency = action ? effectiveUrgency(action) : 'ROUTINE';
    const isCritical = urgency === 'CRITICAL';
    const isDead = !!heroData && !heroData.alive;
    const accent = isCritical || isDead ? bcast.dire : bcast.gold;

    return (
        <section
            aria-label="Priority action"
            style={{
                position: 'relative',
                overflow: 'hidden',
                background: `radial-gradient(400px 160px at 12% 0%, ${isCritical || isDead ? 'rgba(255,89,100,.10)' : 'rgba(245,197,24,.10)'}, transparent 70%), linear-gradient(180deg, #1c212a, #161b22)`,
                border: `1px solid ${bcast.line}`,
                borderLeft: `4px solid ${accent}`,
                borderRadius: bcast.r,
                padding: '18px 20px 18px',
                fontFamily: bcast.body,
                minHeight: 132,
            }}
        >
            <style>{`
                @keyframes raijin-prio-ping {
                    0% { box-shadow: 0 0 0 0 ${isCritical || isDead ? 'rgba(255,89,100,.55)' : 'rgba(245,197,24,.55)'}; }
                    70%, 100% { box-shadow: 0 0 0 10px rgba(0,0,0,0); }
                }
                @media (prefers-reduced-motion: reduce) {
                    .raijin-prio-pulse { animation: none !important; }
                }
            `}</style>

            <div style={{
                display: 'flex', alignItems: 'center', gap: 9,
                ...bLabel,
                color: accent,
                fontWeight: 700,
                letterSpacing: '.16em',
            }}>
                <span
                    className="raijin-prio-pulse"
                    style={{
                        width: 9, height: 9, borderRadius: '50%',
                        background: accent,
                        animation: 'raijin-prio-ping 1.6s ease-out infinite',
                    }}
                />
                {isDead ? 'DEAD · USE THE TIMER' : isCritical ? 'CRITICAL · NOW' : 'PRIORITY ACTION · NOW'}
                {ttsEnabled && onToggleMute && (
                    <button
                        onClick={onToggleMute}
                        aria-label={ttsMuted ? 'Unmute voice coaching (Alt+M)' : 'Mute voice coaching (Alt+M)'}
                        style={{
                            marginLeft: 6,
                            background: ttsMuted ? 'rgba(255,89,100,.12)' : 'transparent',
                            border: `1px solid ${ttsMuted ? bcast.dire : bcast.line}`,
                            borderRadius: 999,
                            color: ttsMuted ? bcast.dire : bcast.muted,
                            padding: '2px 9px',
                            fontFamily: bcast.body,
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: '.06em',
                            cursor: 'pointer',
                        }}
                    >
                        {ttsMuted ? 'MUTED' : 'VOICE ON'}
                    </button>
                )}
            </div>

            {isDead ? (
                <>
                    <div style={{
                        fontFamily: bcast.display,
                        fontSize: bcast.tDirective,
                        lineHeight: 1.04,
                        fontWeight: 700,
                        margin: '10px 0 6px',
                        color: bcast.ink,
                    }}>
                        Spend your <span style={{ color: accent, ...bNum }}>{heroData!.gold}g</span> before respawn
                    </div>
                    <p style={{
                        margin: 0,
                        fontSize: bcast.tRec,
                        lineHeight: 1.42,
                        color: bcast.muted,
                        maxWidth: '60ch',
                    }}>
                        <b style={{ color: bcast.ink }}>Why:</b> buying from the fountain shop now converts dead time
                        into your next timing — the death panel has the coaching read.
                    </p>
                </>
            ) : action ? (
                <>
                    <div style={{
                        fontFamily: bcast.display,
                        fontSize: bcast.tDirective,
                        lineHeight: 1.04,
                        fontWeight: 700,
                        margin: '10px 0 6px',
                        color: isCritical ? bcast.dire : bcast.ink,
                        textWrap: 'balance' as never,
                    }}>
                        {action.title}
                    </div>
                    {(action.reason || action.body) && (
                        <p style={{
                            margin: 0,
                            fontSize: bcast.tRec,
                            lineHeight: 1.42,
                            color: bcast.ink,
                            maxWidth: '60ch',
                        }}>
                            <span style={{ color: bcast.goldDim, fontWeight: 600 }}>Why: </span>
                            {action.reason || action.body}
                        </p>
                    )}
                    <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                        <span style={bChip}>{CAT_LABEL[action.category] ?? action.category}</span>
                        <span style={{ ...bChip, ...bNum }}>as of {asOf(action.receivedAt)}</span>
                        {urgency !== 'ROUTINE' && (
                            <span style={{ ...bChip, color: isCritical ? bcast.dire : bcast.gold }}>{urgency}</span>
                        )}
                    </div>
                </>
            ) : (
                <div style={{
                    marginTop: 12,
                    fontSize: bcast.tRec,
                    color: bcast.muted,
                }}>
                    No live call — play your game. The next read lands here.
                </div>
            )}
        </section>
    );
}
