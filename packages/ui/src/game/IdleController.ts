/**
 * IdleController.ts — Client-side idle behavior state machine.
 *
 * Gives idle agents personality-driven wander behavior, canned social exchanges,
 * and coordinates with the existing working/handoff animations in Game.ts.
 *
 * All wander movement is COSMETIC — the server remains authoritative for agent
 * positions. When work arrives, agents snap back to their server desk position.
 *
 * State machine:
 *   WORKING -> IDLE_AT_DESK -> IDLE_WANDERING <-> IDLE_SOCIALIZING
 *                                ^  HANDOFF_LINGER  ^
 *
 * Key invariant: any action="working" from the server IMMEDIATELY overrides
 * all idle states. Server always wins.
 */

import Phaser from 'phaser';
import { ChatBubble } from './ChatBubble';
import {
    IdleState,
    TilePos,
    AgentPersonality,
    getPersonality,
    pickWanderTarget,
    pickChatLine,
} from './AgentPersonality';

// ---------------------------------------------------------------------------
// Timing constants (milliseconds)
// ---------------------------------------------------------------------------
const DESK_LINGER_MIN     = 3000;
const DESK_LINGER_MAX     = 5000;
const WANDER_INTERVAL_MIN = 8000;
const WANDER_INTERVAL_MAX = 15000;
const SOCIAL_DURATION_MIN = 3000;
const SOCIAL_DURATION_MAX = 5000;
const HANDOFF_LINGER_MIN  = 5000;
const HANDOFF_LINGER_MAX  = 8000;
const SOCIAL_STAGGER_MS   = 800;    // delay before second agent's chat line
const PROXIMITY_TILES     = 2;      // tile distance for socializing trigger
const PROXIMITY_CHECK_MS  = 500;    // throttle interval for proximity scan
const WALK_SPEED          = 64;     // pixels per second (~4 tiles/sec)
const TILE_SIZE           = 16;

// ---------------------------------------------------------------------------
// Internal state per agent
// ---------------------------------------------------------------------------
interface AgentIdleInfo {
    agentId: string;
    personality: AgentPersonality;
    state: IdleState;
    wanderTimer: Phaser.Time.TimerEvent | null;
    lingerTimer: Phaser.Time.TimerEvent | null;
    currentWanderTween: Phaser.Tweens.Tween | null;
    isWalking: boolean;
    lastActionTime: number;  // ms timestamp of last non-idle action (for bob-resume guard)
}

type MetaEntry = {
    sprite: any;
    charKey: string;
    thoughtBubble: any;
    emoteBubble: any;
    lastAction: string;
    chatBubble: ChatBubble;
};

function randBetween(min: number, max: number): number {
    return min + Math.random() * (max - min);
}

// ---------------------------------------------------------------------------
// IdleController
// ---------------------------------------------------------------------------
export class IdleController {
    private scene: Phaser.Scene;
    private agentSprites: Map<string, Phaser.GameObjects.Container>;
    private agentMeta: Map<string, MetaEntry>;
    private idleTweens: Map<string, Phaser.Tweens.Tween>;
    private walkingAgents: Set<string>;  // handoff walk guard from Game.ts
    private chatBubbles: Map<string, ChatBubble>;

    private agents: Map<string, AgentIdleInfo> = new Map();
    private lastProximityCheck = 0;

    constructor(
        scene: Phaser.Scene,
        agentSprites: Map<string, Phaser.GameObjects.Container>,
        agentMeta: Map<string, MetaEntry>,
        idleTweens: Map<string, Phaser.Tweens.Tween>,
        walkingAgents: Set<string>,
        chatBubbles: Map<string, ChatBubble>,
    ) {
        this.scene         = scene;
        this.agentSprites  = agentSprites;
        this.agentMeta     = agentMeta;
        this.idleTweens    = idleTweens;
        this.walkingAgents = walkingAgents;
        this.chatBubbles   = chatBubbles;
    }

    // =========================================================================
    // Public API — called from Game.ts
    // =========================================================================

    /**
     * Register an agent for idle behavior. Called from onAdd.
     * Agents without personality data (e.g. crypto-bro) are silently skipped.
     */
    registerAgent(agentId: string): void {
        const personality = getPersonality(agentId);
        if (!personality) return;

        this.agents.set(agentId, {
            agentId,
            personality,
            state: IdleState.IDLE_AT_DESK,
            wanderTimer: null,
            lingerTimer: null,
            currentWanderTween: null,
            isWalking: false,
            lastActionTime: 0,
        });

        this.scheduleDeskLinger(agentId);
    }

