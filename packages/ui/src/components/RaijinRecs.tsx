import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { HeroData, Recommendation, UIUpdate, RAIJIN_WS } from '../raijinTypes';
import { RaijinHeroDisplay } from './RaijinHeroDisplay';
import { RaijinStrategy } from './RaijinStrategy';
import { RaijinActionBar } from './RaijinActionBar';

type ConnStatus = 'connected' | 'connecting' | 'disconnected';

export function RaijinRecs() {
    const [heroData, setHeroData] = useState<HeroData | null>(null);
    const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
    const [connStatus, setConnStatus] = useState<ConnStatus>('disconnected');
    const wsRef = useRef<WebSocket | null>(null);
    const retryRef = useRef<number>(1000);

    const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) return;

        setConnStatus('connecting');
        const ws = new WebSocket(RAIJIN_WS);

        ws.onopen = () => {
            setConnStatus('connected');
            retryRef.current = 1000; // reset backoff
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
                            // Categories present in the new batch
                            const newSkill = stamped.some(r => r.category === 'SKILL');
                            const newItemPriorities = stamped
                                .filter(r => r.category === 'ITEM')
                                .map(r => r.priority);
                            const minNewItemPrio = newItemPriorities.length
                                ? Math.min(...newItemPriorities) : Infinity;

                            const filtered = prev.filter(old => {
                                // SKILL: replace all old skill recs when new ones arrive
                                if (old.category === 'SKILL' && newSkill) return false;
                                // ITEM: remove old items with lower priority than any incoming item
                                if (old.category === 'ITEM' && old.priority < minNewItemPrio) return false;
                                // TIMER / GENERAL / FIGHT: accumulate (history log)
                                return true;
                            });

                            const merged = [...stamped, ...filtered];
                            return merged.slice(0, 50); // keep last 50
                        });
                    }
                } else if (update.type === 'game_ended') {
                    setHeroData(null);
                    setRecommendations([]);
                } else if (update.type === 'connection') {
                    // Initial connection — no game active
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
            // Exponential backoff reconnect
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
        return () => {
            wsRef.current?.close();
        };
    }, [connect]);

    // Tick every 5s so age-based filtering re-evaluates
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 5000);
        return () => clearInterval(id);
    }, []);

    // Filter out stale recs (>120s) for actionable categories
    const REC_MAX_AGE_MS = 120_000;
    const visibleRecs = useMemo(() => recommendations.filter(r => {
        if (r.category === 'TIMER' || r.category === 'GENERAL') return true;
        return (now - (r.receivedAt ?? now)) < REC_MAX_AGE_MS;
    }), [recommendations, now]);

    // Connection indicator color
    const statusColor = connStatus === 'connected' ? '#00b894'
        : connStatus === 'connecting' ? '#fdcb6e' : '#d63031';

    return (
        <div style={{
            position: 'absolute', top: 0, left: 56, right: 0, bottom: 0,
            display: 'grid',
            gridTemplateColumns: '1fr 440px',
            gridTemplateRows: '1fr 180px',
            gap: 8, padding: 12,
            pointerEvents: 'auto',
        }}>
            {/* Connection status */}
            <div style={{
                position: 'absolute', top: 16, right: 16, zIndex: 20,
                display: 'flex', alignItems: 'center', gap: 6,
            }}>
                <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: statusColor,
                    boxShadow: `0 0 6px ${statusColor}`,
                }} />
                <span style={{ fontSize: 10, color: '#636e72' }}>
                    {connStatus === 'connected' ? 'Raijin Online' : connStatus === 'connecting' ? 'Connecting...' : 'Offline'}
                </span>
            </div>

            {/* Center: Hero Display */}
            <RaijinHeroDisplay heroData={heroData} recommendations={visibleRecs} />

            {/* Right: Strategy Panel */}
            <RaijinStrategy recommendations={visibleRecs} />

            {/* Bottom: Action Bar */}
            <RaijinActionBar recommendations={visibleRecs} heroData={heroData} />
        </div>
    );
}
