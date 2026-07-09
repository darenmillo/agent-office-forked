/** Raijin Recs — design tokens.
 *
 * v2 (Phase 1 overhaul): `bcast` is the live token set — Direction B
 * esports-broadcast (spine) executed with Direction C's stance-color model.
 * Source of truth: playground/raijin-direction-b-broadcast.html (palette,
 * type scale) + raijin-direction-c-voice.html (stance colors).
 * The legacy `pip` set remains for not-yet-migrated surfaces (modals,
 * TeamIntel) and the A-skin MATCH DOSSIER option — do not delete it.
 */
import type { CSSProperties } from 'react';

// ── v3 CONSOLE TOKENS ──────────────────────────────────────────────────
// Direction: RAIJIN CONSOLE (2026-07-08 handoff) — instrument panel: numbered
// zones, hairline rules, no boxes, radius 0, no shadows, one amber accent.
// Source of truth: "Retro futurism UI design/design_handoff_raijin_console".
export const console_ = {
    // Palette
    base:   '#0B0C0E',   // board background
    base2:  '#08090B',   // tape strip background
    line:   '#21252B',   // primary hairline rules (zone separators)
    line2:  '#171A1F',   // secondary hairlines (in-zone rows, chart grid)
    ink:    '#EDF1F6',   // headline text
    body:   '#C9D1DA',   // primary text
    muted:  '#7E8896',   // secondary/reading text
    chrome: '#4A525E',   // zone labels, header meta — never coaching content
    ghost:  '#2A3038',   // inert annotations, deselected states
    ghostLine: '#3A414B', // median-curve stroke
    amber:  '#FFB000',   // THE accent: directive emphasis, progress, YOU, NOW
    gold:   '#F5C518',   // imminent windows (Rosh pending, situational header)
    dire:   '#FF5964',   // enemy / danger / CRITICAL / deaths
    radiant:'#3BE0A0',   // positive / ready / complete
    blue:   '#5AA9FF',   // neutral timers (stack, rune)
    river:  '#2A3B4D',   // map schematic river band

    stanceFarm:  '#4FA3FF',
    stanceFight: '#FF6A3D',
    stancePush:  '#F5C518',

    // Typography
    display: "'Chakra Petch', 'Bahnschrift', 'Segoe UI', sans-serif",
    mono: "'IBM Plex Mono', ui-monospace, Consolas, monospace", // DEFAULT board font
    reading: "Inter, 'Segoe UI', system-ui, sans-serif",

    // Type scale (px) — per handoff README
    tZone: 11,        // zone label (tracking .26em, uppercase, chrome)
    tMicro: 10,       // micro-annotation (.18–.22em)
    tTimecode: 12,
    tCaption: 13,     // 13–13.5 Inter captions
    tLog: 15.5,       // log rows (reading-distance floor)
    tReading: 16,     // why-lines
    tStanceAlt: 19,   // inactive stance words
    tClock: 17,       // header clock
    tThreat: 20,      // threat name (Chakra)
    tGap: 36,         // gap numeral (Chakra)
    tStance: 40,      // stance word (Chakra)
    tDirective: 52,   // directive (Chakra, lh 1.02, tracking .005em)

    ease: 'cubic-bezier(.2,.7,.3,1)',
} as const;

/** Zone label row text — `01 · DIRECTIVE` style. */
export const czLabel: CSSProperties = {
    fontSize: console_.tZone,
    letterSpacing: '.26em',
    color: console_.chrome,
    fontFamily: console_.mono,
    textTransform: 'uppercase',
};

/** Micro annotation (ghost) — right side of zone label rows. */
export const czMicro: CSSProperties = {
    fontSize: console_.tMicro,
    letterSpacing: '.18em',
    color: console_.ghost,
    fontFamily: console_.mono,
    textTransform: 'uppercase',
};

export function consoleStanceColor(stance: 'FARM' | 'FIGHT' | 'PUSH' | string): string {
    switch (stance) {
        case 'FARM': return console_.stanceFarm;
        case 'FIGHT': return console_.stanceFight;
        case 'PUSH': return console_.stancePush;
        default: return console_.muted;
    }
}

