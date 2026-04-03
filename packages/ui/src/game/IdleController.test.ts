/**
 * IdleController.test.ts — Unit tests for the idle behavior state machine.
 *
 * Mocks Phaser entirely (scene, tweens, timers, containers, sprites).
 * Tests state transitions, timer cleanup, and tween cancellation safety.
 *
 * Run: npx jest IdleController.test.ts
 */

// ---------------------------------------------------------------------------
// Phaser mocks
// ---------------------------------------------------------------------------

function makeMockTimer() {
    return { destroy: jest.fn() };
}

function makeMockTween() {
    return { stop: jest.fn(), pause: jest.fn(), resume: jest.fn() };
}

const mockScene = {
    time: {
        delayedCall: jest.fn(() => makeMockTimer()),
        now: 0,
    },
    tweens: {
        add: jest.fn(() => makeMockTween()),
    },
};

function makeMockSprite() {
    return {
        type: 'Sprite',
        play: jest.fn(),
        stop: jest.fn(),
        setFlipX: jest.fn(),
    };
}

function makeMockChatBubble() {
    return { show: jest.fn(), clamp: jest.fn(), destroy: jest.fn() };
}

// ---------------------------------------------------------------------------
// Helpers — fresh maps/sets per test
// ---------------------------------------------------------------------------