    /**
     * Unregister an agent. Called from onRemove. Cleans up all timers/tweens.
     */
    unregisterAgent(agentId: string): void {
        const info = this.agents.get(agentId);
        if (!info) return;
        this.clearTimers(info);
        this.cancelWanderTween(info);
        this.agents.delete(agentId);
    }

    /**
     * Handle a server state change. Called at the TOP of the agent-state handler
     * in Game.ts, before the existing pickup/done animations.
     */
    onServerStateChange(agentId: string, action: string): void {
        const info = this.agents.get(agentId);
        if (!info) return;

        if (action === 'working') {
            this.transitionToWorking(info);
        } else if (action === 'idle' && info.state === IdleState.WORKING) {
            this.transitionToIdleAtDesk(info);
        }
    }

    /**
     * Called at the START of a handoff animation. Cancels any active cosmetic
     * wander so the handoff tween doesn't fight an in-progress IdleController tween.
     */
    onHandoffStart(agentId: string): void {
        const info = this.agents.get(agentId);
        if (!info) return;
        this.clearTimers(info);
        this.cancelWanderTween(info);
        info.lastActionTime = Date.now();
    }

    /**
     * Called when a handoff animation completes (after the walk-back to desk).
     * Starts a linger period before returning to normal idle wander cycle.
     */
    onHandoffComplete(agentId: string): void {
        const info = this.agents.get(agentId);
        if (!info) return;
        if (info.state === IdleState.WORKING) return; // server overrides

        info.lastActionTime = Date.now();  // guard: prevent immediate bob resume
        info.state = IdleState.HANDOFF_LINGER;
        this.clearTimers(info);

        const duration = randBetween(HANDOFF_LINGER_MIN, HANDOFF_LINGER_MAX);
        info.lingerTimer = this.scene.time.delayedCall(duration, () => {
            if (info.state !== IdleState.HANDOFF_LINGER) return;
            this.transitionToIdleAtDesk(info);
        });
    }

    /**
     * Returns true if the agent is mid-cosmetic-walk (not handoff walk).
     */
    isIdleWalking(agentId: string): boolean {
        const info = this.agents.get(agentId);
        return info?.isWalking ?? false;
    }

    /**
     * Throttled proximity check — call every frame from update().
     * Scans idle-wandering agents for nearby pairs and triggers socializing.
     */
    tick(time: number): void {
        if (time - this.lastProximityCheck < PROXIMITY_CHECK_MS) return;
        this.lastProximityCheck = time;
        this.checkProximity();
    }

    /**
     * Clean up all agents on scene shutdown.
     */
    destroy(): void {
        for (const info of this.agents.values()) {
            this.clearTimers(info);
            this.cancelWanderTween(info);
        }
        this.agents.clear();
    }

    // =========================================================================
    // State transitions
    // =========================================================================

    private transitionToWorking(info: AgentIdleInfo): void {
        const prevState = info.state;
        info.state = IdleState.WORKING;
        info.lastActionTime = Date.now();
        this.clearTimers(info);

        // Cancel any cosmetic walk and return to desk if away
        if (info.isWalking || prevState === IdleState.IDLE_WANDERING ||
            prevState === IdleState.IDLE_SOCIALIZING) {
            this.cancelWanderTween(info);
            this.walkToDesk(info);
        }
    }

    private transitionToIdleAtDesk(info: AgentIdleInfo): void {
        info.state = IdleState.IDLE_AT_DESK;
        this.clearTimers(info);
        this.scheduleDeskLinger(info.agentId);
    }

    private transitionToWandering(info: AgentIdleInfo): void {
        if (info.state === IdleState.WORKING) return; // server overrides

        // Guard: sprite or scene may be destroyed if agent was removed mid-timer
        const container = this.agentSprites.get(info.agentId);
        const meta = this.agentMeta.get(info.agentId);
        if (!container || !meta || !meta.sprite || !this.scene || !this.scene.sys.isActive()) return;

        info.state = IdleState.IDLE_WANDERING;
        const target = pickWanderTarget(info.personality);
        this.wanderTo(info, target);
    }

