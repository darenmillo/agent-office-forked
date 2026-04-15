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
import { pip, scanlines, glowText, glow } from '../raijinTheme';
import { RaijinHeroDisplay } from './RaijinHeroDisplay';
import { RaijinStrategy } from './RaijinStrategy';
import { RaijinActionBar } from './RaijinActionBar';
import { RaijinTeamIntel } from './RaijinTeamIntel';
import { RaijinEnemyPicker } from './RaijinEnemyPicker';
import { RaijinDeathPanel } from './RaijinDeathPanel';
import { RaijinSettings } from './RaijinSettings';
import { RaijinPostGame } from './RaijinPostGame';
import { RaijinHistory } from './RaijinHistory';
import type { PostGameReport, RecUrgency } from '../raijinTypes';

const OFFICE_API = 'http://localhost:3000';

type ConnStatus = 'connected' | 'connecting' | 'disconnected';
type ServerStatus = 'stopped' | 'starting' | 'running' | 'ready';

export function RaijinRecs() {
    const [heroData, setHeroData] = useState<HeroData | null>(null);
    const [enemyIntel, setEnemyIntel] = useState<EnemyIntelData | null>(null);
    const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
    const [connStatus, setConnStatus] = useState<ConnStatus>('disconnected');
    const [serverStatus, setServerStatus] = useState<ServerStatus>('stopped');
    // Enemy source tracking (GSI draft / bot / manual / none) — drives auto-picker open
    const [enemySource, setEnemySource] = useState<EnemySource>('none');
    const [pickerOpen, setPickerOpen] = useState(false);
    const pickerAutoOpenedRef = useRef<boolean>(false);
    // Phase 3: TTS settings (wired through to RaijinActionBar mute button)
    const [ttsEnabled, setTtsEnabled] = useState(false);
    const [ttsMuted, setTtsMuted] = useState(false);
    const [ttsMinUrgency, setTtsMinUrgency] = useState<RecUrgency>('CRITICAL');
    const [settingsOpen, setSettingsOpen] = useState(false);
    // Phase 4: post-game report state
    const [postGameReport, setPostGameReport] = useState<PostGameReport | null>(null);
    const [historyOpen, setHistoryOpen] = useState(false);
    // Web Audio playback context for TTS chunks — lazy-init on first use
    const audioCtxRef = useRef<AudioContext | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const retryRef = useRef<number>(1000);

    // Poll Raijin server status
    const checkServer = useCallback(async () => {
        try {
            const resp = await fetch(`${OFFICE_API}/api/raijin/status`);
            const data = await resp.json();
            if (data.ready) setServerStatus('ready');
            else if (data.running) setServerStatus('starting');
            else setServerStatus('stopped');
        } catch {
            setServerStatus('stopped');
        }
    }, []);

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
        if (!heroData) return;
        if (heroData.game_phase !== 'DOTA_GAMERULES_STATE_GAME_IN_PROGRESS') return;
        if (enemySource === 'none' && !pickerAutoOpenedRef.current) {
            pickerAutoOpenedRef.current = true;
            setPickerOpen(true);
        }
    }, [heroData, enemySource]);

    const toggleServer = useCallback(async () => {
        if (serverStatus === 'ready' || serverStatus === 'starting') {
            await fetch(`${OFFICE_API}/api/raijin/stop`, { method: 'POST' });
            setServerStatus('stopped');
            wsRef.current?.close();
        } else {
            setServerStatus('starting');
            await fetch(`${OFFICE_API}/api/raijin/start`, { method: 'POST' });
        }
    }, [serverStatus]);

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
                    setHeroData(update.data as unknown as HeroData);
                } else if (update.type === 'recommendations') {
                    const newRecs = (update.data as any).recommendations as Recommendation[];
                    if (newRecs?.length) {
                        const now = Date.now();
                        const stamped = newRecs.map(r => ({ ...r, receivedAt: now }));
                        setRecommendations(prev => {
                            const newSkill = stamped.some(r => r.category === 'SKILL');
                            const newItemPriorities = stamped
                                .filter(r => r.category === 'ITEM')
                                .map(r => r.priority);
                            const minNewItemPrio = newItemPriorities.length
                                ? Math.min(...newItemPriorities) : Infinity;

                            const filtered = prev.filter(old => {
                                if (old.category === 'SKILL' && newSkill) return false;
                                if (old.category === 'ITEM' && old.priority < minNewItemPrio) return false;
                                return true;
                            });

                            const merged = [...stamped, ...filtered];
                            return merged.slice(0, 50);
                        });
                    }
                } else if (update.type === 'enemy_intel') {
                    setEnemyIntel(update.data as unknown as EnemyIntelData);
                } else if (update.type === 'game_ended') {
                    setHeroData(null);
                    setEnemyIntel(null);
                    setRecommendations([]);
                    setEnemySource('none');
                    pickerAutoOpenedRef.current = false;
                    // Phase 4: fetch the latest post-game report and surface it
                    fetch(`${RAIJIN_API}/api/post-game/latest`)
                        .then(r => (r.ok ? r.json() : null))
                        .then(data => { if (data) setPostGameReport(data); })
                        .catch(() => { /* no report available */ });
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
                    if (!(update.data as any).game_active) {
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

    // Tick every 5s so age-based filtering re-evaluates
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 5000);
        return () => clearInterval(id);
    }, []);

    // Category-based expiry — different rec types have different shelf lives
    const REC_MAX_AGE: Record<string, number> = {
        ITEM: 600_000,    // 10 min — items take time to farm
        FIGHT: 600_000,   // 10 min — enemy predictions stay relevant a while
        SKILL: 120_000,   // 2 min — you either skill it or you don't
        TIMER: 60_000,    // 1 min — time-sensitive by nature
        GENERAL: Infinity, // never expire — patch tips, hero knowledge, tower state
    };

    const visibleRecs = useMemo(() => recommendations.filter(r => {
        const maxAge = REC_MAX_AGE[r.category] ?? 300_000;
        return (now - (r.receivedAt ?? now)) < maxAge;
    }), [recommendations, now]);

    const statusColor = connStatus === 'connected' ? pip.green
        : connStatus === 'connecting' ? pip.amber : pip.red;
    const statusLabel = connStatus === 'connected' ? 'ONLINE'
        : connStatus === 'connecting' ? 'SYNC..' : 'OFFLINE';

    return (
        <div style={{
            position: 'absolute', top: 0, left: 56, right: 0, bottom: 0,
            display: 'grid',
            gridTemplateColumns: '1fr 520px',
            gridTemplateRows: 'auto 1fr 190px',
            gap: 2,
            padding: pip.sp3,
            background: pip.bgDeep,
            fontFamily: pip.font,
            pointerEvents: 'auto',
        }}>
            {/* CRT scanline overlay */}
            <div style={{
                position: 'absolute', inset: 0,
                backgroundImage: scanlines,
                pointerEvents: 'none',
                zIndex: 10,
            }} />

            {/* Vignette */}
            <div style={{
                position: 'absolute', inset: 0,
                boxShadow: 'inset 0 0 150px rgba(0, 0, 0, 0.35)',
                pointerEvents: 'none',
                zIndex: 11,
            }} />

            {/* Server controls + Connection status + Settings gear */}
            <div style={{
                position: 'absolute', top: pip.sp3, right: pip.sp4, zIndex: 20,
                fontFamily: pip.font,
                display: 'flex', alignItems: 'center', gap: pip.sp3,
            }}>
                <button
                    onClick={() => setSettingsOpen(true)}
                    aria-label="Open Raijin settings"
                    title="Settings"
                    style={{
                        background: 'transparent',
                        border: `1px solid ${pip.amberFaint}`,
                        color: pip.amber,
                        padding: '4px 10px',
                        fontFamily: pip.font,
                        fontSize: pip.textSm,
                        fontWeight: 700,
                        cursor: 'pointer',
                        minHeight: 32,
                    }}
                >
                    {'\u2699'} SETTINGS
                </button>
                <button
                    onClick={toggleServer}
                    style={{
                        background: serverStatus === 'ready' ? pip.bgInset
                            : serverStatus === 'starting' ? pip.bgInset
                            : pip.bgDeep,
                        border: `1px solid ${serverStatus === 'ready' ? pip.green
                            : serverStatus === 'starting' ? pip.amber
                            : pip.amberFaint}`,
                        borderRadius: 0,
                        padding: '4px 12px',
                        color: serverStatus === 'ready' ? pip.green
                            : serverStatus === 'starting' ? pip.amber
                            : pip.amberDim,
                        fontSize: pip.textSm,
                        fontWeight: 700,
                        fontFamily: pip.font,
                        letterSpacing: 1,
                        cursor: serverStatus === 'starting' ? 'wait' : 'pointer',
                        textShadow: serverStatus === 'ready' ? glowText(pip.green, 4)
                            : serverStatus === 'starting' ? glowText(pip.amber, 4) : undefined,
                        boxShadow: serverStatus === 'ready' ? glow(pip.green, 4) : undefined,
                    }}
                    disabled={serverStatus === 'starting'}
                >
                    {serverStatus === 'ready' ? 'STOP ENGINE'
                        : serverStatus === 'starting' ? 'STARTING...'
                        : 'START ENGINE'}
                </button>
                <span style={{
                    fontSize: pip.textSm,
                    fontWeight: 700,
                    color: statusColor,
                    letterSpacing: 1,
                    textShadow: glowText(statusColor, 6),
                }}>
                    [{statusLabel}]
                </span>
            </div>

            <RaijinTeamIntel
                enemyIntel={enemyIntel}
                heroData={heroData}
                enemySource={enemySource}
                onSourceClick={() => setPickerOpen(true)}
            />
            <RaijinHeroDisplay heroData={heroData} recommendations={visibleRecs} />
            <RaijinStrategy recommendations={visibleRecs} />
            <RaijinActionBar
                recommendations={visibleRecs}
                heroData={heroData}
                ttsEnabled={ttsEnabled}
                ttsMuted={ttsMuted}
                onToggleMute={async () => {
                    const next = !ttsMuted;
                    setTtsMuted(next);
                    try {
                        await fetch(`${RAIJIN_API}/api/settings/tts`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ muted: next }),
                        });
                    } catch {
                        /* offline — state is optimistic */
                    }
                }}
            />

            {/* Death-timer coaching panel — conditional on alive=false */}
            <RaijinDeathPanel heroData={heroData} recommendations={visibleRecs} />

            {/* Enemy picker modal — manually or auto-triggered */}
            <RaijinEnemyPicker
                open={pickerOpen}
                onClose={() => setPickerOpen(false)}
                onConfirm={() => {
                    // After manual set, we know the source is 'manual' — skip polling wait
                    setEnemySource('manual');
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

/** Decode + play base64-encoded MP3 chunks via Web Audio API. */
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
        const buffer = await ctx.decodeAudioData(merged.buffer);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start();
    } catch {
        // Silent — TTS failure shouldn't crash the UI
    }
}
