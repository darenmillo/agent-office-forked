/**
 * ChatBubble.ts — Speech bubble above agent sprites in the Vault.
 *
 * Renders a white rounded-rect bubble with a downward tail pointing at the
 * agent's head. Multiple messages queue and play sequentially — no message
 * is lost. Edge clamping is applied on each frame via clamp().
 *
 * Usage:
 *   const bubble = new ChatBubble(scene, agentContainer);
 *   bubble.show("Hello world!", 4000);  // 4-second auto-dismiss
 *
 *   // In scene update():
 *   bubble.clamp();
 */

import Phaser from 'phaser';

export interface ChatBubbleOptions {
    /** y offset above container origin (negative = up). Default -70 */
    yOffset?: number;
    /** max text wrap width in px. Default 160 */
    maxWidth?: number;
    /** text padding inside bubble in px. Default 8 */
    padding?: number;
    /** CSS font size string. Default '11px' */
    fontSize?: string;
}

interface QueueEntry {
    message: string;
    duration: number; // milliseconds
}

export class ChatBubble {
    private scene: Phaser.Scene;
    private parentContainer: Phaser.GameObjects.Container;

    // Current live bubble container (child of parentContainer)
    private bubbleContainer: Phaser.GameObjects.Container | null = null;
    private _bubbleWidth = 0; // cached pixel width for edge clamping

    private queue: QueueEntry[] = [];
    private isShowing = false;
    private dismissTimer: Phaser.Time.TimerEvent | null = null;
    private _destroyed = false;

    // Style options (resolved at construction)
    private readonly yOffset: number;
    private readonly maxWidth: number;
    private readonly padding: number;
    private readonly fontSize: string;

    private static readonly BG_COLOR     = 0xffffff;
    private static readonly BORDER_COLOR = 0x444444;
    private static readonly TEXT_COLOR   = '#222222';
    private static readonly TAIL_SIZE    = 6;
    private static readonly CORNER_R     = 6;

    constructor(
        scene: Phaser.Scene,
        parentContainer: Phaser.GameObjects.Container,
        options: ChatBubbleOptions = {}
    ) {
        this.scene           = scene;
        this.parentContainer = parentContainer;
        this.yOffset         = options.yOffset  ?? -70;
        this.maxWidth        = options.maxWidth  ?? 160;
        this.padding         = options.padding   ?? 8;
        this.fontSize        = options.fontSize  ?? '11px';
    }

    // =========================================================================
    // Public API
    // =========================================================================

    /**
     * Enqueue a message to display above the agent.
     * If a bubble is already visible the message waits and plays after the
     * current one auto-dismisses. Messages are never dropped.
     */
    show(message: string, duration = 4000): void {
        if (this._destroyed) return;
        this.queue.push({ message, duration });
        if (!this.isShowing) {
            this._showNext();
        }
    }

    /**
     * Clamp the bubble's local x-offset so it doesn't clip off screen edges.
     * Call this every frame from the scene's update() loop.
     */
    clamp(): void {
        if (this._destroyed) return;
        if (!this.bubbleContainer || this._bubbleWidth === 0) return;

        const cam  = this.scene.cameras.main;
        const zoom = cam.zoom;

        // World x of the parent container (agent sprite centre)
        const worldX = this.parentContainer.x;

        // Screen x of the bubble centre (with local offset = 0 as baseline)
        const screenXCentre = (worldX - cam.scrollX) * zoom;
        const halfW         = (this._bubbleWidth / 2) * zoom;
        const margin        = 8;

        let xOffset = 0;
        if (screenXCentre - halfW < margin) {
            // Too far left — push right
            xOffset = (margin - (screenXCentre - halfW)) / zoom;
        } else if (screenXCentre + halfW > cam.width - margin) {
            // Too far right — push left
            xOffset = ((cam.width - margin) - (screenXCentre + halfW)) / zoom;
        }

        this.bubbleContainer.setX(xOffset);
    }

    /**
     * Destroy bubble and cancel all pending work.
     * Call before destroying the parent container.
     */
    destroy(): void {
        this._destroyed = true;
        this._clearBubble();
        this.queue      = [];
        this.isShowing  = false;
    }

    // =========================================================================
    // Private helpers
    // =========================================================================

    private _showNext(): void {
        if (this.queue.length === 0) {
            this.isShowing = false;
            return;
        }

        this.isShowing = true;
        const { message, duration } = this.queue.shift()!;

        this._clearBubble();
        this._buildBubble(message);

        this.dismissTimer = this.scene.time.delayedCall(duration, () => {
            this._clearBubble();
            this._showNext();
        });
    }

    private _buildBubble(message: string): void {
        const PAD  = this.padding;
        const Y    = this.yOffset;          // top of tail tip (y = 0 is sprite centre)
        const TAIL = ChatBubble.TAIL_SIZE;
        const R    = ChatBubble.CORNER_R;

        // --- Measure text ---
        const textObj = this.scene.add.text(0, 0, message, {
            fontSize:  this.fontSize,
            color:     ChatBubble.TEXT_COLOR,
            wordWrap:  { width: this.maxWidth - PAD * 2, useAdvancedWrap: true },
            align:     'center',
        });
        textObj.setOrigin(0.5, 0.5);

        const tW  = textObj.width;
        const tH  = textObj.height;
        const bW  = tW + PAD * 2;   // bubble width
        const bH  = tH + PAD * 2;   // bubble height

        // Cache for edge clamping
        this._bubbleWidth = bW;

        // --- Draw bubble background & border ---
        const gfx = this.scene.add.graphics();

        // White rounded rect (sits above the tail tip)
        gfx.fillStyle(ChatBubble.BG_COLOR, 1.0);
        gfx.fillRoundedRect(-bW / 2, Y - bH - TAIL, bW, bH, R);

        // Border
        gfx.lineStyle(1, ChatBubble.BORDER_COLOR, 0.8);
        gfx.strokeRoundedRect(-bW / 2, Y - bH - TAIL, bW, bH, R);

        // --- Tail: downward triangle pointing to sprite head ---
        gfx.fillStyle(ChatBubble.BG_COLOR, 1.0);
        gfx.fillTriangle(
            -TAIL, Y - TAIL,  // bottom-left of tail base
             TAIL, Y - TAIL,  // bottom-right of tail base
                0, Y          // tip of tail
        );

        // Erase the border line at the bottom of the rect where the tail connects
        gfx.lineStyle(1, ChatBubble.BG_COLOR, 1.0);
        gfx.beginPath();
        gfx.moveTo(-TAIL + 1, Y - TAIL);
        gfx.lineTo( TAIL - 1, Y - TAIL);
        gfx.strokePath();

        // --- Position text vertically centred in the bubble rect ---
        textObj.setPosition(0, Y - TAIL - bH / 2);

        // --- Group into a local container (child of parentContainer) ---
        const group = this.scene.add.container(0, 0, [gfx, textObj]);
        // Children of a Container are rendered in list order (depth ignored),
        // but the group itself renders above existing children since we add last.
        this.parentContainer.add(group);
        this.bubbleContainer = group;

        // Initial clamp pass so bubble is positioned correctly from frame 1
        this.clamp();
    }

    private _clearBubble(): void {
        if (this.dismissTimer) {
            this.dismissTimer.destroy();
            this.dismissTimer = null;
        }
        if (this.bubbleContainer) {
            this.bubbleContainer.destroy(true); // destroys children + removes from parent
            this.bubbleContainer = null;
        }
        this._bubbleWidth = 0;
    }
}
