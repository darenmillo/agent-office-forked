// ConsoleCapture must be imported first — patches console.error/warn + window.onerror
// before Phaser and React initialize so their startup errors are captured.
import './debug/ConsoleCapture';
import { errorOverlay } from './debug/ErrorOverlay';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { setupPhaser } from './game/Game';

// Start React UI overlay
const rootElement = document.getElementById('ui-root');
if (rootElement) {
    const root = ReactDOM.createRoot(rootElement);
    root.render(<App />);
}

// Start Phaser Game Engine (appends canvas synchronously — DOM stable after this)
setupPhaser('phaser-container');

// Mount debug error overlay — DOM only, no Phaser dependency, backtick (`) to toggle
errorOverlay.mount();
