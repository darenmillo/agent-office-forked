import { Schema, MapSchema, type } from '@colyseus/schema';

export class AgentState extends Schema {
    @type('string') id: string;
    @type('string') name: string;
    @type('number') x: number;
    @type('number') y: number;
    @type('string') direction: 'up' | 'down' | 'left' | 'right';
    @type('string') action: string;
    @type('string') currentTask: string;
    @type('string') thought: string;

    constructor(id: string, name: string) {
        super();
        this.id = id;
        this.name = name;
        this.x = 0;
        this.y = 0;
        this.direction = 'down';
        this.action = 'idle';
        this.currentTask = '';
        this.thought = '';
    }
}

/**
 * WalkState — tracks an active walk-to-handoff animation.
 *
 * Stored in OfficeState.walks keyed by the walking agent's ID.
 * The Phaser client uses broadcast messages (not schema patches) to
 * trigger the animation, but this schema preserves state for late-joining
 * clients and debugging.
 */
export class WalkState extends Schema {
    @type('string') agentId: string;
    @type('number') targetX: number;
    @type('number') targetY: number;
    @type('boolean') walking: boolean;

    constructor(agentId: string = '', targetX: number = 0, targetY: number = 0) {
        super();
        this.agentId = agentId;
        this.targetX = targetX;
        this.targetY = targetY;
        this.walking = false;
    }
}

export class OfficeState extends Schema {
    @type({ map: AgentState }) agents = new MapSchema<AgentState>();
    @type({ map: WalkState }) walks = new MapSchema<WalkState>();
    @type('string') officeTime: string = new Date().toISOString();
    @type('number') timeScale: number = 1;

    createAgent(id: string, name: string) {
        this.agents.set(id, new AgentState(id, name));
    }

    removeAgent(id: string) {
        this.agents.delete(id);
    }
}
