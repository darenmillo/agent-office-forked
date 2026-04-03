/** Raijin Recs — Pip-Boy New Vegas / Brutalist Design Tokens */
import type { CSSProperties } from 'react';

export const pip = {
    // ── Amber palette (Pip-Boy phosphor) ──
    amber:       '#FFB000',
    amberBright: '#FFD54F',
    amberDim:    '#B8860B',
    amberFaint:  '#5C4510',
    amberGhost:  '#3D2E0A',

    // ── Backgrounds ──
    bgDeep:      '#0D0D08',
    bgPanel:     '#151510',
    bgInset:     '#1C1C14',
    bgHover:     '#252518',

    // ── Semantic ──
    red:         '#FF4136',
    redDim:      '#A32B23',
    green:       '#2ECC40',
    greenDim:    '#1B8A2A',
    blue:        '#7FDBFF',
    blueDim:     '#4A8BA4',

    // ── Category accents ──
    catItem:     '#E8A317',
    catTimer:    '#4CAF50',
    catFight:    '#FF5252',
    catCoach:    '#90A4AE',
    catRecent:   '#6D5C1A',

    // ── Typography ──
    font: "'Share Tech Mono', 'Courier New', monospace",

    // Type scale (px)
    textXs:  10,
    textSm:  12,
    textBase: 14,
    textMd:  16,
    textLg:  20,
    textXl:  24,
    text2xl: 32,

    // ── Spacing (4px grid) ──
    sp1: 4,
    sp2: 8,
    sp3: 12,
    sp4: 16,
    sp5: 20,
    sp6: 24,
    sp8: 32,
} as const;

/** Phosphor glow for box-shadow */
export function glow(color: string = pip.amber, size = 6): string {
    return `0 0 ${size}px ${color}`;
}

/** Phosphor glow for text-shadow */
export function glowText(color: string = pip.amber, size = 4): string {
    return `0 0 ${size}px ${color}88`;
}

/** CRT scanline overlay — apply as backgroundImage on a positioned overlay div */
export const scanlines = `repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(0, 0, 0, 0.05) 2px,
    rgba(0, 0, 0, 0.05) 4px
)`;

/** Shared panel base — brutalist: no border-radius, heavy border */
export const panelBase: CSSProperties = {
    background: pip.bgPanel,
    border: `2px solid ${pip.amberFaint}`,
    borderRadius: 0,
    padding: pip.sp4,
    fontFamily: pip.font,
    position: 'relative',
};

/** Uppercase mono label */
export const labelStyle: CSSProperties = {
    fontSize: pip.textSm,
    fontWeight: 700,
    color: pip.amberDim,
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontFamily: pip.font,
};