    private transitionToSocializing(infoA: AgentIdleInfo, infoB: AgentIdleInfo): void {
        if (infoA.state === IdleState.WORKING || infoB.state === IdleState.WORKING) return;

        infoA.state = IdleState.IDLE_SOCIALIZING;
        infoB.state = IdleState.IDLE_SOCIALIZING;
        this.clearTimers(infoA);
        this.clearTimers(infoB);

        // Show canned chat on both agents (stagger the second line)
        const lineA = pickChatLine(infoA.personality);
        const lineB = pickChatLine(infoB.personality);

        const metaA = this.agentMeta.get(infoA.agentId);
        const metaB = this.agentMeta.get(infoB.agentId);
        metaA?.chatBubble.show(lineA, 3000);
        this.scene.time.delayedCall(SOCIAL_STAGGER_MS, () => {
            metaB?.chatBubble.show(lineB, 3000);
        });

        // After socializing, schedule next wander for both
        const duration = randBetween(SOCIAL_DURATION_MIN, SOCIAL_DURATION_MAX);
        infoA.lingerTimer = this.scene.time.delayedCall(duration, () => {
            if (infoA.state === IdleState.IDLE_SOCIALIZING) {
                this.scheduleNextWander(infoA.agentId);
            }
        });
        infoB.lingerTimer = this.scene.time.delayedCall(duration, () => {
            if (infoB.state === IdleState.IDLE_SOCIALIZING) {
                this.scheduleNextWander(infoB.agentId);
            }
        });
    }

    // =========================================================================
    // Scheduling
    // =========================================================================

    private scheduleDeskLinger(agentId: string): void {
        const info = this.agents.get(agentId);
        if (!info || info.state === IdleState.WORKING) return;

        const duration = randBetween(DESK_LINGER_MIN, DESK_LINGER_MAX);
        info.lingerTimer = this.scene.time.delayedCall(duration, () => {
            if (!this.agents.has(info.agentId)) return;
            if (info.state !== IdleState.IDLE_AT_DESK) return;
            this.transitionToWandering(info);
        });
    }

    private scheduleNextWander(agentId: string): void {
        const info = this.agents.get(agentId);
        if (!info || info.state === IdleState.WORKING) return;

        info.state = IdleState.IDLE_AT_DESK;
        const interval = randBetween(WANDER_INTERVAL_MIN, WANDER_INTERVAL_MAX);
        info.wanderTimer = this.scene.time.delayedCall(interval, () => {
            if (!this.agents.has(info.agentId)) return;
            if (info.state === IdleState.WORKING) return;
            this.transitionToWandering(info);
        });
    }

    // =========================================================================
    // Movement (cosmetic only — server positions unchanged)
    // =========================================================================

    private wanderTo(info: AgentIdleInfo, target: TilePos): void {
        const container = this.agentSprites.get(info.agentId);
        const meta = this.agentMeta.get(info.agentId);
        if (!container || !meta) return;

        const targetPxX = target.x * TILE_SIZE;
        const targetPxY = target.y * TILE_SIZE;
        const dist = Math.sqrt(
            (targetPxX - container.x) ** 2 + (targetPxY - container.y) ** 2,
        );
        const duration = Math.max(600, Math.min(5000, (dist / WALK_SPEED) * 1000));

        // Pause idle bob during walk
        this.idleTweens.get(info.agentId)?.pause();
        info.isWalking = true;

        // Play directional walk animation
        this.playWalkAnim(meta, container.x, container.y, targetPxX, targetPxY);

        info.currentWanderTween = this.scene.tweens.add({
            targets: container,
            x: targetPxX,
            y: targetPxY,
            duration,
            ease: 'Sine.easeInOut',
            onComplete: () => {
                info.isWalking = false;
                info.currentWanderTween = null;

                // Guard: sprite may be destroyed by the time tween completes
                try {
                    if (meta.sprite?.type === 'Sprite' && !meta.sprite.destroyed) {
                        (meta.sprite as Phaser.GameObjects.Sprite).stop();
                    }
                } catch {
                    // Sprite detached mid-transition
                }

                // Resume idle bob — only if no recent action (handoff/working guard)
                if (Date.now() - info.lastActionTime > 2000) {
                    this.idleTweens.get(info.agentId)?.resume();
                }

                // Schedule next wander (unless state changed mid-walk)
                if (info.state === IdleState.IDLE_WANDERING) {
                    this.scheduleNextWander(info.agentId);
                }
            },
        });
    }

