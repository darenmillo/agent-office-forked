/** RAIJIN CONSOLE — the live-board stage (1920×1080, uniformly scaled).
 *
 *  Grid per handoff: rows 64px | 1fr | tape; body 620px | 1fr; left column
 *  01 DIRECTIVE / 02 STANCE / 03 LOG; right column 04 THE GAP over
 *  05 MAP | 06 BUILD | 07 THREAT; full-width 08 TAPE.
 *
 *  rc-audit R1 verdict C — THE DIRECTOR: four board states (LANING / MID /
 *  DEAD / POSTGAME, `director.ts`) re-rank this same grid. No zone moves —
 *  zones inherit LEAD / SUPPORT / DIM weights from the state. The
 *  responsive ladder (rows 42-43) renders fewer ranks, never smaller text:
 *  full → compact (map drops, threat collapses to the rail) → stack
 *  (natural-size single column; the grid never scale-shrinks below
 *  legibility).
 *
 *  This component derives; RaijinRecs owns all WS state. The 1s board tick
 *  (tape drift + clock extrapolation) freezes with the board. */
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { console_ } from '../../raijinTheme';
import { HeroCardData,
    HeroData, PostGameReport, Recommendation, StanceData, TimerRailData,
    EnemyIntelData, EnemySource, GapBaselineData, WinnabilityData,
} from '../../raijinTypes';
import { pickPriorityAction, directiveOwnedKey, Role } from '../../pacing';
import {
    GapPoint, extractGoldTarget, goldEtaSeconds, extrapolatedClock,
    deriveTapeEvents, roshTapeState, directiveIsGoldTarget, llmKind,
    winnabilityTone, fmtPct,
} from '../../console';
import { isTapeCompressed } from '../../gapTape';
import { boardState, responsiveMode, rankOpacity } from '../../director';
import { ConsoleKeyframes } from './shared';
import { ConsoleHeader } from './ConsoleHeader';
import { Zone01Directive } from './Zone01Directive';
import { Zone02Stance } from './Zone02Stance';
import { Zone03Log } from './Zone03Log';
import { Zone04Gap } from './Zone04Gap';
import { Zone05Map } from './Zone05Map';
import { Zone06Build } from './Zone06Build';
import { Zone07Threat } from './Zone07Threat';
import { Zone08Tape } from './Zone08Tape';
import { ThreatRail } from './ThreatRail';
import { PostgameVerdict } from './PostgameVerdict';

const STAGE_W = 1920;
const STAGE_H = 1080;

/** Row 41: the header's GSI dot goes red past this age (LinkDot agingS=10);
 *  the SAME threshold desaturates the data zones so old numbers can't
 *  impersonate live ones. Chrome (header) stays full color. */
const GSI_STALE_DESAT_MS = 10_000;

const ROLE_HEADER: Record<Role, string> = {
    carry: 'POS 1', mid: 'POS 2', offlane: 'POS 3',
    soft_support: 'POS 4', hard_support: 'POS 5',
};

interface Props {
    heroData: HeroData;
    heroCard?: HeroCardData | null;
    recs: Recommendation[];
    stance: StanceData | null;
    timerRail: { data: TimerRailData; receivedAt: number } | null;
    enemyIntel: EnemyIntelData | null;
    enemyIntelReceivedAt: number | null;
    enemySource: EnemySource;
    onSourceClick: () => void;
    role: Role | null;
    gameEnded: boolean;
    endedAt: number;
    lastHeroAt: number | null;
    signalLostAt: number | null;
    bracket: string | null;
    patchVersion: string | null;
    gapSeries: GapPoint[];
    headerControls?: React.ReactNode;
    // Wave 2 feeds — all render-if-present.
    gapBaseline: GapBaselineData | null;
    winnability: { data: WinnabilityData; receivedAt: number } | null;
    youIsNetWorth: boolean;
    deathSpots: Array<{ x: number; y: number }>;
    /** rc-audit row 47 — the POSTGAME verdict takeover reads the report. */
    postGameReport?: PostGameReport | null;
}

