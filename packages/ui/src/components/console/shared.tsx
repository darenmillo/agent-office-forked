/** Shared CONSOLE zone primitives — label rows, pulse dots, keyframes. */
import React from 'react';
import { console_, czLabel, czMicro } from '../../raijinTheme';

/** Zone label row: `01 · DIRECTIVE` left, optional annotation right. */
export function ZoneLabel({ label, right }: { label: string; right?: React.ReactNode }) {
    return (
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <span style={czLabel}>{label}</span>
            {right}
        </div>
    );
}

/** Micro annotation (right side of zone label rows). */
export function Micro({ children, color }: { children: React.ReactNode; color?: string }) {
    return <span style={{ ...czMicro, ...(color ? { color } : {}) }}>{children}</span>;
}

/** 7px pulsing status dot (ping keyframes live in ConsoleKeyframes). */
export function PulseDot({ color, anim }: { color: string; anim: 'a' | 'd' }) {
    return (
        <span
            className={`console-ping-${anim}`}
            style={{ width: 7, height: 7, background: color, display: 'inline-block', flex: 'none' }}
        />
    );
}

/** Status flag: pulse dot + tracked label (`● LIVE`, `● SPIKE REACHED`). */
export function StatusFlag({ color, anim, label }: { color: string; anim: 'a' | 'd'; label: string }) {
    return (
        <span style={{
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 11, letterSpacing: '.2em', color, fontFamily: console_.mono,
        }}>
            <PulseDot color={color} anim={anim} />
            {label}
        </span>
    );
}

/** One style block for the whole board — ping keyframes + reduced-motion off. */
export function ConsoleKeyframes() {
    return (
        <style>{`
            @keyframes console-ping-a { 0% { box-shadow: 0 0 0 0 rgba(255,176,0,.5); } 70%, 100% { box-shadow: 0 0 0 12px rgba(0,0,0,0); } }
            @keyframes console-ping-d { 0% { box-shadow: 0 0 0 0 rgba(255,89,100,.5); } 70%, 100% { box-shadow: 0 0 0 12px rgba(0,0,0,0); } }
            .console-ping-a { animation: console-ping-a 1.8s ease-out infinite; }
            .console-ping-d { animation: console-ping-d 1.6s ease-out infinite; }
            .console-fade { transition: opacity 220ms ${console_.ease}; }
            @media (prefers-reduced-motion: reduce) {
                .console-ping-a, .console-ping-d { animation: none !important; }
                .console-fade { transition: none !important; }
                .console-player-pulse animate { display: none; }
            }
        `}</style>
    );
}

/** Tabular numerals everywhere digits tick. */
export const tnum: React.CSSProperties = {
    fontVariantNumeric: 'tabular-nums',
    fontFeatureSettings: '"tnum" 1',
};
