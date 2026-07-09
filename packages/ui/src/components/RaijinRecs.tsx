import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    HeroData,
    Recommendation,
    UIUpdate,
    EnemyIntelData,
    BotStatus,
    EnemySource,
    RAIJIN_API,
    RAIJIN_WS,
} from '../raijinTypes';
import { bcast, bLabel, bNum, console_ } from '../raijinTheme';
import { ingestRecs, visibleRecs, Role } from '../pacing';
// CONSOLE redesign (2026-07-08): the live board is RaijinConsole; the old
// bcast components (ActionBar/StanceBanner/Strategy/TimerRail/TeamIntel/
// HeroDisplay) are unwired but kept on disk as reference.
import { RaijinConsole } from './console/RaijinConsole';
import { RaijinEnemyPicker } from './RaijinEnemyPicker';
import { RaijinScoutingForm } from './RaijinScoutingForm';
import { RaijinDeathPanel } from './RaijinDeathPanel';
import { RaijinSettings } from './RaijinSettings';
import { RaijinPostGame } from './RaijinPostGame';
import { RaijinHistory } from './RaijinHistory';
import { RaijinBriefingRoom } from './RaijinBriefingRoom';
import {
    GapPoint, upsertGapPoint, bucketMinute, goldEarnedProxy,
} from '../console';
import type { PostGameReport, RecUrgency, StanceData, TimerRailData } from '../raijinTypes';

const OFFICE_API = 'http://localhost:3000';
/** App.tsx sidebar is 48px — the old left:56 left an 8px dead gutter. */
const SIDEBAR_W = 48;

type ConnStatus = 'connected' | 'connecting' | 'disconnected';
type ServerStatus = 'stopped' | 'starting' | 'running' | 'ready';

const ROLES: Array<{ id: Role; label: string }> = [
    { id: 'carry', label: 'CARRY' },
    { id: 'mid', label: 'MID' },
    { id: 'offlane', label: 'OFF' },
    { id: 'soft_support', label: 'POS4' },
    { id: 'hard_support', label: 'POS5' },
];

interface RaijinRecsProps {
    /** Standalone :5050 build (iframe tab in the command center, Track-4 D2/D3):
     *  engine control goes same-origin to bot_manager and there is no shell rail. */
    standalone?: boolean;
}