/** Stack-mode gap band (row 43): the chart becomes a sparkline strip. */
function GapBand({ series, winnability }: {
    series: GapPoint[];
    winnability: WinnabilityData | null;
}) {
    const ys = series.slice(-24)
        .map(p => p.you)
        .filter((y): y is number => typeof y === 'number');
    const line = (() => {
        if (ys.length < 2) return null;
        const min = Math.min(...ys), max = Math.max(...ys);
        const span = Math.max(1, max - min);
        return ys
            .map((y, i) => `${((i / (ys.length - 1)) * 100).toFixed(1)},${(30 - ((y - min) / span) * 26).toFixed(1)}`)
            .join(' ');
    })();
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 14,
            borderBottom: `1px solid ${console_.line}`, padding: '8px 16px',
            background: console_.base2,
        }}>
            <span style={{ fontSize: 10, letterSpacing: '.22em', color: console_.chrome, flex: 'none' }}>
                04 · GAP
            </span>
            <svg viewBox="0 0 100 32" preserveAspectRatio="none" style={{ flex: 1, height: 28, minWidth: 0 }}>
                {line && <polyline points={line} fill="none" stroke={console_.amber} strokeWidth={1.5} />}
            </svg>
            {winnability && typeof winnability.p_win === 'number' && (
                <span style={{
                    fontSize: 13, fontWeight: 700, flex: 'none', fontVariantNumeric: 'tabular-nums',
                    color: console_[winnabilityTone(winnability.p_win)],
                }}>
                    {fmtPct(winnability.p_win)}
                </span>
            )}
        </div>
    );
}

