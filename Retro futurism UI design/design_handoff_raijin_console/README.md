# Handoff: RAIJIN CONSOLE — live board redesign

## Overview
A ground-up redesign of the Raijin Recs live dashboard (the `:5050` RAIJIN tab, 1920×1080 second monitor, full-bleed). Direction name: **CONSOLE** — an instrument-panel aesthetic: numbered zones separated by hairline rules (no card/panel boxes), a strict typographic grid, one amber accent, mono timecodes, and live-ticking instruments. It replaces the current mixed bcast/pip board rendered by `RaijinRecs.tsx` and its children.

## About the design files
`Raijin Console.dc.html` is a **design reference built in HTML** — a prototype showing intended look and behavior, not production code. The task is to **recreate it in the existing codebase**: `agent-office/packages/ui/src` (React 18 + TypeScript, inline style objects, no Tailwind), driven by the existing WebSocket contracts in `raijinTypes.ts` and a new token set in `raijinTheme.ts`. The prototype contains a small self-running simulation (clock/gold/tape ticking) purely to demonstrate motion — in production those values come from GSI (`hero_status`, `timers`) as they do today.

`Raijin Round 2.dc.html` is included for context only (the losing sibling directions B/CUT and C/PHOSPHOR — C is a candidate language for a future death-moment surface).

## Fidelity
**High-fidelity.** Colors, type sizes, letter-spacing, rules, and zone layout are final and should be recreated pixel-accurately at 1920×1080, degrading gracefully to ~1280 wide (see Responsive).

## Design tokens (new `console` set for raijinTheme.ts)

Colors:
- `base: #0B0C0E` — board background
- `base2: #08090B` — tape strip background
- `line: #21252B` — primary hairline rules (zone separators)
- `line2: #171A1F` — secondary hairlines (in-zone row separators, chart grid)
- `ink: #EDF1F6` — headline text
- `body: #C9D1DA` — primary text
- `muted: #7E8896` — secondary/reading text
- `chrome: #4A525E` — zone labels, header meta (never coaching content)
- `ghost: #2A3038` — inert annotations, deselected states
- `amber: #FFB000` — THE accent: directive emphasis, progress, YOU-curve, NOW
- `gold: #F5C518` — imminent windows (Rosh pending, situational-build header)
- `dire: #FF5964` — enemy/danger/CRITICAL/deaths
- `radiant: #3BE0A0` — positive/ready/complete
- `blue: #5AA9FF` — neutral timers (stack, rune)
- `stanceFarm: #4FA3FF`, `stanceFight: #FF6A3D` (reserved), `stancePush: #F5C518` (reserved)

Typography:
- Display: `'Chakra Petch', sans-serif` — directives, stance word, big numerals
- Mono: `'IBM Plex Mono', ui-monospace, monospace` — DEFAULT board font: zone labels, timecodes, header, tape (replaces Share Tech Mono everywhere)
- Reading: `Inter, system-ui, sans-serif` — why-lines, log entries, captions
- All numerals: `font-variant-numeric: tabular-nums`

Type scale (px): zone label 11 (tracking .26em, uppercase, chrome); micro-annotation 10 (.18–.22em); timecode 12; caption 13–13.5 Inter; body/log 15.5 Inter (16px floor applies to live-glance text — log is 15.5 at reading distance of the death window, keep ≥15.5); reading 16; stance secondary 19; header clock 17; threat name 20 Chakra; gap numeral 36 Chakra; stance word 40 Chakra; directive 52 Chakra (line-height 1.02, tracking .005em).

Spacing/structure:
- **Border radius: 0 everywhere. No shadows. No gradients** (single exception: tape band fades, `linear-gradient(90deg, …, transparent)`).
- Zone padding: 28–32px h-padding left column, 36px right column; 16–22px v.
- Hairlines: 1px `line` between zones; 1px `line2` inside zones.

Motion:
- Ease `cubic-bezier(.2,.7,.3,1)`; nothing >300ms except ambient pulses.
- Pulse dots: 1.6–1.8s `box-shadow` ping (see prototype keyframes `ping-a`/`ping-d`).
- All animation behind `prefers-reduced-motion: reduce` → none.

## Layout grid (1920×1080)
CSS grid, rows: `64px | 1fr | 158px`.
- **Header (64px)**: two cells split at x=620 (matching body column split), 1px bottom rule.
- **Body**: `grid-template-columns: 620px 1fr`, 1px vertical rule between.
  - Left column rows: `auto (01 DIRECTIVE) | auto (02 STANCE) | 1fr (03 LOG)`, 1px rules between.
  - Right column rows: `1fr (04 THE GAP) | 302px (bottom row)`.
  - Bottom row columns: `400px (05 MAP) | 1fr (06 BUILD) | 420px (07 THREAT)`, 1px rules between.
- **Tape (158px)**: full width, 1px top rule, `base2` background.

## Zones (content + behavior)

