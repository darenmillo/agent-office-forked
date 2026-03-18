import Phaser from 'phaser';
import * as Colyseus from 'colyseus.js';
import { OfficeState, AgentState } from './schema';
import { eventBus } from '../events';

let activeRoom: Colyseus.Room<OfficeState> | undefined;

export function getColyseusRoom() {
    return activeRoom;
}

export class OfficeScene extends Phaser.Scene {
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private room?: Colyseus.Room;
    private agentSprites: Map<string, Phaser.GameObjects.Container> = new Map();
    private agentMeta: Map<string, { sprite: any; charKey: string; thoughtBubble: Phaser.GameObjects.Text; emoteBubble: Phaser.GameObjects.Text; lastAction: string }> = new Map();
    private idleTweens: Map<string, Phaser.Tweens.Tween> = new Map();
    private workingTweens: Map<string, Phaser.Tweens.Tween> = new Map();
    private statusText!: Phaser.GameObjects.Text;
    private followTarget: Phaser.GameObjects.Container | null = null;

    constructor() {
        super('OfficeScene');
    }

    preload() {
        for (let i = 0; i < 6; i++) {
            this.load.spritesheet(`char_${i}`, `/assets/characters/char_${i}.png`, {
                frameWidth: 16,
                frameHeight: 32
            });
        }
    }

