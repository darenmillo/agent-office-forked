/** THE CASTER BUG — Electron main process.
 *
 * A transparent, click-through, always-on-top strip over the game
 * (Win10 borderless-fullscreen: verified viable by the TRACK-3 inventory).
 * Electron over Tauri: no Rust toolchain on this machine; Node 22 is here.
 *
 * All controls live OUTSIDE the game surface: a tray menu (show/hide,
 * monitor picker, quit) and a global hotkey (Alt+Shift+R). The strip itself
 * has zero click targets — setIgnoreMouseEvents(true) end to end.
 */

import { app, BrowserWindow, globalShortcut, Menu, nativeImage, screen, Tray } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

const STRIP_WIDTH = 760;
const STRIP_HEIGHT = 92;
const TOP_MARGIN = 10;
const HOTKEY = 'Alt+Shift+R';

interface OverlayConfig {
    displayId: number | null;
    visible: boolean;
}

let win: BrowserWindow | null = null;
let tray: Tray | null = null;
let config: OverlayConfig = { displayId: null, visible: true };

function configPath(): string {
    return path.join(app.getPath('userData'), 'overlay-config.json');
}

function loadConfig(): void {
    try {
        config = { ...config, ...JSON.parse(fs.readFileSync(configPath(), 'utf-8')) };
    } catch {
        /* first run — defaults stand */
    }
}

function saveConfig(): void {
    try {
        fs.writeFileSync(configPath(), JSON.stringify(config));
    } catch {
        /* non-fatal — config just won't persist */
    }
}

function targetDisplay(): Electron.Display {
    const displays = screen.getAllDisplays();
    return displays.find(d => d.id === config.displayId) ?? screen.getPrimaryDisplay();
}

function position(): { x: number; y: number } {
    const { workArea } = targetDisplay();
    return {
        x: Math.round(workArea.x + (workArea.width - STRIP_WIDTH) / 2),
        y: workArea.y + TOP_MARGIN,
    };
}

function createWindow(): void {
    const { x, y } = position();
    win = new BrowserWindow({
        width: STRIP_WIDTH,
        height: STRIP_HEIGHT,
        x,
        y,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        movable: false,
        focusable: false,
        hasShadow: false,
        webPreferences: {
            // Local trusted overlay: the renderer only opens ws://localhost:4000
            // and loads no remote content. nodeIntegration keeps the compiled
            // CommonJS renderer loadable without a bundler.
            nodeIntegration: true,
            contextIsolation: false,
        },
    });
    // 'screen-saver' level floats above borderless-fullscreen games.
    win.setAlwaysOnTop(true, 'screen-saver');
    win.setIgnoreMouseEvents(true);
    win.loadFile(path.join(__dirname, '..', 'overlay.html'));
    if (!config.visible) win.hide();
    win.on('closed', () => {
        win = null;
    });
}

function applyVisibility(): void {
    if (!win) return;
    if (config.visible) win.show();
    else win.hide();
    saveConfig();
    rebuildTray();
}

function reposition(): void {
    if (!win) return;
    const { x, y } = position();
    win.setBounds({ x, y, width: STRIP_WIDTH, height: STRIP_HEIGHT });
}

/** 16x16 gold dot — generated so the repo carries no binary asset. */
function trayIcon(): Electron.NativeImage {
    const png =
        'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAaUlEQVR4nGNgGAWDHzAyMPz/' +
        'z8DAwMDIyPgfXQxdDbICdAX/kQzBpQjZAAZ0m/8zMDAwoRvAhMUJ/9EUMKAbwsCAxQno/kU3' +
        'BKsBDFgU4DUAmwG4DMFrAD5DkA3BawAhQ/AaQIwhg9sAABm7IQnf2havAAAAAElFTkSuQmCC';
    return nativeImage.createFromDataURL(`data:image/png;base64,${png}`);
}

function rebuildTray(): void {
    if (!tray) return;
    const displays = screen.getAllDisplays();
    const menu = Menu.buildFromTemplate([
        {
            label: config.visible ? `Hide strip (${HOTKEY})` : `Show strip (${HOTKEY})`,
            click: () => {
                config.visible = !config.visible;
                applyVisibility();
            },
        },
        {
            label: 'Monitor',
            submenu: displays.map((d, i) => ({
                label: `${i + 1}: ${d.bounds.width}x${d.bounds.height}${d.id === targetDisplay().id ? '  ✓' : ''}`,
                click: () => {
                    config.displayId = d.id;
                    saveConfig();
                    reposition();
                    rebuildTray();
                },
            })),
        },
        { type: 'separator' },
        { label: 'Quit caster bug', click: () => app.quit() },
    ]);
    tray.setContextMenu(menu);
    tray.setToolTip('Raijin caster bug');
}

app.whenReady().then(() => {
    loadConfig();
    createWindow();
    tray = new Tray(trayIcon());
    rebuildTray();
    globalShortcut.register(HOTKEY, () => {
        config.visible = !config.visible;
        applyVisibility();
    });
    screen.on('display-metrics-changed', reposition);
    screen.on('display-added', () => {
        reposition();
        rebuildTray();
    });
    screen.on('display-removed', () => {
        config.displayId = null;
        reposition();
        rebuildTray();
    });
});

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => app.quit());