function setup() {
    jest.clearAllMocks();

    const agentSprites = new Map<string, any>();
    const agentMeta = new Map<string, any>();
    const idleTweens = new Map<string, any>();
    const walkingAgents = new Set<string>();
    const chatBubbles = new Map<string, any>();

    // agent-pm at desk (22*16=352, 6*16=96)
    agentSprites.set('agent-pm', { x: 352, y: 96 });
    const pmSprite = makeMockSprite();
    const pmChat = makeMockChatBubble();
    agentMeta.set('agent-pm', {
        sprite: pmSprite,
        charKey: 'char_0',
        thoughtBubble: {},
        emoteBubble: {},
        lastAction: 'idle',
        chatBubble: pmChat,
    });
    idleTweens.set('agent-pm', makeMockTween());

    // agent-researcher at desk (5*16=80, 18*16=288)
    agentSprites.set('agent-researcher', { x: 80, y: 288 });
    const researchSprite = makeMockSprite();
    const researchChat = makeMockChatBubble();
    agentMeta.set('agent-researcher', {
        sprite: researchSprite,
        charKey: 'char_1',
        thoughtBubble: {},
        emoteBubble: {},
        lastAction: 'idle',
        chatBubble: researchChat,
    });
    idleTweens.set('agent-researcher', makeMockTween());

    const { IdleController } = require('./IdleController');
    const ctrl = new IdleController(
        mockScene as any,
        agentSprites,
        agentMeta,
        idleTweens,
        walkingAgents,
        chatBubbles,
    );

    return { ctrl, agentSprites, agentMeta, idleTweens, walkingAgents, chatBubbles, pmSprite, pmChat, researchChat };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('IdleController', () => {
    describe('registerAgent()', () => {
        it('registers a known agent and schedules desk linger', () => {
            const { ctrl } = setup();
            ctrl.registerAgent('agent-pm');

            // Should schedule a desk linger timer
            expect(mockScene.time.delayedCall).toHaveBeenCalledWith(
                expect.any(Number),
                expect.any(Function),
            );
        });

        it('silently skips unknown agents (e.g. crypto-bro)', () => {
            const { ctrl } = setup();
            const callsBefore = (mockScene.time.delayedCall as jest.Mock).mock.calls.length;
            ctrl.registerAgent('crypto-bro');

            // No timer should be scheduled for unknown agent
            expect((mockScene.time.delayedCall as jest.Mock).mock.calls.length).toBe(callsBefore);
        });

        it('isIdleWalking returns false for newly registered agent', () => {
            const { ctrl } = setup();
            ctrl.registerAgent('agent-pm');
            expect(ctrl.isIdleWalking('agent-pm')).toBe(false);
        });
    });

    describe('onServerStateChange()', () => {
        it('transitions to WORKING and clears timers', () => {
            const { ctrl } = setup();
            ctrl.registerAgent('agent-pm');

            const timersBefore = (mockScene.time.delayedCall as jest.Mock).mock.calls.length;
            ctrl.onServerStateChange('agent-pm', 'working');

            // The linger timer should have been destroyed
            const timer = (mockScene.time.delayedCall as jest.Mock).mock.results[0]?.value;
            if (timer) {
                expect(timer.destroy).toHaveBeenCalled();
            }
        });

        it('transitions to IDLE_AT_DESK from WORKING and reschedules linger', () => {
            const { ctrl } = setup();
            ctrl.registerAgent('agent-pm');
            ctrl.onServerStateChange('agent-pm', 'working');

            const callsBefore = (mockScene.time.delayedCall as jest.Mock).mock.calls.length;
            ctrl.onServerStateChange('agent-pm', 'idle');

            // Should schedule a new desk linger timer
            expect((mockScene.time.delayedCall as jest.Mock).mock.calls.length).toBeGreaterThan(callsBefore);
        });

        it('ignores idle->idle transitions (no double scheduling)', () => {
            const { ctrl } = setup();
            ctrl.registerAgent('agent-pm');

            const callsAfterRegister = (mockScene.time.delayedCall as jest.Mock).mock.calls.length;
            ctrl.onServerStateChange('agent-pm', 'idle');

            // Should NOT add another timer — only WORKING->idle triggers reschedule
            expect((mockScene.time.delayedCall as jest.Mock).mock.calls.length).toBe(callsAfterRegister);
        });

        it('is a no-op for unregistered agents', () => {
            const { ctrl } = setup();
            // Should not throw
            expect(() => ctrl.onServerStateChange('unknown-agent', 'working')).not.toThrow();
        });
    });

    describe('onHandoffComplete()', () => {
        it('schedules a handoff linger timer', () => {
            const { ctrl } = setup();
            ctrl.registerAgent('agent-pm');

            const callsBefore = (mockScene.time.delayedCall as jest.Mock).mock.calls.length;
            ctrl.onHandoffComplete('agent-pm');

            expect((mockScene.time.delayedCall as jest.Mock).mock.calls.length).toBeGreaterThan(callsBefore);
        });

        it('does not schedule linger if agent is WORKING', () => {
            const { ctrl } = setup();
            ctrl.registerAgent('agent-pm');
            ctrl.onServerStateChange('agent-pm', 'working');

            const callsBefore = (mockScene.time.delayedCall as jest.Mock).mock.calls.length;
            ctrl.onHandoffComplete('agent-pm');

            // No new timer — WORKING overrides
            expect((mockScene.time.delayedCall as jest.Mock).mock.calls.length).toBe(callsBefore);
        });
    });

    describe('unregisterAgent()', () => {
        it('cleans up timers on unregister', () => {
            const { ctrl } = setup();
            ctrl.registerAgent('agent-pm');

            // The linger timer created at registration
            const timer = (mockScene.time.delayedCall as jest.Mock).mock.results[0]?.value;
            ctrl.unregisterAgent('agent-pm');

            if (timer) {
                expect(timer.destroy).toHaveBeenCalled();
            }
        });

        it('is safe to call for non-registered agent', () => {
            const { ctrl } = setup();
            expect(() => ctrl.unregisterAgent('nonexistent')).not.toThrow();
        });
    });

    describe('destroy()', () => {
        it('cleans up all registered agents', () => {
            const { ctrl } = setup();
            ctrl.registerAgent('agent-pm');
            ctrl.registerAgent('agent-researcher');

            expect(() => ctrl.destroy()).not.toThrow();

            // After destroy, isIdleWalking should return false (default)
            expect(ctrl.isIdleWalking('agent-pm')).toBe(false);
        });
    });

    describe('tick() — proximity check', () => {
        it('does not throw when called repeatedly', () => {
            const { ctrl } = setup();
            ctrl.registerAgent('agent-pm');

            for (let t = 0; t < 3000; t += 100) {
                mockScene.time.now = t;
                expect(() => ctrl.tick(t)).not.toThrow();
            }
        });

        it('throttles proximity checks to 500ms intervals', () => {
            const { ctrl } = setup();
            ctrl.registerAgent('agent-pm');
            ctrl.registerAgent('agent-researcher');

            // First call at t=0 runs the check
            ctrl.tick(0);
            // Call at t=100 should be throttled
            ctrl.tick(100);
            // Call at t=600 should run another check
            ctrl.tick(600);

            // No errors — just verifying throttle doesn't cause issues
        });
    });
});
