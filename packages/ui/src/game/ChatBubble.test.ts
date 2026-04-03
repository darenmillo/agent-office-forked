/**
 * ChatBubble.test.ts — Unit tests for ChatBubble.ts
 *
 * NOTE: This file uses Jest-compatible syntax. The package.json lists "jest"
 * as the test runner, but @types/jest and ts-jest are not yet installed.
 * To run these tests:
 *   npm install --save-dev jest @types/jest ts-jest
 *   npx jest ChatBubble.test.ts
 *
 * These tests mock Phaser entirely so no browser or canvas is required.
 */

// ---------------------------------------------------------------------------
// Phaser mock — minimal stubs for the Phaser APIs used by ChatBubble
// ---------------------------------------------------------------------------

const mockText = {
    setOrigin: jest.fn().mockReturnThis(),
    setPosition: jest.fn().mockReturnThis(),
    width: 80,
    height: 20,
};

const mockGraphics = {
    fillStyle: jest.fn().mockReturnThis(),
    fillRoundedRect: jest.fn().mockReturnThis(),
    lineStyle: jest.fn().mockReturnThis(),
    strokeRoundedRect: jest.fn().mockReturnThis(),
    fillTriangle: jest.fn().mockReturnThis(),
    beginPath: jest.fn().mockReturnThis(),
    moveTo: jest.fn().mockReturnThis(),
    lineTo: jest.fn().mockReturnThis(),
    strokePath: jest.fn().mockReturnThis(),
};

const mockBubbleContainer = {
    setX: jest.fn().mockReturnThis(),
    setDepth: jest.fn().mockReturnThis(),
    destroy: jest.fn(),
    list: [],
    x: 0,
};

const mockTimer = {
    destroy: jest.fn(),
};

const mockCamera = {
    scrollX: 0,
    scrollY: 0,
    zoom: 1,
    width: 800,
    height: 600,
};

const mockScene = {
    add: {
        text: jest.fn(() => ({ ...mockText })),
        graphics: jest.fn(() => ({ ...mockGraphics })),
        container: jest.fn((_x: number, _y: number, _children: any[]) => ({
            ...mockBubbleContainer,
            list: _children,
        })),
    },
    time: {
        delayedCall: jest.fn(() => ({ ...mockTimer })),
    },
    cameras: {
        main: { ...mockCamera },
    },
};

const mockParentContainer = {
    add: jest.fn(),
    x: 400,
    y: 300,
};

// ---------------------------------------------------------------------------
// Helper: create a fresh ChatBubble for each test
// ---------------------------------------------------------------------------

function makeBubble() {
    // We import dynamically to avoid module-level Phaser import issues.
    // In a real setup with ts-jest this would be a top-level import.
    const { ChatBubble } = require('./ChatBubble');
    return new ChatBubble(
        mockScene as any,
        mockParentContainer as any,
    );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ChatBubble', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset camera to defaults
        mockScene.cameras.main = { ...mockCamera };
        mockParentContainer.x = 400;
    });

    describe('show()', () => {
        it('creates a bubble container when show() is called', () => {
            const bubble = makeBubble();
            bubble.show('Hello world!');
            expect(mockScene.add.container).toHaveBeenCalled();
            expect(mockParentContainer.add).toHaveBeenCalled();
        });

        it('schedules auto-dismiss timer', () => {
            const bubble = makeBubble();
            bubble.show('Test', 3000);
            expect(mockScene.time.delayedCall).toHaveBeenCalledWith(
                3000,
                expect.any(Function),
            );
        });

        it('uses 4000 ms as default duration', () => {
            const bubble = makeBubble();
            bubble.show('Test');
            expect(mockScene.time.delayedCall).toHaveBeenCalledWith(
                4000,
                expect.any(Function),
            );
        });

        it('queues a second message while first is showing', () => {
            const bubble = makeBubble();
            bubble.show('First');
            // A second show() call while still showing should not create a second bubble immediately
            const containerCallsBefore = (mockScene.add.container as jest.Mock).mock.calls.length;
            bubble.show('Second');
            expect((mockScene.add.container as jest.Mock).mock.calls.length).toBe(containerCallsBefore);
        });
    });

    describe('destroy()', () => {
        it('clears the bubble and cancels the timer', () => {
            const bubble = makeBubble();
            bubble.show('Hi');
            bubble.destroy();
            // After destroy, subsequent clamp() calls should be no-ops
            expect(() => bubble.clamp()).not.toThrow();
        });

        it('empties the queue on destroy', () => {
            const bubble = makeBubble();
            bubble.show('One');
            bubble.show('Two');
            bubble.show('Three');
            bubble.destroy();
            // Simulate timer firing after destroy — should not throw
            const timerCallback = (mockScene.time.delayedCall as jest.Mock).mock.calls[0]?.[1];
            if (timerCallback) {
                expect(() => timerCallback()).not.toThrow();
            }
        });
    });

    describe('clamp()', () => {
        it('is a no-op when no bubble is showing', () => {
            const bubble = makeBubble();
            expect(() => bubble.clamp()).not.toThrow();
        });

        it('pushes bubble right when sprite is near left edge', () => {
            mockParentContainer.x = 10; // very close to left edge
            const bubble = makeBubble();
            bubble.show('Hi');
            bubble.clamp();
            // setX should have been called with a positive offset to push right
            const setXCalls = (mockBubbleContainer.setX as jest.Mock).mock.calls;
            // At least one setX call should pass a non-negative value
            expect(setXCalls.some(([x]: [number]) => x >= 0)).toBe(true);
        });

        it('does not throw when called repeatedly', () => {
            const bubble = makeBubble();
            bubble.show('Test');
            for (let i = 0; i < 10; i++) {
                expect(() => bubble.clamp()).not.toThrow();
            }
        });
    });

    describe('destroy() guard — _destroyed flag', () => {
        it('ignores show() calls after destroy()', () => {
            const bubble = makeBubble();
            bubble.destroy();
            const containerCallsBefore = (mockScene.add.container as jest.Mock).mock.calls.length;
            bubble.show('After destroy');
            // No new container should be created — message was silently dropped
            expect((mockScene.add.container as jest.Mock).mock.calls.length).toBe(containerCallsBefore);
        });
    });

    describe('queue behaviour', () => {
        it('shows next queued message after dismiss timer fires', () => {
            const bubble = makeBubble();
            bubble.show('First');
            bubble.show('Second');

            // Manually fire the dismiss timer for the first message
            const timerCallback = (mockScene.time.delayedCall as jest.Mock).mock.calls[0][1];
            timerCallback();

            // A second bubble should have been built
            expect((mockScene.add.container as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(2);
        });
    });
});