// ── v2 BROADCAST TOKENS ────────────────────────────────────────────────
export const bcast = {
    // Palette (WCAG-AA verified pairs on base)
    base:     '#0B0E12',
    base2:    '#10141A',
    panel:    '#1A1F26',
    panel2:   '#222933',
    line:     '#2C333D',
    ink:      '#E6EAF0',   // primary text  ~13:1 on base
    muted:    '#8A94A6',   // secondary     ~5.6:1 on base
    faint:    '#5C6675',   // tertiary/chrome only — never live coaching text
    radiant:  '#3BE0A0',   // allies / positive
    dire:     '#FF5964',   // enemies / danger / CRITICAL
    gold:     '#F5C518',   // THE one signal accent — priority action only
    goldDim:  '#C9A016',
    blue:     '#5AA9FF',   // timers / neutral info

    // Stance colors (Direction C: the palette IS the stance)
    stanceFarm:  '#4FA3FF',
    stanceFight: '#FF6A3D',
    stancePush:  '#F5C518',

    // Typography — broadcast grotesk for directives, humanist for body
    display: "'Chakra Petch', 'Bahnschrift', 'Segoe UI', sans-serif",
    body: "Inter, 'Segoe UI', system-ui, sans-serif",

    // Distance-first type scale (px) — 16 hard floor for live-glance text.
    // Acceptance: legible at 100% zoom on a second monitor at desk distance.
    tLabel: 13,      // uppercase chips/labels (never coaching content)
    tSub: 15,        // secondary lines
    tBody: 16,       // floor for any live-glance text
    tRec: 18,        // rec titles
    tStance: 28,     // stance word
    tDirective: 44,  // the one priority directive
    tNumeral: 60,    // respawn/score hero numerals

    // Spacing (4px grid)
    sp1: 4, sp2: 8, sp3: 12, sp4: 16, sp5: 20, sp6: 24, sp8: 32,

    // Radii + motion
    r: 10,
    rSm: 7,
    ease: 'cubic-bezier(.2,.7,.3,1)',
    tFast: '150ms',
    tSlide: '220ms',
} as const;

export function stanceColor(stance: 'FARM' | 'FIGHT' | 'PUSH' | string): string {
    switch (stance) {
        case 'FARM': return bcast.stanceFarm;
        case 'FIGHT': return bcast.stanceFight;
        case 'PUSH': return bcast.stancePush;
        default: return bcast.muted;
    }
}

/** Raised broadcast panel. */
export const bPanel: CSSProperties = {
    background: bcast.panel,
    border: `1px solid ${bcast.line}`,
    borderRadius: bcast.r,
    fontFamily: bcast.body,
};

/** Uppercase micro-label (13px — labels only, never coaching content). */
export const bLabel: CSSProperties = {
    fontSize: bcast.tLabel,
    letterSpacing: '.14em',
    textTransform: 'uppercase',
    color: bcast.muted,
    fontWeight: 600,
    fontFamily: bcast.body,
};

/** Pill chip for metadata ("as of 14:30", counts). */
export const bChip: CSSProperties = {
    fontSize: bcast.tLabel,
    color: bcast.muted,
    background: bcast.panel2,
    border: `1px solid ${bcast.line}`,
    borderRadius: 999,
    padding: '3px 10px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontFamily: bcast.body,
};

/** Tabular numerals for stats/timers so digits never shift layout. */
export const bNum: CSSProperties = {
    fontVariantNumeric: 'tabular-nums',
    fontFeatureSettings: '"tnum" 1',
};

/** Format an epoch-ms receivedAt as a quiet "as of" clock chip value. */
export function asOf(receivedAt: number | undefined): string {
    if (!receivedAt) return '';
    const d = new Date(receivedAt);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

// ── LEGACY PIP-BOY TOKENS (A-skin + unmigrated surfaces) ──────────────

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