    create() {
        try {
            console.log("Phaser create() started");
            this.statusText = this.add.text(10, 10, 'Colyseus Sync: Connecting...', { color: '#ffffaa', fontSize: '14px' });
            this.statusText.setScrollFactor(0);
            this.statusText.setDepth(100);

            let hasAnims = false;

            // Create walk animations for all 6 character sprites
            for (let i = 0; i < 6; i++) {
                const key = `char_${i}`;
                if (this.textures.exists(key)) {
                    const anims = this.anims;
                    anims.create({ key: `${key}-walk-down`,  frames: anims.generateFrameNumbers(key, { start: 0, end: 2 }),   frameRate: 8, repeat: -1 });
                    anims.create({ key: `${key}-walk-up`,    frames: anims.generateFrameNumbers(key, { start: 7, end: 9 }),   frameRate: 8, repeat: -1 });
                    anims.create({ key: `${key}-walk-right`, frames: anims.generateFrameNumbers(key, { start: 14, end: 16 }), frameRate: 8, repeat: -1 });
                    if (i === 0) hasAnims = true;
                }
            }

            console.log("Animations created: ", hasAnims);

            const gridSize = 64 * 16; // 1024px — Vault expansion
            const g = this.add.graphics();

            // ═══════════════════════════════════════════
            //  VAULT FLOOR — reinforced steel plates
            // ═══════════════════════════════════════════

            // Base slab — cold near-black steel
            g.fillStyle(0x080810, 1);
            g.fillRect(0, 0, gridSize, gridSize);

            // Walkable interior floor (slightly lighter)
            g.fillStyle(0x0d0d18, 1);
            g.fillRect(16, 16, gridSize - 32, gridSize - 32);

            // Zone floors (distinct tints per department)
            g.fillStyle(0x0f1520, 1); // Command — cool blue
            g.fillRect(288, 32, 448, 176);
            g.fillStyle(0x0a100a, 1); // Intel Wing — dark green
            g.fillRect(32, 224, 208, 272);
            g.fillStyle(0x0d1008, 1); // Engineering — dark olive
            g.fillRect(272, 272, 320, 256);
            g.fillStyle(0x100d08, 1); // Broadcast/Ops — dark amber
            g.fillRect(640, 224, 256, 272);
            g.fillStyle(0x0a0808, 1); // Trading Vault — dark red
            g.fillRect(32, 640, 320, 256);

            // Hazard stripe helper (entrance / zone transitions)
            const drawHazardStripe = (x: number, y: number, w: number, h: number) => {
                const stripeW = 8;
                const isHoriz = w > h;
                const count = isHoriz ? Math.ceil(w / stripeW) : Math.ceil(h / stripeW);
                for (let i = 0; i < count; i++) {
                    g.fillStyle(i % 2 === 0 ? 0xffaa00 : 0x1a1a1a, 0.6);
                    if (isHoriz) g.fillRect(x + i * stripeW, y, Math.min(stripeW, w - i * stripeW), h);
                    else g.fillRect(x, y + i * stripeW, w, Math.min(stripeW, h - i * stripeW));
                }
            };
            drawHazardStripe(272, 16, 480, 8); // vault entrance strip

            // ═══════════════════════════════════════════
            //  VAULT WALLS & ROOM BORDERS
            // ═══════════════════════════════════════════

            // Zone 1: Overseer's Deck
            g.lineStyle(3, 0x00c030, 0.95);
            g.strokeRect(288, 32, 448, 176);
            g.fillStyle(0x0d0d18, 1);
            g.fillRect(480, 204, 64, 6);   // door gap (bottom)
            g.lineStyle(2, 0x00ff41, 0.7);
            g.beginPath(); g.moveTo(480, 208); g.lineTo(480, 196); g.lineTo(544, 196); g.lineTo(544, 208); g.strokePath();

            // Zone 2: Intelligence Wing
            g.lineStyle(3, 0x00c030, 0.95);
            g.strokeRect(32, 224, 208, 272);
            g.fillStyle(0x0d0d18, 1);
            g.fillRect(236, 340, 6, 48);   // door gap (right)
            g.lineStyle(2, 0x00ff41, 0.7);
            g.beginPath(); g.moveTo(240, 340); g.lineTo(248, 340); g.lineTo(248, 388); g.lineTo(240, 388); g.strokePath();

            // Zone 3: Engineering Bay
            g.lineStyle(3, 0x00c030, 0.95);
            g.strokeRect(272, 272, 320, 256);
            g.fillStyle(0x0d0d18, 1);
            g.fillRect(384, 268, 64, 6);   // door gap (top)

            // Zone 4: Broadcast / Ops Wing
            g.lineStyle(3, 0x00c030, 0.95);
            g.strokeRect(640, 224, 256, 272);
            g.fillStyle(0x0d0d18, 1);
            g.fillRect(636, 330, 6, 48);   // door gap (left)

            // Zone 5: Trading Vault
            g.lineStyle(3, 0x00c030, 0.95);
            g.strokeRect(32, 640, 320, 256);
            g.fillStyle(0x0d0d18, 1);
            g.fillRect(144, 636, 64, 6);   // door gap (top)
            g.lineStyle(5, 0xffaa00, 0.8);
            g.beginPath(); g.moveTo(32, 640); g.lineTo(32, 896); g.strokePath(); // vault door indicator

            // Vault outer perimeter — thick steel border
            g.lineStyle(4, 0x1a1a2a, 1);
            g.strokeRect(8, 8, gridSize - 16, gridSize - 16);
            // Pip-Boy green corner bolts
            [[8, 8], [gridSize - 8, 8], [8, gridSize - 8], [gridSize - 8, gridSize - 8]].forEach(([cx, cy]) => {
                g.fillStyle(0x00ff41, 0.8);
                g.fillCircle(cx, cy, 4);
            });

            // Zone labels
            this.add.text(512, 44,  '⬡ OVERSEER\'S DECK — COMMAND', { fontSize: '10px', color: '#00ff41' }).setOrigin(0.5);
            this.add.text(136, 238, '⬡ INTELLIGENCE WING',          { fontSize: '9px',  color: '#00c030' }).setOrigin(0.5);
            this.add.text(432, 286, '⬡ ENGINEERING BAY',             { fontSize: '9px',  color: '#00c030' }).setOrigin(0.5);
            this.add.text(768, 238, '⬡ BROADCAST / OPS',             { fontSize: '9px',  color: '#00c030' }).setOrigin(0.5);
            this.add.text(192, 654, '⬡ TRADING VAULT',               { fontSize: '9px',  color: '#ffaa00' }).setOrigin(0.5);

            // ═══════════════════════════════════════════
            //  FURNITURE & TERMINAL HELPERS
            // ═══════════════════════════════════════════

            // Pip-Boy terminal (dark screen + green glow + scanlines)
            const drawTerminal = (tx: number, ty: number, tw: number, th: number) => {
                g.fillStyle(0x001400, 1);
                g.fillRect(tx, ty, tw, th);
                g.fillStyle(0x00ff41, 0.18);
                g.fillRect(tx + 1, ty + 1, tw - 2, th - 2);
                g.lineStyle(1, 0x00c030, 0.9);
                g.strokeRect(tx, ty, tw, th);
                // scanlines
                g.fillStyle(0x00ff41, 0.04);
                for (let sl = ty + 2; sl < ty + th; sl += 3) {
                    g.fillRect(tx + 1, sl, tw - 2, 1);
                }
            };

            // Server rack unit
            const drawServerRack = (rx: number, ry: number) => {
                g.fillStyle(0x0f0f1a, 0.9);
                g.fillRect(rx, ry, 24, 64);
                g.lineStyle(1, 0x2a2a40, 1);
                g.strokeRect(rx, ry, 24, 64);
                for (let bay = 0; bay < 7; bay++) {
                    g.fillStyle(0x1a1a2a, 1);
                    g.fillRect(rx + 2, ry + 2 + bay * 9, 20, 7);
                    g.fillStyle(Math.random() > 0.3 ? 0x00ff41 : 0x003300, 1);
                    g.fillRect(rx + 18, ry + 4 + bay * 9, 2, 2);
                }
            };

            // Hazard warning triangle
            const drawWarning = (wx: number, wy: number) => {
                g.fillStyle(0xffaa00, 0.7);
                g.fillTriangle(wx, wy - 8, wx - 6, wy + 4, wx + 6, wy + 4);
                g.fillStyle(0x0a0a0a, 1);
                g.fillRect(wx - 1, wy - 3, 2, 5);
                g.fillRect(wx - 1, wy + 3, 2, 2);
            };

            // ═══════════════════════════════════════════
            //  OVERSEER'S DECK FURNITURE
            // ═══════════════════════════════════════════

            // Central command console
            g.fillStyle(0x151520, 0.85);
            g.fillRect(352, 80, 288, 80);
            g.fillStyle(0x1e1e30, 0.85);
            g.fillRect(356, 84, 280, 72);
            // Five command terminals across console
            drawTerminal(364, 88, 40, 28);
            drawTerminal(412, 88, 40, 28);
            drawTerminal(460, 88, 40, 28);
            drawTerminal(508, 88, 40, 28);
            drawTerminal(556, 88, 40, 28);

            // Holographic display (overhead strip)
            g.fillStyle(0x001a10, 0.7);
            g.fillRect(430, 48, 152, 28);
            g.lineStyle(1, 0x00ff41, 0.5);
            g.strokeRect(430, 48, 152, 28);
            g.lineStyle(1, 0x00ff41, 0.15);
            g.beginPath();
            for (let sl = 52; sl < 76; sl += 4) { g.moveTo(434, sl); g.lineTo(578, sl); }
            g.strokePath();
            // Vault-Tec badge
            g.fillStyle(0xffaa00, 0.6);
            g.fillRect(490, 52, 32, 20);
            g.fillStyle(0x1a0a00, 1);
            g.fillRect(492, 54, 28, 16);
            this.add.text(506, 62, 'VT', { fontSize: '10px', color: '#ffaa00', fontStyle: 'bold' }).setOrigin(0.5);

            // ═══════════════════════════════════════════
            //  INTELLIGENCE WING FURNITURE
            // ═══════════════════════════════════════════

            // Research terminals (3 units)
            drawTerminal(48, 272, 36, 24);
            drawTerminal(92, 272, 36, 24);
            drawTerminal(136, 272, 36, 24);

            // Data archive — filing cabinets + data tapes
            g.fillStyle(0x141420, 0.85);
            g.fillRect(40, 320, 80, 96);
            g.lineStyle(1, 0x00c030, 0.5);
            for (let shelf = 0; shelf < 5; shelf++) {
                g.strokeRect(40, 320 + shelf * 20, 80, 20);
            }
            const tapeColors = [0x00ff41, 0xffaa00, 0x0088ff, 0xff4444, 0x44ffff];
            for (let s = 0; s < 4; s++) {
                for (let t = 0; t < 4; t++) {
                    g.fillStyle(tapeColors[(s + t) % 5], 0.7);
                    g.fillRect(44 + t * 18, 323 + s * 20, 12, 14);
                }
            }

            // Codebreaker console (bottom of wing)
            g.fillStyle(0x0a140a, 0.85);
            g.fillRect(48, 432, 168, 40);
            drawTerminal(56, 436, 60, 28);
            drawTerminal(124, 436, 60, 28);

            // ═══════════════════════════════════════════
            //  ENGINEERING BAY FURNITURE
            // ═══════════════════════════════════════════

            // Server rack cluster (4 units)
            drawServerRack(288, 304);
            drawServerRack(320, 304);
            drawServerRack(288, 384);
            drawServerRack(320, 384);

            // Central workbench
            g.fillStyle(0x15151e, 0.85);
            g.fillRect(368, 320, 160, 48);
            g.fillStyle(0x1e1e2a, 0.85);
            g.fillRect(372, 324, 152, 40);
            drawTerminal(376, 328, 44, 28);
            drawTerminal(426, 328, 44, 28);
            drawTerminal(476, 328, 44, 28);

            // Power conduit lines (horizontal)
            g.lineStyle(2, 0xffaa00, 0.4);
            g.beginPath(); g.moveTo(272, 310); g.lineTo(590, 310); g.strokePath();
            g.lineStyle(2, 0xffaa00, 0.25);
            g.beginPath(); g.moveTo(272, 450); g.lineTo(590, 450); g.strokePath();

            // ═══════════════════════════════════════════
            //  BROADCAST / OPS WING FURNITURE
            // ═══════════════════════════════════════════

            // Broadcast console
            g.fillStyle(0x15100a, 0.85);
            g.fillRect(660, 260, 200, 40);
            g.fillStyle(0x1e180a, 0.85);
            g.fillRect(664, 264, 192, 32);
            drawTerminal(668, 268, 40, 20);
            drawTerminal(716, 268, 40, 20);
            drawTerminal(764, 268, 40, 20);
            drawTerminal(812, 268, 40, 20);

            // Radio tower / antenna
            g.fillStyle(0x0a0a0a, 1);
            g.fillRect(840, 320, 16, 80);
            g.lineStyle(1, 0xffaa00, 0.8);
            g.strokeRect(840, 320, 16, 80);
            for (let ring = 0; ring < 3; ring++) {
                g.lineStyle(1, 0xffaa00, 0.3 - ring * 0.08);
                g.strokeCircle(848, 300, 16 + ring * 14);
            }
            this.add.text(848, 340, '📡', { fontSize: '10px' }).setOrigin(0.5);

            // Storage lockers
            for (let lk = 0; lk < 5; lk++) {
                g.fillStyle(0x101010, 0.9);
                g.fillRect(656 + lk * 28, 360, 22, 48);
                g.lineStyle(1, 0x2a2a2a, 1);
                g.strokeRect(656 + lk * 28, 360, 22, 48);
                g.fillStyle(0x333333, 1);
                g.fillCircle(667 + lk * 28, 380, 2); // handle
            }

            // ═══════════════════════════════════════════
            //  TRADING VAULT FURNITURE
            // ═══════════════════════════════════════════

            // Vault door (left wall, decorative)
            g.fillStyle(0x1a1000, 0.9);
            g.fillRect(36, 656, 28, 224);
            g.lineStyle(2, 0xffaa00, 0.8);
            g.strokeRect(36, 656, 28, 224);
            g.lineStyle(3, 0xffaa00, 0.9);
            g.strokeCircle(50, 768, 20); // wheel
            g.lineStyle(2, 0xffaa00, 0.5);
            for (let spoke = 0; spoke < 8; spoke++) {
                const angle = (spoke / 8) * Math.PI * 2;
                g.beginPath();
                g.moveTo(50, 768);
                g.lineTo(50 + Math.cos(angle) * 18, 768 + Math.sin(angle) * 18);
                g.strokePath();
            }

            // Trading terminals (CryptoBro cluster)
            drawTerminal(96, 672, 56, 36);
            drawTerminal(160, 672, 56, 36);
            drawTerminal(224, 672, 56, 36);

            // Price ticker display
            g.fillStyle(0x0a0400, 0.9);
            g.fillRect(96, 720, 208, 24);
            g.lineStyle(1, 0xffaa00, 0.7);
            g.strokeRect(96, 720, 208, 24);
            this.add.text(200, 732, '▲ BTC  ▲ ETH  ▼ DOGE', { fontSize: '7px', color: '#ffaa00' }).setOrigin(0.5);

            // Wall safe
            g.fillStyle(0x1a1200, 0.9);
            g.fillRect(272, 752, 64, 80);
            g.lineStyle(2, 0xffaa00, 0.6);
            g.strokeRect(272, 752, 64, 80);
            g.lineStyle(2, 0xffaa00, 0.8);
            g.strokeCircle(304, 792, 16);
            for (let mk = 0; mk < 12; mk++) {
                const a = (mk / 12) * Math.PI * 2;
                g.fillStyle(0xffaa00, 0.6);
                g.fillRect(304 + Math.cos(a) * 14 - 1, 792 + Math.sin(a) * 14 - 1, 2, 2);
            }

            // ═══════════════════════════════════════════
            //  CORRIDOR DETAILS
            // ═══════════════════════════════════════════

            // Overhead lighting strips (corridors)
            g.lineStyle(1, 0xffaa00, 0.08);
            g.beginPath();
            g.moveTo(32, 208);  g.lineTo(gridSize - 32, 208);
            g.moveTo(32, 624);  g.lineTo(gridSize - 32, 624);
            g.moveTo(256, 32);  g.lineTo(256, gridSize - 32);
            g.moveTo(608, 32);  g.lineTo(608, gridSize - 32);
            g.strokePath();

            // Warning signs at zone transitions
            drawWarning(264, 300);
            drawWarning(264, 400);
            drawWarning(620, 300);
            drawWarning(620, 400);
            drawWarning(160, 632);
            drawWarning(350, 632);

            // ═══════════════════════════════════════════
            //  SUBTLE GRID (Pip-Boy green, very faint)
            // ═══════════════════════════════════════════
            g.lineStyle(1, 0x004420, 0.08);
            g.beginPath();
            for (let i = 0; i <= gridSize; i += 16) {
                g.moveTo(i, 0).lineTo(i, gridSize);
                g.moveTo(0, i).lineTo(gridSize, i);
            }
            g.strokePath();

            this.cameras.main.setBackgroundColor('#080810');
            this.cameras.main.setZoom(1.5);
            this.cameras.main.centerOn(512, 512);

            if (this.input.keyboard) {
                this.cursors = this.input.keyboard.createCursorKeys();
            }

            // Mouse wheel zoom (0.5x to 4x)
            this.input.on('wheel', (_pointer: any, _gameObjects: any, _dx: number, dy: number) => {
                const cam = this.cameras.main;
                const newZoom = Phaser.Math.Clamp(cam.zoom - dy * 0.001, 0.5, 4);
                cam.setZoom(newZoom);
            });

            // Listen for Home button from React UI
            eventBus.addEventListener('camera-home', () => {
                this.followTarget = null;
                const cam = this.cameras.main;
                cam.setZoom(1.5);
                cam.centerOn(512, 512);
            });

            this.connectToServer();
        } catch (e) {
            console.error("CRITICAL PHASER ERROR", e);
        }
    }