### Header
Left cell: `RAIJIN` (Chakra 18/700, tracking .3em, amber) + `CONSOLE · 7.41d · CRUSADER` (11, chrome). Patch version from patch-drift status; bracket from bot-status.
Right cell, space-between: `T+<clock 17px ink>` · `AXE · POS 3 · LV 14` · `SCORE 16–19` (radiant/dire) · link health: `GSI ● 0.5s  LLM ● ~9s  INTEL ● ~2m` with dot colors radiant/amber/dire. **Link health is the latency-honesty header — always visible.** Clock extrapolates client-side between `timers` updates (existing RaijinTimerRail logic).

### 01 · DIRECTIVE (replaces RaijinActionBar)
- Zone label row: `01 · DIRECTIVE` + status flag right: `● LIVE` (amber, pulsing) normally; `● SPIKE REACHED` (radiant) when the tracked item completes; CRITICAL state uses dire.
- Directive: Chakra 52/700, ink, key phrase in amber (e.g. `FARM TOP UNTIL <amber>BLADE MAIL</amber>`). Two lines max.
- Why-line: Inter 16, muted, max 52ch. No "Why:" prefix needed if the sentence reads as a reason.
- Progress instrument: 11px labels (`1385 / 2100 G` left, `−715 · ≈1:53` right), 2px track `line`, amber fill + 1×8px end tick. Gold value live from `hero_status`.
- Pick logic unchanged: `pickPriorityAction` (urgency ▸ priority ▸ recency, role-weighted).
- State flip: when the tracked gold target is reached the directive swaps content (see prototype's two `sc-if` branches) — animate as a ≤220ms crossfade.

### 02 · STANCE (replaces RaijinStanceBanner)
- Label row: `02 · STANCE` + `CONF 82 · DISCIPLINE LOCK` right.
- Word row: active stance Chakra 40/700 in its stance color; inactive stances Chakra 19/600 in `ghost` alongside.
- Two-cell rule-separated row: `FLIPS TO FIGHT IF <condition>` (chrome label + Inter 13.5 body) | `BREAKS IF <condition>` (label in dire). Conditions from `StanceData.inputs`/reason.

### 03 · LOG (replaces RaijinStrategy feed)
- Label row: `03 · LOG · WHY-FIRST` + right annotation `AGES OUT, NEVER VANISHES` (10, ghost).
- Rows in a `58px 14px 1fr` grid: timecode (12, chrome) | `▮` glyph in category color (FIGHT dire, ITEM amber, TIMER blue, SKILL radiant, GENERAL chrome) | Inter 15.5: bold lead sentence + muted why. 1px `line2` top rule per row.
- Age decay: rows fade toward 60% opacity over their pacing window (reuse `ageWindow`), never removed mid-read.

### 04 · THE GAP (new; the "what am I getting wrong" surface)
- Label row: `04 · THE GAP — NET WORTH BY MINUTE` + legend right (`━ YOU` amber / `━ ANTI-MAGE` dire / `╌ CRUSADER P3 MEDIAN` ghost-dash).
- SVG line chart, grid strokes `line2`, 2.5px data strokes, endpoint dots r=5. X axis minute marks 10px ghost. Deaths plotted as dire triangles ON the YOU curve.
- Gap numeral top-right: Chakra 36/700 dire (`−8.5k`) + 10px chrome caption (`GAP · GROWING 410/MIN`).
- One annotation: 2px dire left-rule block (`▲ = YOUR DEATHS` + insight sentence). **This is coaching content — keep the insight generated ("the gap is death time, not farm skill"), not canned.**
- Data: hero curve from per-tick GSI logging; enemy from `EnemyIntelData.net_worth` (mark stale >2m); median from Stratz bracket benchmarks.

### 05 · MAP DISCIPLINE (new)
- 186×186 schematic (SVG): 1px `line` square frame, river as a 10px diagonal band (`#2A3B4D` at 50%), assigned quadrant polygons amber at 7–9% opacity, Rosh pit circle (gold stroke) with `ROSH` micro-label, deaths as dire ▲, player as pulsing amber circle (`<animate>` r 4→7→4, 2.4s).
- Corner micro-labels: `YOUR WORLD` (amber 9px) / `THEIR MAP` (ghost 9px).
- Caption under map, Inter 13 centered: death count + the discipline sentence.
- Assigned quadrant derives from stance engine output; deaths from game log positions when available (else omit marks, keep quadrant shading).

### 06 · BUILD — THIS GAME (new; per-game itemization)
- Label row: `06 · BUILD — THIS GAME` + source `STRATZ · CRUSADER P3 · N=2.4k` (10, ghost).
- Path row: [next-item icon 44×32] name Inter 15/600 ink + mono annotation amber (`— NEXT · <gold>/2100` live) + reason line 13 muted → `→` (ghost) → [after-item icon at 75% opacity] + `<WR>% WR HERE` mono annotation + reason.
- Situational divider: `IF IT GOES PAST 35:00 · THIS LINEUP` (10px gold, .22em) + 1px `line2` rule filling right.
- Two pivot cells (1px rule between): [item icon 40×29] + Inter 13: bold recommendation + reason referencing THIS lineup ("4 of 5 Dire deal physical — and it covers your Medusa too").
- Footer, mono 11 chrome: `RE-EVALUATES ON ENEMY ITEM INTEL · LAST 22:41` — stamp the last enemy-intel time; this zone recomputes when `enemy_intel` lands.
- Data: Stratz bracket-filtered builds (API live) + enemy composition analysis (LLM tier ANALYTICAL — pivots may arrive seconds late; render the standard path immediately and let pivots fill in).

### 07 · PRIMARY THREAT (replaces the enemy half of RaijinTeamIntel)
- Label row: `07 · PRIMARY THREAT` + `INTEL ~2m OLD` (10, dire) — the delay stamp is mandatory.
- Hero row: 76×43 CDN portrait, name Chakra 20/700 + `LV 18 · 16.4k` (dire, tabular), 6-item icon row 30×22 (unknown slots at 60% opacity).
- Spike line (1px `line2` top rule): `Next spike: <b>Basher ≈ min 27.</b>` + counter-relationship sentence with the amber emphasis tying to YOUR build.
- Footer mono 10.5 chrome: other enemies' NW one-liner + source badge (`BOT ✓` / `GSI DRAFT` / `MANUAL` / `UNKNOWN — SET` clickable → enemy picker).
- Primary threat selection: highest NW enemy (or role-counterpart if within 15%).

### 08 · TAPE (replaces RaijinTimerRail; the signature instrument)
- 180-second forward horizon. Label row: `08 · TAPE — NEXT 180 SECONDS` + `NOW T+<clock>` right.
- Track: 1px `line` baseline at y=38 within an 84px lane; minor ticks as `repeating-linear-gradient` every 1/6 of width (30s); NOW = 2×25px amber tick at x=0 with label below.
- Events: 1×17px tick + 11px mono label, alternating above (y=8) / below (y=58) the line to avoid collisions. Colors: stack/rune blue, item ETA amber, Rosh window gold, risk peaks dire.
- Position: `left = (secondsUntil / 180) * 100%`, recomputed every second — events **drift toward NOW**.
- Right-edge rule: labels at >82% right-anchor (`translateX(-100%)`); events beyond 175s are hidden until they enter the horizon.
- Window bands: pending Rosh renders a gold fade-band from its tick to the right edge; when a window OPENS the band re-anchors at NOW in dire with a pulsing dot + directive-grade label (`ROSH WINDOW OPEN — STAY NORTH UNLESS 3 COMMIT`).
- Sources: `TimerRailData` (stack/rune/bounty/tormentor/rosh edges/aegis) + item ETA from live gpm.

## Interactions & behavior
- No hover-dependent information (it's a glance surface). Clickable: threat source badge → enemy picker; everything else read-only.
- Zone state changes (directive swap, Rosh open, spike reached) crossfade ≤220ms; numerals never animate positionally (tabular-nums).
- CRITICAL urgency: directive zone flips to dire accents + dire pulse; nothing else on the board turns red at the same time (one alarm at a time).
- Board freeze on `game_ended` (existing behavior): stop tape drift, stamp `FROZEN FOR REVIEW` in the header right cell.
- Offline: header link dots go dire; zones keep last data at 60% opacity with `SIGNAL LOST <time>` stamps. Never blank a zone that had data.

## State management
Existing `RaijinRecs` state model carries over (WS reducer per `UIUpdate.type`). New derived state: gold-target tracking for the directive/progress/tape ETA (from ITEM-category priority rec), gap series accumulation (append per `hero_status` minute mark), tape event list (merge `timers` + item ETA + risk annotations). 1s UI tick for tape/clock extrapolation (exists in RaijinTimerRail — lift to board level).

## Responsive (~1280 wide)
Scale strategy: the board is a fixed-proportion instrument — prefer a uniform `transform: scale()` of the 1920×1080 stage (like the prototype) over reflow. Below 0.66 scale, drop zones 05 and 07 (MAP, THREAT) and let 06 BUILD fill the bottom row; the 16px floor then survives.

## Assets
- Hero/item icons: Steam CDN `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/<name>.png` and `.../items/<name>.png` (note: TP scroll is `tpscroll.png`). Already used by the repo; keep the local-portrait-API-with-CDN-fallback pattern from `RaijinHeroDisplay`.
- Fonts: Chakra Petch (500/600/700), IBM Plex Mono (400/500/600), Inter (400–700) — add IBM Plex Mono to `index.html`/`raijin.html`; Share Tech Mono is no longer used by live surfaces.

## Files
- `Raijin Console.dc.html` — THE reference. Open in a browser; it self-scales and self-simulates (tweak props `liveSim`, `simSpeed` control the demo clock).
- `Raijin Round 2.dc.html` — context: sibling directions (B CUT = critical-moment language worth reusing for CRITICAL takeovers; C PHOSPHOR = candidate death-record language).

## Out of scope for this handoff (designed later)
Death-moment takeover, post-game segment, briefing room, quick enemy/lane picker, caster-bug overlay restyle. The zone system above is the foundation they will slot into.
