import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { HeroData, Recommendation, UIUpdate, RAIJIN_WS } from '../raijinTypes';
import { pip, scanlines, glowText, glow } from '../raijinTheme';
import { RaijinHeroDisplay } from './RaijinHeroDisplay';
import { RaijinStrategy } from './RaijinStrategy';
import { RaijinActionBar } from './RaijinActionBar';

const OFFICE_API = 'http://localhost:3000';

type ConnStatus = 'connected' | 'connecting' | 'disconnected';
type ServerStatus = 'stopped' | 'starting' | 'running' | 'ready';

export function RaijinRecs() {
    const [heroData, setHeroData] = useState<HeroData | null>(null);
    const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
    const [connStatus, setConnStatus] = useState<ConnStatus>('disconnected');
    const [serverStatus, setServerStatus] = useState<ServerStatus>('stopped');
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
                } else if (update.type === 'game_ended') {
                    setHeroData(null);
                    setRecommendations([]);
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
            gridTemplateRows: '1fr 190px',
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

            {/* Server controls + Connection status */}
            <div style={{
                position: 'absolute', top: pip.sp3, right: pip.sp4, zIndex: 20,
                fontFamily: pip.font,
                display: 'flex', alignItems: 'center', gap: pip.sp3,
            }}>
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

            <RaijinHeroDisplay heroData={heroData} recommendations={visibleRecs} />
            <RaijinStrategy recommendations={visibleRecs} />
            <RaijinActionBar recommendations={visibleRecs} heroData={heroData} />
        </div>
    );
}
