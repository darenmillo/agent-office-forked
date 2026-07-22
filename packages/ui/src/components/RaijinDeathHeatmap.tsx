/** Death heatmap (Wave 3b, Track F / capability-map ADD #5).
 *
 * The killer post-game surface: your last ~20 games' deaths plotted on the map
 * with their leak flags. Ward-walkthrough clusters light up dire-red; caught-
 * out deaths ring amber. Undeniable — it turns "52% ward-walkthrough deaths"
 * from a sentence into a picture of the exact river-crossing you keep dying at.
 *
 * Fed by GET /api/death-heatmap (0 new Stratz requests — rides the cached
 * mine). Honest: renders nothing until the feed lands. Console token language.
 */
import React, { useEffect, useState } from 'react';
import { RAIJIN_API } from '../raijinTypes';
import { console_ as C } from '../raijinTheme';

interface DeathPoint { x: number; y: number; minute: number; ward_walk: boolean; caught: boolean }

const SIZE = 186; // px, matching the console MAP schematic

export function RaijinDeathHeatmap() {
    const [points, setPoints] = useState<DeathPoint[] | null>(null);
    const [tried, setTried] = useState(false);

    useEffect(() => {
        let cancelled = false;
        fetch(`${RAIJIN_API}/api/death-heatmap`)
            .then(r => (r.ok ? r.json() : null))
            .then(d => { if (!cancelled && d?.points?.length) setPoints(d.points); })
            .catch(() => { /* honest empty state */ })
            .finally(() => { if (!cancelled) setTried(true); });
        return () => { cancelled = true; };
    }, []);

    if (!tried) return null;
    if (!points?.length) return null;

    const wardCount = points.filter(p => p.ward_walk).length;
    const caughtCount = points.filter(p => p.caught).length;
    // Stratz coordinates ride a 0-255 grid but real deaths only span the
    // playable window (~62-190 x / ~66-186 y per the capability map) — the
    // old full-grid normalization bunched every point into a center blob
    // (field bug A-4). Normalize over the observed extent (padded) and clamp
    // outliers inside the frame. SVG y stays inverted (y = north).
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    const pad = 8;
    const xMin = Math.min(...xs) - pad, xMax = Math.max(...xs) + pad;
    const yMin = Math.min(...ys) - pad, yMax = Math.max(...ys) + pad;
    const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
    const px = (v: number) => clamp01((v - xMin) / Math.max(1, xMax - xMin)) * SIZE;
    const py = (v: number) => SIZE - clamp01((v - yMin) / Math.max(1, yMax - yMin)) * SIZE;

    return (
        <div style={{ marginTop: 20 }}>
            <div style={{
                fontFamily: C.mono, fontSize: 11, letterSpacing: '.26em',
                textTransform: 'uppercase', color: C.chrome, marginBottom: 10,
            }}>
                DEATH HEATMAP · LAST {points.length} DEATHS
            </div>
            <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                <svg width={SIZE} height={SIZE} style={{ border: `1px solid ${C.line}`, background: C.base2, flexShrink: 0 }}>
                    {/* river diagonal */}
                    <line x1={0} y1={SIZE} x2={SIZE} y2={0} stroke="#2A3B4D" strokeWidth={10} opacity={0.5} />
                    {/* death points: ward-walkthrough = filled dire, caught = amber ring, else muted */}
                    {points.map((p, i) => (
                        <circle
                            key={i}
                            cx={px(p.x)}
                            cy={py(p.y)}
                            r={p.ward_walk ? 4 : 3}
                            fill={p.ward_walk ? C.dire : 'none'}
                            fillOpacity={p.ward_walk ? 0.55 : 0}
                            stroke={p.ward_walk ? C.dire : p.caught ? C.amber : C.chrome}
                            strokeWidth={1.2}
                            strokeOpacity={0.85}
                        />
                    ))}
                </svg>
                <div style={{ fontFamily: C.reading, fontSize: 13.5, color: C.body, lineHeight: 1.6, maxWidth: 320 }}>
                    <div style={{ fontFamily: C.display, fontSize: 20, color: C.dire, fontWeight: 700 }}>
                        {Math.round((wardCount / points.length) * 100)}%
                    </div>
                    <div style={{ marginBottom: 8 }}>
                        of these deaths were <span style={{ color: C.dire }}>ward-walkthroughs</span> — you crossed a
                        spot the enemy had vision on.
                    </div>
                    <div style={{ color: C.muted }}>
                        <span style={{ color: C.amber }}>◦ {caughtCount}</span> caught out of a fight ·
                        <span style={{ color: C.dire }}> ● {wardCount}</span> ward-walk ·
                        buy a sentry for the clusters.
                    </div>
                </div>
            </div>
        </div>
    );
}
