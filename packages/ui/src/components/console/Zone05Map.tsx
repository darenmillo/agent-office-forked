/** 05 · MAP DISCIPLINE — the schematic instrument.
 *
 *  Data honesty: the player dot renders only from live GSI world coordinates
 *  (HERO_STATUS xpos/ypos) and death triangles only from ledger-recorded
 *  death positions (death-rec meta) — no invented positions, ever. Engines
 *  without the position feed degrade to the schematic + real death count. */
import React from 'react';
import { console_ } from '../../raijinTheme';
import { worldToMap } from '../../console';
import { ZoneLabel, Micro } from './shared';

const MAP_VB = 230;

interface Props {
    deaths: number;
    deathSpots: Array<{ x: number; y: number }>;
    heroX: number | null;
    heroY: number | null;
    alive: boolean;
}

export function Zone05Map({ deaths, deathSpots, heroX, heroY, alive }: Props) {
    const hasPositions = heroX !== null && heroY !== null;
    const player = hasPositions ? worldToMap(heroX!, heroY!, MAP_VB) : null;
    const marks = deathSpots.map(s => worldToMap(s.x, s.y, MAP_VB));

    return (
        <div style={{
            borderRight: `1px solid ${console_.line}`,
            padding: '16px 26px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            minWidth: 0,
        }}>
            <div style={{ alignSelf: 'stretch' }}>
                <ZoneLabel
                    label="05 · MAP DISCIPLINE"
                    right={<Micro>{hasPositions ? 'POSITIONS · GSI' : 'AWAITING POSITION FEED'}</Micro>}
                />
            </div>
            <div style={{ position: 'relative', width: 186, height: 186, flex: 'none' }}>
                <svg viewBox={`0 0 ${MAP_VB} ${MAP_VB}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                    <rect x="1" y="1" width="228" height="228" fill="none" stroke={console_.line} strokeWidth="1" />
                    <path d="M4,226 L226,4" stroke={console_.river} strokeWidth="10" opacity=".5" />
                    <path d="M0,230 L115,115" stroke={console_.line2} strokeWidth="1" />
                    <path d="M115,115 L230,0" stroke={console_.line2} strokeWidth="1" />
                    <circle cx="172" cy="44" r="9" fill="none" stroke={console_.gold} strokeWidth="1.5" />
                    {marks.map((m, i) => (
                        <path
                            key={`dm${i}`}
                            d={`M${m.x.toFixed(1)},${(m.y + 5).toFixed(1)} l5,-9 h-10 z`}
                            fill={console_.dire}
                        />
                    ))}
                    {player && (
                        <circle
                            className="console-player-pulse"
                            cx={player.x.toFixed(1)}
                            cy={player.y.toFixed(1)}
                            r="4.5"
                            fill={alive ? console_.amber : console_.dire}
                        >
                            <animate attributeName="r" values="4;6.5;4" dur="2.4s" repeatCount="indefinite" />
                        </circle>
                    )}
                </svg>
                <span style={{ position: 'absolute', left: 8, top: 6, fontSize: 9, letterSpacing: '.22em', color: console_.amber, fontFamily: console_.mono }}>
                    YOUR WORLD
                </span>
                <span style={{ position: 'absolute', right: 6, bottom: 6, fontSize: 9, letterSpacing: '.22em', color: console_.ghost, fontFamily: console_.mono }}>
                    THEIR MAP
                </span>
                <span style={{ position: 'absolute', right: 34, top: 24, fontSize: 9, letterSpacing: '.18em', color: console_.gold, fontFamily: console_.mono }}>
                    ROSH
                </span>
            </div>
            <div style={{
                fontFamily: console_.reading, fontSize: console_.tCaption, lineHeight: 1.5,
                color: console_.muted, textAlign: 'center', maxWidth: 320,
            }}>
                {deaths > 0
                    ? marks.length > 0
                        ? <>▲ <b style={{ color: console_.body }}>{deaths} death{deaths === 1 ? '' : 's'}</b> — clusters are the habit to break.</>
                        : <>▲ <b style={{ color: console_.body }}>{deaths} death{deaths === 1 ? '' : 's'}</b> this game — position marks land as deaths are recorded.</>
                    : 'No deaths this game.'}
            </div>
        </div>
    );
}
