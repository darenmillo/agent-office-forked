// Standalone Raijin Recs entry — built via vite.raijin.config.ts and served
// by bot_manager as the :5050 RAIJIN tab (Track-4 D2/D3). No office shell,
// no Phaser: just the board, full-bleed.
import React from 'react';
import ReactDOM from 'react-dom/client';
import { RaijinRecs } from './components/RaijinRecs';

const rootElement = document.getElementById('raijin-root');
if (rootElement) {
    const root = ReactDOM.createRoot(rootElement);
    root.render(<RaijinRecs standalone />);
}