    /**
     * Walk agent back to their desk (fast). Used when WORKING signal arrives
     * while agent is wandering. No state scheduling happens on completion —
     * the existing agent-state handler drives the working animation.
     */
    private walkToDesk(info: AgentIdleInfo): void {
        const container = this.agentSprites.get(info.agentId);
        const meta = this.agentMeta.get(info.agentId);
        if (!container || !meta) return;

        const deskPxX = info.personality.deskTile.x * TILE_SIZE;
        const deskPxY = info.personality.deskTile.y * TILE_SIZE;

        // Already at desk? Skip the walk.
        if (Math.abs(container.x - deskPxX) < 2 && Math.abs(container.y - deskPxY) < 2) {
            return;
        }

        const dist = Math.sqrt(
            (deskPxX - container.x) ** 2 + (deskPxY - container.y) ** 2,
        );
        // Faster walk-back than normal wander (cap at 2s)
        const duration = Math.max(300, Math.min(2000, (dist / WALK_SPEED) * 1000));

        info.isWalking = true;
        this.playWalkAnim(meta, container.x, container.y, deskPxX, deskPxY);

        info.currentWanderTween = this.scene.tweens.add({
            targets: container,
            x: deskPxX,
            y: deskPxY,
            duration,
            ease: 'Sine.easeInOut',
            onComplete: () => {
                info.isWalking = false;
                info.currentWanderTween = null;
                this.safeStopSprite(meta);
            },
        });
    }

    private playWalkAnim(
        meta: { sprite: any; charKey: string },
        fromX: number, fromY: number,
        toX: number, toY: number,
    ): void {
        if (meta.sprite.type !== 'Sprite') return;
        const s = meta.sprite as Phaser.GameObjects.Sprite;
        const dx = toX - fromX;
        const dy = toY - fromY;
        const animKey = Math.abs(dx) > Math.abs(dy)
            ? (dx > 0 ? `${meta.charKey}-walk-right` : `${meta.charKey}-walk-left`)
            : (dy > 0 ? `${meta.charKey}-walk-down` : `${meta.charKey}-walk-up`);
        if (!this.scene.anims.exists(animKey)) return;
        try {
            s.play(animKey, true);
            s.setFlipX(false);
        } catch {
            // Sprite animation component may be detached/destroyed mid-transition
        }
    }

    // =========================================================================
    // Proximity check — triggers socializing when two idle agents are close
    // =========================================================================

    private checkProximity(): void {
        const wanderers: AgentIdleInfo[] = [];
        for (const info of this.agents.values()) {
            // Only check agents that have arrived at their wander destination
            if (info.state === IdleState.IDLE_WANDERING && !info.isWalking) {
                wanderers.push(info);
            }
        }

        for (let i = 0; i < wanderers.length; i++) {
            for (let j = i + 1; j < wanderers.length; j++) {
                const a = wanderers[i];
                const b = wanderers[j];
                const containerA = this.agentSprites.get(a.agentId);
                const containerB = this.agentSprites.get(b.agentId);
                if (!containerA || !containerB) continue;

                const distPx = Math.sqrt(
                    (containerA.x - containerB.x) ** 2 +
                    (containerA.y - containerB.y) ** 2,
                );

                if (distPx / TILE_SIZE <= PROXIMITY_TILES) {
                    this.transitionToSocializing(a, b);
                    return; // only one pair per tick to avoid cascading
                }
            }
        }
    }

    // =========================================================================
    // Cleanup helpers
    // =========================================================================

    private clearTimers(info: AgentIdleInfo): void {
        if (info.wanderTimer) {
            info.wanderTimer.destroy();
            info.wanderTimer = null;
        }
        if (info.lingerTimer) {
            info.lingerTimer.destroy();
            info.lingerTimer = null;
        }
    }

    private cancelWanderTween(info: AgentIdleInfo): void {
        if (info.currentWanderTween) {
            info.currentWanderTween.stop();
            info.currentWanderTween = null;
        }
        info.isWalking = false;

        // Stop walk animation sprite
        const meta = this.agentMeta.get(info.agentId);
        this.safeStopSprite(meta);
    }

    private safeStopSprite(meta: MetaEntry | undefined): void {
        try {
            if (meta?.sprite?.type === 'Sprite' && !meta.sprite.destroyed) {
                (meta.sprite as Phaser.GameObjects.Sprite).stop();
            }
        } catch {
            // Sprite may be detached/destroyed mid-transition
        }
    }
}
