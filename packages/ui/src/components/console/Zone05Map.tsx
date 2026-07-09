/** 05 · MAP DISCIPLINE — the schematic instrument.
 *
 *  Data honesty: GSI exposes no player/death positions today, so the player
 *  dot, death triangles, and quadrant shading from the design are OMITTED
 *  (backend ask: position feed via the GSI minimap probe). What renders is
 *  the schematic frame (river, Rosh pit, world labels) and the real death
 *  count — no invented positions, ever. */
import React from 'react';
import { console_ } from '../../raijinTheme';
import { ZoneLabel, Micro } from './shared';

export function Zone05Map({ deaths }: { deaths: number }) {
    return (
        <div style={{
            borderRight: `1px solid ${console_.line}`,
            padding: '16px 26px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            minWidth: 0,
        }}>
            <div style={{ alignSelf: 'stretch' }}>
                <ZoneLabel label="05 · MAP DISCIPLINE" right={<Micro>AWAITING POSITION FEED</Micro>} />
            </div>
            <div style={{ position: 'relative', width: 186, height: 186, flex: 'none' }}>
                <svg viewBox="0 0 230 230" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                    <rect x="1" y="1" width="228" height="228" fill="none" stroke={console_.line} strokeWidth="1" />
                    <path d="M4,226 L226,4" stroke={console_.river} strokeWidth="10" opacity=".5" />
                    <path d="M0,230 L115,115" stroke={console_.line2} strokeWidth="1" />
                    <path d="M115,115 L230,0" stroke={console_.line2} strokeWidth="1" />
                    <circle cx="172" cy="44" r="9" fill="none" stroke={console_.gold} strokeWidth="1.5" />
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
                    ? <>▲ <b style={{ color: console_.body }}>{deaths} death{deaths === 1 ? '' : 's'}</b> this game — position marks land when the feed ships.</>
                    : 'No deaths this game.'}
            </div>
        </div>
    );
}
