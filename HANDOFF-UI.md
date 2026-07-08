# HANDOFF — Raijin UI Phase 1 (`feat/raijin-ui-phase1`)

> Overnight build, 2026-07-08. Direction (owner-confirmed): **B esports-broadcast spine +
> C's WHY-first/voice interaction model + A's MATCH DOSSIER as a skinnable option.**
> Spec: `ai-agents/docs/overdrive-2026-07/TRACK-3-raijin.md` (Phase 1 component list).
> Visual source of truth: `packages/ui/playground/raijin-direction-{a,b,c}*.html`.

## Built (all 11 Phase-1 components, 8 commits, tsc clean, 38/38 tests)

| # | Component | Where | Notes |
|---|-----------|-------|-------|
| 1 | `raijinTheme.ts` v2 | `src/raijinTheme.ts` | `bcast` token set (B palette, WCAG-AA, one gold accent, C stance colors, 16→64 type scale, motion tokens). Legacy `pip` kept for unmigrated surfaces + the A skin. Chakra Petch + Inter load in `index.html`. |
| 2 | Responsive shell | `RaijinRecs.tsx` | `minmax` fr grid (old `1fr 520px`/190px killed), `left:56→48` gutter fixed, scanline/vignette filters removed. |
| 3 | RecCard v2 (WHY-first) | `RaijinStrategy.tsx` | `rec.reason` = primary line, category stripes, "as of MM:SS", age-decay opacity. |
| 4 | PriorityAction | `RaijinActionBar.tsx` | ONE 44px directive + reason; gold accent (dire on CRITICAL/death); pick via PacingController. |
| 5 | StanceBanner v2 | `RaijinStanceBanner.tsx` | Stance-colored (farm blue / fight ember / push gold), 28px, confidence + discipline chips. |
| 6 | PacingController | `src/pacing.ts` (+13 tests) | One model: ingest displacement (field-based — `title.startsWith('Raijin says ')` hack DELETED), category×urgency age windows (GENERAL no longer immortal), budgets, role weighting, `pickPriorityAction`. |
| 7 | DeathMoment v2 | `RaijinDeathPanel.tsx` | 60px respawn numeral + gold-to-spend + "Change this:" hero line; alive-state 45s card kept. |
| 8 | BriefingRoom | `RaijinBriefingRoom.tsx` | Queue-time surface (leak profile w/ honest empty state, dossier slot → SCOUTING, checklist). `skin: broadcast\|dossier` toggle = the A-skin option, persisted. |
| 9 | Role in UI state | `RaijinRecs.tsx` | Selector chips (top right), localStorage-persisted, reweights pacing + priority pick. |
| 10 | ItemsGrid truthful | `RaijinHeroDisplay.tsx` | Fabricated main/backpack/N/TP slot claims removed — renders the verified flat list. Backend `_parse_items_split` still needs its own fix. |
| 11 | Copy/state fixes | `RaijinRecs/RaijinPostGame` | `game_ended` now FREEZES the board for review (dismissable chip; age eval pinned to end time) instead of blanking; PhaseAnalysis honest empty state; "Opus 4.7" copy removed. |

## Phase 2 — THE CASTER BUG (`feat/caster-bug-overlay`, 2026-07-08)

`packages/overlay` — an **Electron** (no Rust on this machine → not Tauri) transparent,
click-through, always-on-top strip over the game. Zero backend change: it consumes the same
`ws://localhost:4000/ws` broadcast as the dashboard (`stance` / `recommendations` / `timers` /
`game_ended`; contracts duplicated minimally in `src/types.ts`, source of truth stays
`packages/ui/src/raijinTypes.ts`).

**What renders (≤5 elements):** stance word + Direction-C stance-color edge glow · THE one
priority action (24px) + its WHY (17px) — picked by `src/strip.ts` mirroring `pacing.ts`
semantics (urgency ▸ priority ▸ recency, 120s NOW window) · next objective countdown
(stack/rune/tormentor/rosh edges) · connection dot. CRITICAL actions flash the border
(dire red; `prefers-reduced-motion` → static). Engine down → dimmed "RAIJIN OFFLINE",
reconnects every 3s, never crashes.

**Controls (all outside the game):** tray menu (show/hide · monitor picker · quit) +
global hotkey **Alt+Shift+R**. The strip itself is `setIgnoreMouseEvents(true)` — no click
targets by definition. Config persists to `userData/overlay-config.json`.

**Run:** `npm run overlay` (root). Build `npm run build --workspace=@agent-office/overlay`
(tsc clean); tests `npm test --workspace=@agent-office/overlay` (14/14 on the strip logic).

**OWNER ACCEPTANCE (manual — a real overlay needs a real game):**
1. `npm run overlay`, then launch Dota 2 in **borderless fullscreen** (not exclusive).
2. Confirm the strip floats over the game top-center, never steals a click (spam-click
   through it), and Alt+Shift+R toggles it.
3. Start a bot match with the engine running (`:4000`): stance color + action + timer
   should track the dashboard; kill the engine mid-game → OFFLINE chip, no crash.
4. Multi-monitor: tray → Monitor → pick the game display; strip re-centers.

## Remaining (known, deliberate)

- **Visual coherence pass:** `RaijinTeamIntel`, the rest of `RaijinHeroDisplay`, and the
  modals (PostGame / History / Settings / EnemyPicker / ScoutingForm) still wear the legacy
  amber `pip` styling inside the new broadcast shell. Functional, but mixed-theme.
- **Phase 1.5 (parallel content):** C voice rewrite — flip TTS default gate to IMPORTANT +
  scripted why-first lines (backend/content work, not UI).
- **Phase 2 follow-ups:** C's full peripheral stance glow (screen-edge, beyond the strip's
  own glow); the server launcher narrow-sync bug (`uv run --extra raijin`) still open on the
  engine side; overlay auto-start alongside the engine.
- BriefingRoom's leak-profile card probes `GET /api/personal-patterns` — if the engine
  doesn't expose it, the card shows its empty state (add the endpoint to feed it).

## Preview

```
cd agent-office && npm run dev          # :5173 → "R" tab
# engine optional: the shell, BriefingRoom, and empty states render without it
```

Build: `npm run build --workspace=@agent-office/ui` (tsc) — clean at every commit.
Tests: `npm test --workspace=@agent-office/ui` — 38/38 (13 new pacing tests).