export function RaijinConsole({
    heroData,
    heroCard = null, recs, stance, timerRail, enemyIntel, enemyIntelReceivedAt,
    enemySource, onSourceClick, role, gameEnded, endedAt, lastHeroAt,
    signalLostAt, bracket, patchVersion, gapSeries, headerControls,
    gapBaseline, winnability, youIsNetWorth, deathSpots,
    postGameReport = null,
}: Props) {
    // Uniform stage scale from the container box.
    const wrapRef = useRef<HTMLDivElement | null>(null);
    const [scale, setScale] = useState(1);
    useLayoutEffect(() => {
        const el = wrapRef.current;
        if (!el) return;
        const fit = () => {
            const r = el.getBoundingClientRect();
            setScale(Math.min(r.width / STAGE_W, r.height / STAGE_H));
        };
        fit();
        const ro = new ResizeObserver(fit);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);
    const mode = responsiveMode(scale);

    // 1s board tick — drives tape drift + clock extrapolation. Frozen boards
    // stop ticking (countdowns are dead on a review board).
    const [tickNow, setTickNow] = useState(Date.now());
    useEffect(() => {
        if (gameEnded) return;
        const id = setInterval(() => setTickNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, [gameEnded]);
    const nowMs = gameEnded ? endedAt : tickNow;

    // Board clock: timer rail is authoritative; hero_status is the fallback.
    const clock: number | null = timerRail && timerRail.data.clock >= 0
        ? extrapolatedClock(timerRail.data.clock, timerRail.receivedAt, nowMs)
        : heroData.clock_time !== undefined && lastHeroAt !== null
            ? extrapolatedClock(heroData.clock_time, lastHeroAt, nowMs)
            : heroData.clock_time ?? null;

    // THE DIRECTOR — pure GSI in, board state + zone ranks out.
    const dv = boardState({ clock, alive: heroData.alive !== false, gameEnded });
    const postgame = dv.state === 'POSTGAME';

    // Derived: directive pick, gold target, tape events.
    const action = pickPriorityAction(recs, nowMs, role, stance); // rc-audit row 01: stance-aware arbiter
    const goldTarget = extractGoldTarget(recs, nowMs);
    const eta = goldTarget ? goldEtaSeconds(goldTarget, heroData.gold, heroData.gpm) : null;
    const itemEta = goldTarget && eta !== null && eta > 0
        ? { label: goldTarget.label.split(/[—–:-]/)[0].trim() || goldTarget.label, seconds: eta }
        : null;
    const rail = timerRail?.data ?? null;
    const tapeEvents = clock !== null ? deriveTapeEvents(rail, clock, itemEta) : [];
    const rosh = clock !== null ? roshTapeState(rail, clock) : null;

    // Rows 23/45: the tape row is dynamic — compressed content (or a LANING
    // board) frees its pixels to the chart + log.
    const tapeCompressed = dv.state === 'LANING' || isTapeCompressed(tapeEvents, rosh);
    const tapeRow = tapeCompressed ? 96 : 158;

    // Log rows: everything visible except the rec currently on the directive.
    const logRecs = action ? recs.filter(r => r !== action) : recs;
    const itemRecs = recs.filter(r => r.category === 'ITEM');
    const directiveKey = directiveOwnedKey(action);
    const directiveHasGold = directiveIsGoldTarget(action, goldTarget);
    const closingRec = postgame ? recs.find(r => llmKind(r) === 'closing') ?? null : null;

    // Header meta.
    const myTeam = heroData.my_team ?? null;
    const allyScore = enemyIntel
        ? (myTeam?.toLowerCase() === 'dire' ? enemyIntel.dire_score : enemyIntel.radiant_score)
        : null;
    const enemyScore = enemyIntel
        ? (myTeam?.toLowerCase() === 'dire' ? enemyIntel.radiant_score : enemyIntel.dire_score)
        : null;
    const llmTimes = recs
        .filter(r => r.tier === 'ANALYTICAL')
        .map(r => r.receivedAt ?? 0)
        .filter(t => t > 0);
    const newestLLM = llmTimes.length ? Math.max(...llmTimes) : null;
    const threatName = (() => {
        const enemies = (enemyIntel?.players ?? []).filter(
            p => myTeam && p.team && p.team.toLowerCase() !== myTeam.toLowerCase(),
        );
        if (!enemies.length) return null;
        return enemies.reduce((a, b) => (b.net_worth > a.net_worth ? b : a))
            .hero_name.replace(/^npc_dota_hero_/, '').replace(/_/g, ' ');
    })();

    const dimmed = signalLostAt !== null && !gameEnded;
    // Rows 41 + 46: GSI-stale-while-connected AND postgame both desaturate
    // the DATA zones (body + tape) — chrome (the header, where the dot and
    // the FROZEN banner live) stays full color.
    const gsiStale = !gameEnded && lastHeroAt !== null && nowMs - lastHeroAt > GSI_STALE_DESAT_MS;
    const desat = gsiStale || postgame;

    const dimStyle = (zone: keyof typeof dv.ranks): React.CSSProperties => ({
        opacity: rankOpacity(dv.ranks[zone]),
        minHeight: 0, minWidth: 0, display: 'grid',
    });

    // Shared chrome pieces.
    const headerNode = (
        <ConsoleHeader
            heroData={heroData}
            clock={clock}
            roleLabel={role ? ROLE_HEADER[role] : null}
            bracket={bracket}
            patchVersion={patchVersion}
            allyScore={allyScore}
            enemyScore={enemyScore}
            gsiAgeMs={lastHeroAt !== null ? nowMs - lastHeroAt : null}
            llmAgeMs={newestLLM ? nowMs - newestLLM : null}
            intelAgeMs={enemyIntelReceivedAt !== null ? nowMs - enemyIntelReceivedAt : null}
            frozen={gameEnded}
            heroCard={heroCard}
            signalLostForMs={dimmed && signalLostAt !== null ? nowMs - signalLostAt : null}
            headerControls={headerControls}
            compact={mode !== 'full'}
        />
    );
    const zone01Node = postgame ? (
        <PostgameVerdict
            report={postGameReport}
            closingRec={closingRec}
            result={postGameReport?.result ?? null}
        />
    ) : (
        <Zone01Directive
            action={action}
            heroData={heroData}
            goldTarget={goldTarget}
            clock={clock}
            nowMs={nowMs}
        />
    );
    const zone02Node = postgame ? (
        // Row 46: the stance strip becomes the final scoreline — no live
        // imperative on a frozen board.
        <div style={{
            padding: '14px 32px', borderBottom: `1px solid ${console_.line}`,
            display: 'flex', alignItems: 'baseline', gap: 18,
            fontFamily: console_.mono, fontVariantNumeric: 'tabular-nums',
        }}>
            <span style={{ fontSize: 11, letterSpacing: '.26em', color: console_.chrome }}>02 · FINAL</span>
            <span style={{ fontFamily: console_.display, fontSize: 24, fontWeight: 700, color: console_.ink }}>
                {allyScore ?? '—'}<span style={{ color: console_.chrome }}>–</span>{enemyScore ?? '—'}
            </span>
            <span style={{ fontSize: 12, color: console_.muted }}>
                YOU {heroData.kills}/{heroData.deaths}/{heroData.assists}
            </span>
        </div>
    ) : (
        <Zone02Stance stance={stance} />
    );

    const cutCss = (
        <style>{`
            .rc-cut { transition: opacity 240ms ease, filter 240ms ease; }
            @media (prefers-reduced-motion: reduce) { .rc-cut { transition: none !important; } }
        `}</style>
    );

    // ── STACK MODE (rows 43/44): natural-size single column — directive,
    // stance, gap band, build, threat rail, log. Text never scale-shrinks.
    // row 44: the <560px phone companion strip would fork here (a second
    // product surface, owner decision — see docs/design/raijin/ROW44 note);
    // until it exists these widths render this stack.
    if (mode === 'stack') {
        return (
            <div ref={wrapRef} style={{
                position: 'absolute', inset: 0, background: console_.base,
                overflowY: 'auto', overflowX: 'hidden', fontFamily: console_.mono,
                color: console_.body,
            }}>
                <ConsoleKeyframes />
                {cutCss}
                <div className="rc-cut" style={{ filter: desat ? 'grayscale(.3) saturate(.55)' : 'none' }}>
                    {headerNode}
                    {zone01Node}
                    {zone02Node}
                    <GapBand
                        series={gapSeries}
                        winnability={
                            winnability && nowMs - winnability.receivedAt < 90_000
                                ? winnability.data : null
                        }
                    />
                    <Zone06Build
                        itemRecs={itemRecs}
                        gold={heroData.gold}
                        goldTarget={goldTarget}
                        intelReceivedAt={enemyIntelReceivedAt}
                        clock={clock}
                        nowMs={nowMs}
                        directiveKey={directiveKey}
                        directiveIsGoldTarget={directiveHasGold}
                    />
                    <ThreatRail
                        enemyIntel={enemyIntel}
                        myTeam={myTeam}
                        enemyHeroNames={heroData.enemy_heroes ?? []}
                        intelReceivedAt={enemyIntelReceivedAt}
                        nowMs={nowMs}
                    />
                    <Zone03Log recs={logRecs} clock={clock} nowMs={nowMs} />
                </div>
            </div>
        );
    }

    const compact = mode === 'compact';

    return (
        <div ref={wrapRef} style={{
            position: 'absolute', inset: 0, background: '#050608',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', fontFamily: console_.reading,
        }}>
            <ConsoleKeyframes />
            {cutCss}
            <div style={{
                width: STAGE_W, height: STAGE_H, flex: 'none',
                transform: `scale(${scale})`, transformOrigin: 'center center',
            }}>
                <div
                    className="console-fade"
                    style={{
                        width: STAGE_W, height: STAGE_H, overflow: 'hidden',
                        background: console_.base, color: console_.body,
                        fontFamily: console_.mono,
                        display: 'grid', gridTemplateRows: `64px minmax(0,1fr) ${tapeRow}px`,
                        opacity: dimmed ? 0.6 : 1,
                    }}
                >
                    {headerNode}
                    <div
                        className="rc-cut"
                        style={{
                            display: 'grid', gridTemplateColumns: '620px minmax(0,1fr)', minHeight: 0,
                            filter: desat ? 'grayscale(.3) saturate(.55)' : 'none',
                        }}
                    >
                        <div style={{
                            borderRight: `1px solid ${console_.line}`,
                            display: 'grid', gridTemplateRows: 'auto auto minmax(0,1fr)', minHeight: 0,
                        }}>
                            {zone01Node}
                            {zone02Node}
                            <div className="rc-cut" style={dimStyle('z03')}>
                                <Zone03Log recs={logRecs} clock={clock} nowMs={nowMs} />
                            </div>
                        </div>
                        <div style={{
                            display: 'grid', minHeight: 0,
                            // LANING leads with the lane card — the bottom row
                            // takes the pixels the chart cedes.
                            gridTemplateRows: dv.state === 'LANING'
                                ? 'minmax(0,1fr) 402px' : 'minmax(0,1fr) 302px',
                        }}>
                            <div className="rc-cut" style={dimStyle('z04')}>
                                <Zone04Gap
                                    series={gapSeries}
                                    threatName={threatName}
                                    deaths={heroData.deaths}
                                    baseline={gapBaseline}
                                    winnability={
                                        winnability && nowMs - winnability.receivedAt < 90_000
                                            ? winnability.data
                                            : null
                                    }
                                    youIsNetWorth={youIsNetWorth}
                                />
                            </div>
                            <div style={{
                                display: 'grid', minHeight: 0,
                                gridTemplateRows: compact ? 'auto minmax(0,1fr)' : undefined,
                                gridTemplateColumns: compact
                                    ? 'minmax(0,1fr)'
                                    : '400px minmax(0,1fr) 420px',
                            }}>
                                {/* Row 42: in compact the MAP drops first and the
                                    threat collapses to the rail — never fully gone. */}
                                {compact && (
                                    <ThreatRail
                                        enemyIntel={enemyIntel}
                                        myTeam={myTeam}
                                        enemyHeroNames={heroData.enemy_heroes ?? []}
                                        intelReceivedAt={enemyIntelReceivedAt}
                                        nowMs={nowMs}
                                    />
                                )}
                                {!compact && (
                                    <div className="rc-cut" style={dimStyle('z05')}>
                                        <Zone05Map
                                            deaths={heroData.deaths}
                                            deathSpots={deathSpots}
                                            heroX={typeof heroData.xpos === 'number' && !(heroData.xpos === 0 && heroData.ypos === 0) ? heroData.xpos : null}
                                            heroY={typeof heroData.ypos === 'number' && !(heroData.xpos === 0 && heroData.ypos === 0) ? heroData.ypos : null}
                                            alive={heroData.alive}
                                        />
                                    </div>
                                )}
                                <div className="rc-cut" style={dimStyle('z06')}>
                                    <Zone06Build
                                        itemRecs={itemRecs}
                                        gold={heroData.gold}
                                        goldTarget={goldTarget}
                                        intelReceivedAt={enemyIntelReceivedAt}
                                        clock={clock}
                                        nowMs={nowMs}
                                        directiveKey={directiveKey}
                                        directiveIsGoldTarget={directiveHasGold}
                                    />
                                </div>
                                {!compact && (
                                    <div className="rc-cut" style={dimStyle('z07')}>
                                        <Zone07Threat
                                            enemyIntel={enemyIntel}
                                            intelReceivedAt={enemyIntelReceivedAt}
                                            myTeam={myTeam}
                                            enemyHeroNames={heroData.enemy_heroes ?? []}
                                            enemySource={enemySource}
                                            onSourceClick={onSourceClick}
                                            recs={recs}
                                            nowMs={nowMs}
                                            clock={clock}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="rc-cut" style={{
                        ...dimStyle('z08'),
                        filter: desat ? 'grayscale(.3) saturate(.55)' : 'none',
                    }}>
                        <Zone08Tape events={tapeEvents} rosh={rosh} clock={clock} rail={rail} />
                    </div>
                </div>
            </div>
        </div>
    );
}
