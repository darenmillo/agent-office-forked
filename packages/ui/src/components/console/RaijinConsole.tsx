/** RAIJIN CONSOLE — the live-board stage (1920×1080, uniformly scaled).
 *
 *  Grid per handoff: rows 64px | 1fr | 158px; body 620px | 1fr; left column
 *  01 DIRECTIVE / 02 STANCE / 03 LOG; right column 04 THE GAP over
 *  05 MAP | 06 BUILD | 07 THREAT; full-width 08 TAPE. Below 0.66 scale the
 *  bottom row drops zones 05 + 07 (README §Responsive).
 *
 *  This component derives; RaijinRecs owns all WS state. The 1s board tick
 *  (tape drift + clock extrapolation) freezes with the board. */
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { console_ } from '../../raijinTheme';
import {
    HeroData, Recommendation, StanceData, TimerRailData,
    EnemyIntelData, EnemySource, GapBaselineData, WinnabilityData,
} from '../../raijinTypes';
import { pickPriorityAction, Role } from '../../pacing';
import {
    GapPoint, extractGoldTarget, goldEtaSeconds, extrapolatedClock,
    deriveTapeEvents, roshTapeState,
} from '../../console';
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

const STAGE_W = 1920;
const STAGE_H = 1080;
const COMPACT_BELOW = 0.66;

const ROLE_HEADER: Record<Role, string> = {
    carry: 'POS 1', mid: 'POS 2', offlane: 'POS 3',
    soft_support: 'POS 4', hard_support: 'POS 5',
};

interface Props {
    heroData: HeroData;
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
}

export function RaijinConsole({
    heroData, recs, stance, timerRail, enemyIntel, enemyIntelReceivedAt,
    enemySource, onSourceClick, role, gameEnded, endedAt, lastHeroAt,
    signalLostAt, bracket, patchVersion, gapSeries, headerControls,
    gapBaseline, winnability, youIsNetWorth, deathSpots,
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
    const compact = scale < COMPACT_BELOW;

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

    // Derived: directive pick, gold target, tape events.
    const action = pickPriorityAction(recs, nowMs, role);
    const goldTarget = extractGoldTarget(recs, nowMs);
    const eta = goldTarget ? goldEtaSeconds(goldTarget, heroData.gold, heroData.gpm) : null;
    const itemEta = goldTarget && eta !== null && eta > 0
        ? { label: goldTarget.label.split(/[—–:-]/)[0].trim() || goldTarget.label, seconds: eta }
        : null;
    const rail = timerRail?.data ?? null;
    const tapeEvents = clock !== null ? deriveTapeEvents(rail, clock, itemEta) : [];
    const rosh = clock !== null ? roshTapeState(rail, clock) : null;

    // Log rows: everything visible except the rec currently on the directive.
    const logRecs = action ? recs.filter(r => r !== action) : recs;
    const itemRecs = recs.filter(r => r.category === 'ITEM');

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

    return (
        <div ref={wrapRef} style={{
            position: 'absolute', inset: 0, background: '#050608',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', fontFamily: console_.reading,
        }}>
            <ConsoleKeyframes />
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
                        display: 'grid', gridTemplateRows: '64px minmax(0,1fr) 158px',
                        opacity: dimmed ? 0.6 : 1,
                    }}
                >
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
                        signalLostForMs={dimmed && signalLostAt !== null ? nowMs - signalLostAt : null}
                        headerControls={headerControls}
                    />
                    <div style={{ display: 'grid', gridTemplateColumns: '620px minmax(0,1fr)', minHeight: 0 }}>
                        <div style={{
                            borderRight: `1px solid ${console_.line}`,
                            display: 'grid', gridTemplateRows: 'auto auto minmax(0,1fr)', minHeight: 0,
                        }}>
                            <Zone01Directive
                                action={action}
                                heroData={heroData}
                                goldTarget={goldTarget}
                                clock={clock}
                                nowMs={nowMs}
                            />
                            <Zone02Stance stance={stance} />
                            <Zone03Log recs={logRecs} clock={clock} nowMs={nowMs} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateRows: 'minmax(0,1fr) 302px', minHeight: 0 }}>
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
                            <div style={{
                                display: 'grid', minHeight: 0,
                                gridTemplateColumns: compact ? 'minmax(0,1fr)' : '400px minmax(0,1fr) 420px',
                            }}>
                                {!compact && (
                                    <Zone05Map
                                        deaths={heroData.deaths}
                                        deathSpots={deathSpots}
                                        heroX={typeof heroData.xpos === 'number' ? heroData.xpos : null}
                                        heroY={typeof heroData.ypos === 'number' ? heroData.ypos : null}
                                        alive={heroData.alive}
                                    />
                                )}
                                <Zone06Build
                                    itemRecs={itemRecs}
                                    gold={heroData.gold}
                                    goldTarget={goldTarget}
                                    intelReceivedAt={enemyIntelReceivedAt}
                                    clock={clock}
                                    nowMs={nowMs}
                                />
                                {!compact && (
                                    <Zone07Threat
                                        enemyIntel={enemyIntel}
                                        intelReceivedAt={enemyIntelReceivedAt}
                                        myTeam={myTeam}
                                        enemyHeroNames={heroData.enemy_heroes ?? []}
                                        enemySource={enemySource}
                                        onSourceClick={onSourceClick}
                                        recs={recs}
                                        nowMs={nowMs}
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                    <Zone08Tape events={tapeEvents} rosh={rosh} clock={clock} />
                </div>
            </div>
        </div>
    );
}