export function RaijinRecs({ standalone = false }: RaijinRecsProps) {
    const ctlBase = standalone ? '' : OFFICE_API;
    const [heroData, setHeroData] = useState<HeroData | null>(null);
    const [enemyIntel, setEnemyIntel] = useState<EnemyIntelData | null>(null);
    const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
    const [connStatus, setConnStatus] = useState<ConnStatus>('disconnected');
    const [serverStatus, setServerStatus] = useState<ServerStatus>('stopped');
    // Enemy source tracking (GSI draft / bot / manual / none) — drives auto-picker open
    const [enemySource, setEnemySource] = useState<EnemySource>('none');
    const [pickerOpen, setPickerOpen] = useState(false);
    const pickerAutoOpenedRef = useRef<boolean>(false);
    // v5.0 Phase 4: scouting form state — pre/mid-game role + lane + ally/enemy roles
    const [scoutingOpen, setScoutingOpen] = useState(false);
    // Phase 3: TTS settings (wired through to RaijinActionBar mute button)
    const [ttsEnabled, setTtsEnabled] = useState(false);
    const [ttsMuted, setTtsMuted] = useState(false);
    const [ttsMinUrgency, setTtsMinUrgency] = useState<RecUrgency>('CRITICAL');
    const [settingsOpen, setSettingsOpen] = useState(false);
    // Phase 4: post-game report state
    const [postGameReport, setPostGameReport] = useState<PostGameReport | null>(null);
    // v6 Phase 3: FARM/FIGHT/PUSH stance banner
    const [stance, setStance] = useState<StanceData | null>(null);
    // v6 Phase 12: timer rail + bracket badge + MMR trend
    const [timerRail, setTimerRail] = useState<{ data: TimerRailData; receivedAt: number } | null>(null);
    const [bracket, setBracket] = useState<string | null>(null);
    const [mmrTrend, setMmrTrend] = useState<string | null>(null);
    // v6 Phase 4: patch staleness (engine knowledge base vs live Valve patch)
    const [patchStatus, setPatchStatus] = useState<{
        engine_version: string; live_version: string; stale: boolean;
    } | null>(null);
    const [historyOpen, setHistoryOpen] = useState(false);
    // Phase 1 (#9): role in UI state — reweights which surfaces lead. Persisted.
    const [role, setRole] = useState<Role | null>(() => {
        const saved = localStorage.getItem('raijin-role');
        return ROLES.some(r => r.id === saved) ? (saved as Role) : null;
    });
    // Phase 1 (#11 bug d): game_ended freezes the board for review instead of
    // blanking it. Cleared by the next live hero_status or an explicit dismiss.
    const [gameEnded, setGameEnded] = useState(false);
    const gameEndedRef = useRef(false);
    const endedAtRef = useRef<number>(0);
    useEffect(() => { gameEndedRef.current = gameEnded; }, [gameEnded]);
    // Web Audio playback context for TTS chunks — lazy-init on first use
    const audioCtxRef = useRef<AudioContext | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const retryRef = useRef<number>(1000);

    // CONSOLE derived-state feeds (Zone 04 gap + header link health).
    const [gapSeries, setGapSeries] = useState<GapPoint[]>([]);
    const [enemyIntelAt, setEnemyIntelAt] = useState<number | null>(null);
    const [lastHeroAt, setLastHeroAt] = useState<number | null>(null);
    const prevDeathsRef = useRef(0);
    const matchIdRef = useRef<string | null>(null);
    const heroDataRef = useRef<HeroData | null>(null);

    const pickRole = useCallback((r: Role | null) => {
        setRole(r);
        if (r) localStorage.setItem('raijin-role', r);
        else localStorage.removeItem('raijin-role');
    }, []);

    // Poll Raijin server status
    const checkServer = useCallback(async () => {
        try {
            const resp = await fetch(`${ctlBase}/api/raijin/status`);
            const data = await resp.json();
            if (data.ready) setServerStatus('ready');
            else if (data.running) setServerStatus('starting');
            else setServerStatus('stopped');
        } catch {
            setServerStatus('stopped');
        }
    }, [ctlBase]);

    useEffect(() => {
        checkServer();
        const id = setInterval(checkServer, 3000);
        return () => clearInterval(id);
    }, [checkServer]);

    // Poll /api/bot-status to track enemy source for the badge + auto-picker
    const checkBotStatus = useCallback(async () => {
        if (serverStatus !== 'ready') return;
        try {
            const resp = await fetch(`${RAIJIN_API}/api/bot-status`);
            if (!resp.ok) return;
            const data: BotStatus = await resp.json();
            setEnemySource(data.enemy_source ?? 'none');
            // v6 Phase 12: auto-detected bracket rides on bot-status
            const b = (data as unknown as { bracket?: string | null }).bracket;
            if (b) setBracket(b);
        } catch {
            // backend not reachable; leave state as-is
        }
    }, [serverStatus]);

    useEffect(() => {
        if (serverStatus !== 'ready') return;
        checkBotStatus();
        const id = setInterval(checkBotStatus, 4000);
        return () => clearInterval(id);
    }, [serverStatus, checkBotStatus]);

    // Auto-open the enemy picker when a hero is live but enemies are unknown.
    // Fires ONCE per game — tracked via pickerAutoOpenedRef which resets on game_ended.
    useEffect(() => {
        if (!heroData || gameEnded) return;
        if (heroData.game_phase !== 'DOTA_GAMERULES_STATE_GAME_IN_PROGRESS') return;
        if (enemySource === 'none' && !pickerAutoOpenedRef.current) {
            pickerAutoOpenedRef.current = true;
            setPickerOpen(true);
        }
    }, [heroData, enemySource, gameEnded]);

    const toggleServer = useCallback(async () => {
        if (serverStatus === 'ready' || serverStatus === 'starting') {
            await fetch(`${ctlBase}/api/raijin/stop`, { method: 'POST' });
            setServerStatus('stopped');
            wsRef.current?.close();
        } else {
            setServerStatus('starting');
            await fetch(`${ctlBase}/api/raijin/start`, { method: 'POST' });
        }
    }, [serverStatus, ctlBase]);

    /** Clear the frozen post-game board back to the idle state. */
    const dismissFrozenBoard = useCallback(() => {
        setGameEnded(false);
        setHeroData(null);
        heroDataRef.current = null;
        setEnemyIntel(null);
        setRecommendations([]);
        setStance(null);
        setTimerRail(null);
        setGapSeries([]);
        setEnemyIntelAt(null);
    }, []);

    // SIGNAL LOST tracking — the console dims (never blanks) when the WS drops
    // mid-game and stamps how long the link has been down.
    const [signalLostAt, setSignalLostAt] = useState<number | null>(null);
    useEffect(() => {
        if (connStatus === 'disconnected' && heroData) {
            setSignalLostAt(prev => prev ?? Date.now());
        } else {
            setSignalLostAt(null);
        }
    }, [connStatus, heroData]);

    const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) return;

        setConnStatus('connecting');
        const ws = new WebSocket(RAIJIN_WS);

        ws.onopen = () => {
            setConnStatus('connected');
            retryRef.current = 1000;
        };

        ws.onmessage = (event) => {
            try {
                const update: UIUpdate = JSON.parse(event.data);

                if (update.type === 'hero_status') {
                    setGameEnded(false); // live data un-freezes a reviewed board
                    const hd = update.data as unknown as HeroData;
                    heroDataRef.current = hd;
                    setHeroData(hd);
                    setLastHeroAt(Date.now());
                    // Zone 04 gap series: reset on a new match, accumulate the
                    // gold-earned proxy per minute, mark real death events.
                    if (hd.match_id && matchIdRef.current !== hd.match_id) {
                        matchIdRef.current = hd.match_id;
                        prevDeathsRef.current = hd.deaths ?? 0;
                        setGapSeries([]);
                    }
                    const died = (hd.deaths ?? 0) > prevDeathsRef.current;
                    prevDeathsRef.current = hd.deaths ?? 0;
                    if ((hd.clock_time ?? -1) >= 0) {
                        const min = bucketMinute(hd.clock_time);
                        const you = hd.gpm > 0 ? goldEarnedProxy(hd.gpm, hd.game_time) : null;
                        if (you !== null || died) {
                            setGapSeries(s => upsertGapPoint(s, min, {
                                ...(you !== null ? { you } : {}),
                                death: died,
                            }));
                        }
                    }
                } else if (update.type === 'recommendations') {
                    const newRecs = (update.data as any).recommendations as Recommendation[];
                    if (newRecs?.length) {
                        // Phase 1 (#6): merge + displacement live in the
                        // PacingController now — no title matching here.
                        const now = Date.now();
                        setRecommendations(prev => ingestRecs(prev, newRecs, now));
                    }
                } else if (update.type === 'enemy_intel') {
                    const ei = update.data as unknown as EnemyIntelData;
                    setEnemyIntel(ei);
                    setEnemyIntelAt(Date.now());
                    // Zone 04 enemy curve: the highest-NW enemy's real net worth.
                    const team = heroDataRef.current?.my_team?.toLowerCase();
                    const foes = (ei.players ?? []).filter(
                        p => team && p.team && p.team.toLowerCase() !== team,
                    );
                    if (foes.length && (ei.game_time ?? -1) >= 0) {
                        const top = foes.reduce((a, b) => (b.net_worth > a.net_worth ? b : a));
                        setGapSeries(s => upsertGapPoint(s, bucketMinute(ei.game_time), {
                            enemy: top.net_worth,
                        }));
                    }
                } else if (update.type === 'stance') {
                    setStance(update.data as unknown as StanceData);
                } else if (update.type === 'timers') {
                    setTimerRail({ data: update.data as unknown as TimerRailData, receivedAt: Date.now() });
                } else if (update.type === 'game_ended') {
                    // Phase 1 (#11 bug d): FREEZE the board for review — keep
                    // hero panel, feed, and stance exactly as the game ended.
                    setGameEnded(true);
                    endedAtRef.current = Date.now();
                    setEnemySource('none');
                    pickerAutoOpenedRef.current = false;
                    // refresh the MMR trend after each game (ledger just appended)
                    fetch(`${RAIJIN_API}/api/mmr`)
                        .then(r => (r.ok ? r.json() : null))
                        .then(d => { if (d?.trend) setMmrTrend(d.trend); })
                        .catch(() => { /* engine offline */ });
                    // Phase 4: fetch the latest post-game report and surface it
                    fetch(`${RAIJIN_API}/api/post-game/latest`)
                        .then(r => (r.ok ? r.json() : null))
                        .then(data => { if (data) setPostGameReport(data); })
                        .catch(() => { /* no report available */ });
                } else if (update.type === 'post_game_update') {
                    // v4.1.1: async enrichment (narrative or OpenDota WIN/LOSS)
                    // landed. Swap the currently-displayed report if the match
                    // matches. Only accept when the panel is open — otherwise
                    // the user would get jolted back into a dismissed report.
                    const d = update.data as { match_id?: string; report?: PostGameReport };
                    if (d.report && d.match_id) {
                        setPostGameReport(prev =>
                            prev && prev.match_id === d.match_id ? d.report! : prev,
                        );
                    }
                } else if (update.type === 'settings_update') {
                    const d = update.data as {
                        enabled?: boolean;
                        muted?: boolean;
                        min_urgency?: RecUrgency;
                    };
                    if (typeof d.enabled === 'boolean') setTtsEnabled(d.enabled);
                    if (typeof d.muted === 'boolean') setTtsMuted(d.muted);
                    if (d.min_urgency) setTtsMinUrgency(d.min_urgency);
                } else if (update.type === 'tts_audio') {
                    // Decode base64-encoded MP3 chunks and play via Web Audio API
                    const d = update.data as { chunks?: string[] };
                    if (d.chunks && d.chunks.length > 0) {
                        void playTTSChunks(d.chunks, audioCtxRef);
                    }
                } else if (update.type === 'connection') {
                    const cd = update.data as any;
                    if (cd.patch_status) setPatchStatus(cd.patch_status);
                    // Respect a frozen review board — only blank when NOT reviewing.
                    if ('game_active' in cd && !cd.game_active && !gameEndedRef.current) {
                        setHeroData(null);
                        setRecommendations([]);
                    }
                }
            } catch {
                // Ignore parse errors
            }
        };

        ws.onclose = () => {
            setConnStatus('disconnected');
            wsRef.current = null;
            const delay = Math.min(retryRef.current, 10000);
            retryRef.current = delay * 2;
            setTimeout(connect, delay);
        };

        ws.onerror = () => {
            ws.close();
        };

        wsRef.current = ws;
    }, []);

    useEffect(() => {
        connect();
        return () => { wsRef.current?.close(); };
    }, [connect]);

    // Phase 5b.3: Alt+M (mute), Alt+S (settings), Alt+Y (history).
    // Skipped when focus is in any input/textarea/contenteditable so the user
    // can still type the letters in the enemy-picker search field.
    const toggleMute = useCallback(async () => {
        const next = !ttsMuted;
        setTtsMuted(next);
        try {
            await fetch(`${RAIJIN_API}/api/settings/tts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ muted: next }),
            });
        } catch {
            /* swallow — WS settings_update will reconcile if it arrives */
        }
    }, [ttsMuted]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (!e.altKey) return;
            const target = e.target as HTMLElement | null;
            const tag = target?.tagName;
            if (
                tag === 'INPUT' ||
                tag === 'TEXTAREA' ||
                tag === 'SELECT' ||
                target?.isContentEditable
            ) {
                return;
            }
            const key = e.key.toLowerCase();
            if (key === 'm') {
                e.preventDefault();
                void toggleMute();
            } else if (key === 's') {
                e.preventDefault();
                setSettingsOpen(v => !v);
            } else if (key === 'y') {
                // Y for "yester-Y" (history). Alt+H clashes with Firefox's
                // Help menu, so Alt+Y is safer across browsers.
                e.preventDefault();
                setHistoryOpen(v => !v);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [toggleMute]);

    // Tick every 5s so age-based filtering re-evaluates
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 5000);
        return () => clearInterval(id);
    }, []);

    // Phase 5b.4: grace window on the offline banner. connStatus defaults to
    // 'disconnected' on mount, so the banner would flash on every page load.
    // Only show once disconnection has lasted ≥3s.
    const [showOfflineBanner, setShowOfflineBanner] = useState(false);
    useEffect(() => {
        if (serverStatus !== 'ready' || connStatus !== 'disconnected') {
            setShowOfflineBanner(false);
            return;
        }
        const t = setTimeout(() => setShowOfflineBanner(true), 3000);
        return () => clearTimeout(t);
    }, [serverStatus, connStatus]);

    // Phase 1 (#6): the PacingController is the single source of what shows.
    // A frozen board evaluates age at the moment the game ended, so review
    // cards don't silently age out while you read them.
    const effectiveNow = gameEnded ? endedAtRef.current : now;
    const recs = useMemo(
        () => visibleRecs(recommendations, effectiveNow, role),
        [recommendations, effectiveNow, role],
    );

    const statusColor = connStatus === 'connected' ? bcast.radiant
        : connStatus === 'connecting' ? bcast.gold : bcast.dire;
    const statusLabel = connStatus === 'connected' ? 'ONLINE'
        : connStatus === 'connecting' ? 'SYNC..' : 'OFFLINE';

    const liveBoard = !!heroData;

    // Compact console-header controls (live board): role letters + voice + gear.
    const ROLE_LETTER: Record<Role, string> = {
        carry: 'C', mid: 'M', offlane: 'O', soft_support: '4', hard_support: '5',
    };
    const consoleControls = (
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 'none' }}>
            {ROLES.map(r => (
                <button
                    key={r.id}
                    onClick={() => pickRole(role === r.id ? null : r.id)}
                    aria-pressed={role === r.id}
                    title={`Coach me as ${r.label}`}
                    style={{
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        fontFamily: console_.mono, fontSize: 11, letterSpacing: '.08em',
                        color: role === r.id ? console_.amber : console_.ghost,
                        padding: '2px 3px', fontWeight: role === r.id ? 700 : 400,
                    }}
                >
                    {ROLE_LETTER[r.id]}
                </button>
            ))}
            {ttsEnabled && (
                <button
                    onClick={toggleMute}
                    aria-label={ttsMuted ? 'Unmute voice coaching (Alt+M)' : 'Mute voice coaching (Alt+M)'}
                    style={{
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        fontFamily: console_.mono, fontSize: 10, letterSpacing: '.14em',
                        color: ttsMuted ? console_.dire : console_.chrome, padding: '2px 4px',
                    }}
                >
                    {ttsMuted ? 'MUTED' : 'VOICE'}
                </button>
            )}
            <button
                onClick={() => setSettingsOpen(true)}
                aria-label="Open Raijin settings (Alt+S)"
                style={{
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    fontSize: 13, color: console_.chrome, padding: '2px 4px',
                }}
            >
                ⚙
            </button>
        </span>
    );

    return (
        <div style={{
            position: 'absolute', top: 0, left: standalone ? 0 : SIDEBAR_W, right: 0, bottom: 0,
            overflow: 'hidden',
            background: '#050608',
            fontFamily: bcast.body,
            color: bcast.ink,
            pointerEvents: 'auto',
        }}>
            {/* Phase 5b.4: backend-offline banner — engine is up but WS disconnected. */}
            {showOfflineBanner && (
                <div
                    role="alert"
                    aria-live="polite"
                    style={{
                        position: 'absolute',
                        top: 14,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: bcast.panel,
                        border: `1px solid ${bcast.dire}`,
                        borderRadius: bcast.rSm,
                        color: bcast.dire,
                        padding: '8px 16px',
                        fontFamily: bcast.body,
                        fontSize: bcast.tSub,
                        fontWeight: 600,
                        zIndex: 30,
                    }}
                >
                    RAIJIN ENGINE OFFLINE · coaching paused · reconnecting…
                </div>
            )}

            {/* v6 Phase 4: patch-staleness banner — knowledge base behind live patch */}
            {patchStatus?.stale && !showOfflineBanner && (
                <div
                    role="status"
                    style={{
                        position: 'absolute',
                        top: 14,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: bcast.panel,
                        border: `1px solid ${bcast.gold}`,
                        borderRadius: bcast.rSm,
                        color: bcast.gold,
                        padding: '6px 16px',
                        fontFamily: bcast.body,
                        fontSize: bcast.tSub,
                        zIndex: 29,
                    }}
                >
                    PATCH DRIFT: engine on {patchStatus.engine_version} · live is{' '}
                    {patchStatus.live_version} · run /raijin-patch-update
                </div>
            )}

            {/* Phase 1 (#11 bug d): frozen review chip — the board survived game end. */}
            {gameEnded && heroData && (
                <div
                    role="status"
                    style={{
                        position: 'absolute',
                        bottom: 16,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        background: bcast.panel,
                        border: `1px solid ${bcast.blue}`,
                        borderRadius: bcast.rSm,
                        color: bcast.blue,
                        padding: '8px 16px',
                        fontSize: bcast.tSub,
                        fontWeight: 600,
                        zIndex: 28,
                    }}
                >
                    MATCH ENDED — board frozen for review
                    <button
                        onClick={dismissFrozenBoard}
                        aria-label="Dismiss the frozen board"
                        style={{
                            background: 'transparent',
                            border: `1px solid ${bcast.line}`,
                            borderRadius: 6,
                            color: bcast.ink,
                            padding: '3px 10px',
                            fontFamily: bcast.body,
                            fontSize: bcast.tLabel,
                            cursor: 'pointer',
                        }}
                    >
                        DISMISS
                    </button>
                </div>
            )}

            {/* CONSOLE live board — renders whenever a hero is live or frozen for review */}
            {liveBoard && heroData && (
                <RaijinConsole
                    heroData={heroData}
                    recs={recs}
                    stance={stance}
                    timerRail={timerRail}
                    enemyIntel={enemyIntel}
                    enemyIntelReceivedAt={enemyIntelAt}
                    enemySource={enemySource}
                    onSourceClick={() => setPickerOpen(true)}
                    role={role}
                    gameEnded={gameEnded}
                    endedAt={endedAtRef.current}
                    lastHeroAt={lastHeroAt}
                    signalLostAt={signalLostAt}
                    bracket={bracket}
                    patchVersion={patchStatus?.engine_version ?? null}
                    gapSeries={gapSeries}
                    headerControls={consoleControls}
                />
            )}

            {/* Idle screen (queue time / engine down): full controls + briefing room */}
            {!liveBoard && (
            <div style={{
                position: 'absolute', inset: 0,
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr)',
                gridTemplateRows: 'minmax(0, 1fr)',
                alignItems: 'start',
                gap: 12,
                padding: 14,
                paddingTop: 64,
                overflow: 'auto',
                background: `radial-gradient(1200px 600px at 80% -10%, ${bcast.base2} 0%, transparent 60%), ${bcast.base}`,
            }}>
            {/* Header controls: role selector + reports + engine controls */}
            <div style={{
                position: 'absolute', top: 14, right: 16, zIndex: 20,
                fontFamily: bcast.body,
                display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                justifyContent: 'flex-end',
            }}>
                {/* Phase 1 (#9): role selector — reweights what leads the glance */}
                <div role="group" aria-label="Your role (reorders coaching surfaces)" style={{
                    display: 'inline-flex', gap: 2,
                    background: bcast.panel, border: `1px solid ${bcast.line}`,
                    borderRadius: 999, padding: 3,
                }}>
                    {ROLES.map(r => (
                        <button
                            key={r.id}
                            onClick={() => pickRole(role === r.id ? null : r.id)}
                            aria-pressed={role === r.id}
                            title={`Coach me as ${r.label}`}
                            style={{
                                background: role === r.id ? bcast.gold : 'transparent',
                                color: role === r.id ? bcast.base : bcast.muted,
                                border: 'none',
                                borderRadius: 999,
                                padding: '3px 9px',
                                fontFamily: bcast.body,
                                fontSize: 11,
                                fontWeight: 700,
                                letterSpacing: '.06em',
                                cursor: 'pointer',
                            }}
                        >
                            {r.label}
                        </button>
                    ))}
                </div>
                {bracket && (
                    <span
                        title={mmrTrend ?? 'MMR trend appears after the first tracked game'}
                        style={{ ...bLabel, border: `1px solid ${bcast.line}`, borderRadius: 999, padding: '4px 10px' }}
                    >
                        {bracket}{mmrTrend ? ` · ${mmrTrend.split(';')[0]}` : ''}
                    </span>
                )}
                <HeaderButton onClick={async () => {
                    try {
                        const r = await fetch(`${RAIJIN_API}/api/post-game/latest`);
                        if (r.ok) {
                            const data = await r.json();
                            if (data) setPostGameReport(data);
                        }
                    } catch { /* no engine / no report */ }
                }} label="LAST REPORT" aria="Open the most recent post-game report" />
                <HeaderButton onClick={() => setHistoryOpen(true)} label="HISTORY" aria="Open match history (Alt+Y)" />
                <HeaderButton onClick={() => setScoutingOpen(true)} label={'▸ SCOUTING'} aria="Open scouting form to set roles + lane" />
                <HeaderButton onClick={() => setSettingsOpen(true)} label={'⚙ SETTINGS'} aria="Open Raijin settings (Alt+S)" />
                <button
                    onClick={toggleServer}
                    disabled={serverStatus === 'starting'}
                    style={{
                        background: serverStatus === 'ready' ? 'rgba(59,224,160,.12)' : bcast.panel,
                        border: `1px solid ${serverStatus === 'ready' ? bcast.radiant
                            : serverStatus === 'starting' ? bcast.gold : bcast.line}`,
                        borderRadius: 8,
                        padding: '5px 12px',
                        color: serverStatus === 'ready' ? bcast.radiant
                            : serverStatus === 'starting' ? bcast.gold : bcast.muted,
                        fontSize: bcast.tLabel,
                        fontWeight: 700,
                        fontFamily: bcast.body,
                        letterSpacing: '.08em',
                        cursor: serverStatus === 'starting' ? 'wait' : 'pointer',
                        minHeight: 30,
                    }}
                >
                    {serverStatus === 'ready' ? 'STOP ENGINE'
                        : serverStatus === 'starting' ? 'STARTING...'
                        : 'START ENGINE'}
                </button>
                <span style={{
                    ...bNum,
                    fontSize: bcast.tLabel,
                    fontWeight: 700,
                    color: statusColor,
                    letterSpacing: '.08em',
                }}>
                    [{statusLabel}]
                </span>
            </div>

            {/* Phase 1 (#8): queue-time briefing — the idle screen's main surface */}
            <RaijinBriefingRoom
                visible={serverStatus === 'ready' && !gameEnded}
                onOpenScouting={() => setScoutingOpen(true)}
            />
            {serverStatus !== 'ready' && (
                <div style={{
                    alignSelf: 'center', justifySelf: 'center', textAlign: 'center',
                    fontFamily: console_.mono, fontSize: 12, letterSpacing: '.2em',
                    color: console_.chrome, lineHeight: 2,
                }}>
                    RAIJIN CONSOLE
                    <br />
                    <span style={{ color: console_.ghost }}>
                        {serverStatus === 'starting' ? 'ENGINE STARTING…' : 'ENGINE OFFLINE — START ENGINE TO BEGIN'}
                    </span>
                </div>
            )}
            </div>
            )}

            {/* Death-timer coaching panel — never over a frozen review board */}
            {!gameEnded && <RaijinDeathPanel heroData={heroData} recommendations={recs} />}

            {/* Enemy picker modal — manually or auto-triggered */}
            <RaijinEnemyPicker
                open={pickerOpen}
                onClose={() => setPickerOpen(false)}
                onConfirm={() => {
                    // After manual set, we know the source is 'manual' — skip polling wait
                    setEnemySource('manual');
                }}
            />

            {/* v5.0 Phase 4: scouting form — manually opened from SCOUTING button.
                When submitted with enemies, it also flips enemy_source to 'manual'
                so the badge stays in sync without a second API call. */}
            <RaijinScoutingForm
                open={scoutingOpen}
                onClose={() => setScoutingOpen(false)}
                onConfirm={({ enemies }) => {
                    if (enemies && enemies.some(e => e.hero.trim() && e.role)) {
                        setEnemySource('manual');
                    }
                }}
            />

            {/* Post-game report — mounts when a game_ended message surfaces a report */}
            <RaijinPostGame
                report={postGameReport}
                onDismiss={() => setPostGameReport(null)}
                onViewHistory={() => setHistoryOpen(true)}
            />

            {/* History modal — opened from the post-game VIEW HISTORY button */}
            <RaijinHistory
                open={historyOpen}
                onClose={() => setHistoryOpen(false)}
                onSelectMatch={report => setPostGameReport(report)}
            />

            {/* Settings modal — gear-opened */}
            <RaijinSettings
                open={settingsOpen}
                onClose={() => setSettingsOpen(false)}
                enabled={ttsEnabled}
                muted={ttsMuted}
                minUrgency={ttsMinUrgency}
                onApply={async partial => {
                    try {
                        await fetch(`${RAIJIN_API}/api/settings/tts`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(partial),
                        });
                        // Optimistic local update — backend broadcast will confirm
                        if (typeof partial.enabled === 'boolean') setTtsEnabled(partial.enabled);
                        if (typeof partial.muted === 'boolean') setTtsMuted(partial.muted);
                        if (partial.min_urgency) setTtsMinUrgency(partial.min_urgency);
                    } catch {
                        /* offline — ignore */
                    }
                }}
            />
        </div>
    );
}

function HeaderButton({ onClick, label, aria }: {
    onClick: () => void; label: string; aria: string;
}) {
    return (
        <button
            onClick={onClick}
            aria-label={aria}
            title={aria}
            style={{
                background: 'transparent',
                border: `1px solid ${bcast.line}`,
                borderRadius: 8,
                color: bcast.muted,
                padding: '5px 11px',
                fontFamily: bcast.body,
                fontSize: bcast.tLabel,
                fontWeight: 600,
                letterSpacing: '.06em',
                cursor: 'pointer',
                minHeight: 30,
            }}
        >
            {label}
        </button>
    );
}

/** Play a 200ms 440Hz sine "ping" via the shared AudioContext. 5b.2 cue. */
function playSonicPing(ctx: AudioContext): void {
    try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 440;
        // Fade in/out to avoid a click at start/end.
        const t = ctx.currentTime;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.12, t + 0.015);
        gain.gain.linearRampToValueAtTime(0, t + 0.2);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.22);
    } catch {
        /* silent — ping is a nice-to-have */
    }
}

/** Decode + play base64-encoded MP3 chunks via Web Audio API. Plays a short
 * ping first, then schedules the MP3 ~220ms later so the cue doesn't overlap
 * the voice. Opt-out via TTS mute — the entire path is gated on TTS settings
 * upstream, so no extra check needed here. */
async function playTTSChunks(
    chunksB64: string[],
    ctxRef: React.MutableRefObject<AudioContext | null>,
): Promise<void> {
    try {
        // Stitch chunks into a single Uint8Array
        const totalLen = chunksB64.reduce((sum, c) => sum + atob(c).length, 0);
        const merged = new Uint8Array(totalLen);
        let offset = 0;
        for (const c of chunksB64) {
            const bin = atob(c);
            for (let i = 0; i < bin.length; i++) {
                merged[offset + i] = bin.charCodeAt(i);
            }
            offset += bin.length;
        }

        // Lazy-init a shared AudioContext
        if (!ctxRef.current) {
            const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
            if (!Ctx) return;
            ctxRef.current = new Ctx();
        }
        const ctx = ctxRef.current;
        if (!ctx) return;
        // Fire the ping immediately and schedule the voice after it finishes.
        playSonicPing(ctx);
        const buffer = await ctx.decodeAudioData(merged.buffer);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(ctx.currentTime + 0.22);
    } catch {
        // Silent — TTS failure shouldn't crash the UI
    }
}