    async connectToServer() {
        try {
            console.log("Connecting to Colyseus...");
            const client = new Colyseus.Client('ws://localhost:3000');
            this.room = await client.joinOrCreate('office');

            console.log("Room joined successfully!", this.room.sessionId);
            this.statusText.setText('Colyseus Sync: Connected (Waiting for state...)').setColor('#aaffaa');

            // Wait for the first actual state payload from the server before reading
            this.room.onStateChange.once((state: any) => {
                activeRoom = this.room as Colyseus.Room<OfficeState>;
                console.log("First state payload arrived!", state.toJSON());
                console.log("Agents map size:", state.agents?.size);
                this.statusText.setText('Colyseus Sync: Active!').setColor('#00ff00');

                // DEBUG: catch ALL messages to verify broadcast delivery
                this.room!.onMessage('*', (type: any, message: any) => {
                    console.log(`[MSG type=${type}]`, JSON.stringify(message).slice(0, 80));
                });

                // Bind chat bus
                this.room!.onMessage('chat', (message: any) => {
                    eventBus.dispatchEvent(new CustomEvent('chat-message', { detail: message }));
                });

                // Agent state changes via broadcast messages (bypasses broken schema v2 patch sync)
                this.room!.onMessage('agent-state', (data: { agentId: string; name: string; action: string; thought?: string }) => {
                    console.log(`[agent-state] ${data.name}: action="${data.action}" thought="${data.thought?.slice(0,30) || ''}"`);
                    const container = this.agentSprites.get(data.agentId);
                    const meta = this.agentMeta.get(data.agentId);
                    if (!container || !meta) return;

                    const { sprite, thoughtBubble, emoteBubble, lastAction } = meta;
                    const action = data.action;

                    // --- STATE TRANSITION ANIMATIONS ---
                    const isPickup = action === 'working' && lastAction !== 'working';
                    const isDone   = action === 'idle'    && lastAction === 'working';

                    if (isPickup) {
                        this.idleTweens.get(data.agentId)?.pause();
                        this.tweens.add({
                            targets: container,
                            scaleX: 1.3, scaleY: 1.3,
                            duration: 120,
                            yoyo: true,
                            ease: 'Quad.easeOut',
                            onComplete: () => {
                                const wt = this.tweens.add({
                                    targets: sprite,
                                    alpha: 0.65,
                                    duration: 900,
                                    yoyo: true,
                                    repeat: -1,
                                    ease: 'Sine.easeInOut',
                                });
                                this.workingTweens.set(data.agentId, wt);
                            }
                        });
                        emoteBubble.setText('❗');
                        emoteBubble.setVisible(true);
                        this.time.delayedCall(1500, () => emoteBubble.setVisible(false));

                    } else if (isDone) {
                        const wt = this.workingTweens.get(data.agentId);
                        if (wt) { wt.stop(); this.workingTweens.delete(data.agentId); }
                        if (sprite.type === 'Sprite') (sprite as Phaser.GameObjects.Sprite).setAlpha(1);
                        container.setScale(1);
                        thoughtBubble.setVisible(false);

                        if (sprite.type === 'Sprite') (sprite as Phaser.GameObjects.Sprite).setTint(0x00e676);
                        emoteBubble.setText('✅');
                        emoteBubble.setVisible(true);
                        this.time.delayedCall(2000, () => {
                            emoteBubble.setVisible(false);
                            if (sprite.type === 'Sprite') (sprite as Phaser.GameObjects.Sprite).clearTint();
                            const it = this.idleTweens.get(data.agentId);
                            if (it) { it.resume(); }
                        });

                    } else if (action !== lastAction) {
                        const emoteMap: Record<string, string> = {
                            'idle': '😌', 'talk': '💬', 'use_tool': '🔧',
                            'move': '🚶', 'think': '💡', 'error': '❌'
                        };
                        const emote = emoteMap[action] || '';
                        if (emote) {
                            emoteBubble.setText(emote);
                            emoteBubble.setVisible(true);
                            this.time.delayedCall(3000, () => emoteBubble.setVisible(false));
                        }
                    }

                    // Thought bubble — persistent while working
                    if (data.thought && data.thought !== '') {
                        thoughtBubble.setText(data.thought);
                        thoughtBubble.setVisible(true);
                        if (action !== 'working') {
                            this.time.delayedCall(6000, () => {
                                if (meta.lastAction !== 'working') thoughtBubble.setVisible(false);
                            });
                        }
                    }

                    // Update tracking + system log
                    if (action !== lastAction) {
                        meta.lastAction = action;
                        eventBus.dispatchEvent(new CustomEvent('activity-log', {
                            detail: { agent: data.name, action, thought: data.thought || '', time: new Date().toLocaleTimeString() }
                        }));
                    }
                });

                state.agents.onAdd((agent: AgentState, sessionId: string) => {
                    console.log(`[Colyseus] Agent added: ${agent.name} at (${agent.x}, ${agent.y})`);
                    const container = this.add.container(agent.x * 16, agent.y * 16);

                    let sprite;
                    // Deterministic sprite per agent: hash name to 0-5
                    let charIdx = 0;
                    for (let i = 0; i < agent.name.length; i++) charIdx = (charIdx + agent.name.charCodeAt(i)) % 6;
                    const charKey = `char_${charIdx}`;

                    if (this.textures.exists(charKey)) {
                        sprite = this.add.sprite(0, -8, charKey, 0);
                    } else {
                        sprite = this.add.rectangle(0, -8, 16, 32, 0x3a86ff);
                    }

                    // Thought bubble (word-wrapped)
                    const thoughtBubble = this.add.text(0, -36, '', {
                        fontSize: '9px',
                        color: '#e0e0e0',
                        backgroundColor: '#1a1a3eee',
                        padding: { x: 5, y: 4 },
                        align: 'center',
                        wordWrap: { width: 130, useAdvancedWrap: true }
                    }).setOrigin(0.5, 1);
                    thoughtBubble.setVisible(false);

                    // Emote bubble (emoji above head)
                    const emoteBubble = this.add.text(8, -24, '', {
                        fontSize: '12px'
                    }).setOrigin(0.5);
                    emoteBubble.setVisible(false);

                    // Name label
                    const label = this.add.text(0, 16, agent.name, {
                        fontSize: '10px', color: '#ffffff',
                        backgroundColor: '#00000088', padding: { x: 2, y: 1 }
                    }).setOrigin(0.5, 0);

                    // Focus highlight ring (hidden by default)
                    const focusRing = this.add.graphics();
                    focusRing.lineStyle(1, 0x6c5ce7, 0.8);
                    focusRing.strokeCircle(0, 0, 14);
                    focusRing.setVisible(false);

                    container.add([focusRing, sprite, thoughtBubble, emoteBubble, label]);
                    container.setSize(32, 48);
                    container.setInteractive();
                    this.agentSprites.set(sessionId, container);

                    // Idle bob: gentle y oscillation so agents don't look frozen
                    const idleTween = this.tweens.add({
                        targets: sprite,
                        y: '-=1',
                        duration: 600,
                        yoyo: true,
                        repeat: -1,
                        ease: 'Sine.easeInOut',
                    });
                    this.idleTweens.set(sessionId, idleTween);

                    // Store metadata for message-based animation handler
                    this.agentMeta.set(sessionId, { sprite, charKey, thoughtBubble, emoteBubble, lastAction: 'idle' });

                    // --- FOCUS MODE: Click to follow ---
                    container.on('pointerdown', () => {
                        if (this.followTarget === container) {
                            // Unfollow on second click
                            this.followTarget = null;
                            focusRing.setVisible(false);
                            eventBus.dispatchEvent(new CustomEvent('agent-focus', { detail: null }));
                        } else {
                            // Unfollow previous
                            if (this.followTarget) {
                                const prevRing = this.followTarget.getAt(0) as Phaser.GameObjects.Graphics;
                                prevRing?.setVisible(false);
                            }
                            this.followTarget = container;
                            focusRing.setVisible(true);
                            eventBus.dispatchEvent(new CustomEvent('agent-focus', { detail: { name: agent.name, agentId: sessionId } }));
                        }
                    });

                    let prevX = agent.x;
                    let prevY = agent.y;

                    // --- onChange: position + walk only ---
                    agent.onChange(() => {
                        // Position tween
                        this.tweens.add({
                            targets: container,
                            x: agent.x * 16,
                            y: agent.y * 16,
                            duration: 100,
                            onComplete: () => {
                                if (sprite.type === 'Sprite') {
                                    (sprite as Phaser.GameObjects.Sprite).stop();
                                }
                            }
                        });

                        // Walk animation
                        if (sprite.type === 'Sprite') {
                            const s = sprite as Phaser.GameObjects.Sprite;
                            if (agent.x > prevX) { s.play(`${charKey}-walk-right`, true); s.setFlipX(false); }
                            else if (agent.x < prevX) { s.play(`${charKey}-walk-right`, true); s.setFlipX(true); }
                            else if (agent.y > prevY) { s.play(`${charKey}-walk-down`, true); }
                            else if (agent.y < prevY) { s.play(`${charKey}-walk-up`, true); }
                            else { s.stop(); }
                        }

                        prevX = agent.x;
                        prevY = agent.y;
                    });

                    // Animation is driven by 'agent-state' messages (see onMessage below)
                    // — Colyseus schema v2 patch sync is broken across minor versions.
                });

                state.agents.onRemove((_agent: AgentState, sessionId: string) => {
                    const sprite = this.agentSprites.get(sessionId);
                    if (sprite) {
                        sprite.destroy();
                        this.agentSprites.delete(sessionId);
                    }
                    this.idleTweens.get(sessionId)?.destroy();
                    this.idleTweens.delete(sessionId);
                    this.workingTweens.get(sessionId)?.destroy();
                    this.workingTweens.delete(sessionId);
                });
            });

        } catch (e) {
            console.error(e);
            this.statusText.setText('Colyseus Sync: Failed (Check Server)').setColor('#ffaaaa');
        }
    }

    update() {
        // Escape key breaks follow mode
        if (this.input.keyboard && Phaser.Input.Keyboard.JustDown(this.input.keyboard.addKey('ESC'))) {
            this.followTarget = null;
        }

        // H key = Home: reset camera to center of vault, zoom to fit
        if (this.input.keyboard && Phaser.Input.Keyboard.JustDown(this.input.keyboard.addKey('H'))) {
            this.followTarget = null;
            const cam = this.cameras.main;
            cam.setZoom(1.5);
            cam.centerOn(512, 512); // Center of 64×64 grid * 16px tiles
        }

        // If following an agent, smoothly track them
        if (this.followTarget) {
            const cam = this.cameras.main;
            const targetX = this.followTarget.x - cam.width / (2 * cam.zoom);
            const targetY = this.followTarget.y - cam.height / (2 * cam.zoom);
            cam.scrollX += (targetX - cam.scrollX) * 0.08;
            cam.scrollY += (targetY - cam.scrollY) * 0.08;
        } else {
            const speed = 5;
            if (this.cursors?.left.isDown) this.cameras.main.scrollX -= speed;
            if (this.cursors?.right.isDown) this.cameras.main.scrollX += speed;
            if (this.cursors?.up.isDown) this.cameras.main.scrollY -= speed;
            if (this.cursors?.down.isDown) this.cameras.main.scrollY += speed;
        }
    }
}

export function setupPhaser(parentId: string) {
    const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        parent: parentId,
        width: window.innerWidth,
        height: window.innerHeight,
        scene: [OfficeScene],
        pixelArt: true,
        scale: {
            mode: Phaser.Scale.RESIZE,
        },
        input: {
            keyboard: {
                capture: [] // Don't capture ANY keys globally — let React inputs work
            }
        }
    };

    const game = new Phaser.Game(config);

    // When ANY input/textarea/select is focused, fully disable Phaser keyboard
    // When they blur, re-enable it
    document.addEventListener('focusin', (e) => {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
            game.input.keyboard?.enabled && (game.input.keyboard.enabled = false);
        }
    });
    document.addEventListener('focusout', (e) => {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
            game.input.keyboard && (game.input.keyboard.enabled = true);
        }
    });

    return game;
}
