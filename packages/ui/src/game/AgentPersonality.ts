/**
 * AgentPersonality.ts — Personality zone definitions + canned social chat lines.
 *
 * Every agent has a desk tile (matching AGENT_DESKS in ExternalOfficeRoom.ts),
 * a set of personality zones they gravitate toward when idle, and canned chat
 * lines used during idle socializing.
 *
 * All coordinates are in TILE space (multiply by 16 for pixel coords).
 */

export enum IdleState {
    WORKING          = 'WORKING',
    IDLE_AT_DESK     = 'IDLE_AT_DESK',
    IDLE_WANDERING   = 'IDLE_WANDERING',
    IDLE_SOCIALIZING = 'IDLE_SOCIALIZING',
    HANDOFF_LINGER   = 'HANDOFF_LINGER',
}

export interface TilePos {
    x: number;
    y: number;
}

export interface PersonalityZone {
    name: string;
    tile: TilePos;
}

export interface AgentPersonality {
    agentId: string;
    deskTile: TilePos;
    zones: PersonalityZone[];
    chatLines: string[];
}

export interface CommunalArea {
    name: string;
    tile: TilePos;
}

// Communal corridor areas any agent can wander to (30% weight)
export const COMMUNAL_AREAS: CommunalArea[] = [
    { name: 'corridor-north',   tile: { x: 30, y: 14 } },
    { name: 'corridor-south',   tile: { x: 30, y: 38 } },
    { name: 'corridor-west',    tile: { x: 16, y: 24 } },
    { name: 'corridor-east',    tile: { x: 39, y: 24 } },
    { name: 'command-entrance', tile: { x: 32, y: 14 } },
];

// ---------------------------------------------------------------------------
// Per-agent personality data — desk tiles match AGENT_DESKS in ExternalOfficeRoom.ts
// ---------------------------------------------------------------------------

const PERSONALITIES: Record<string, AgentPersonality> = {
    'agent-pm': {
        agentId: 'agent-pm',
        deskTile: { x: 22, y: 6 },
        zones: [
            { name: 'command-console',     tile: { x: 30, y: 7 } },
            { name: 'holographic-display', tile: { x: 33, y: 4 } },
            { name: 'command-overview',    tile: { x: 26, y: 10 } },
        ],
        chatLines: [
            "Let's sync on priorities.",
            "How's the pipeline looking?",
            "Need a status update on that.",
            "Good, keep it moving.",
        ],
    },
    'agent-command-center': {
        agentId: 'agent-command-center',
        deskTile: { x: 36, y: 5 },
        zones: [
            { name: 'holographic-display', tile: { x: 33, y: 4 } },
            { name: 'command-console',     tile: { x: 38, y: 7 } },
            { name: 'command-east',        tile: { x: 42, y: 6 } },
        ],
        chatLines: [
            "Checking the dashboard...",
            "Systems nominal.",
            "Any alerts I should know about?",
            "Adjusting parameters.",
        ],
    },
    'agent-claude': {
        agentId: 'agent-claude',
        deskTile: { x: 36, y: 11 },
        zones: [
            { name: 'command-console',     tile: { x: 30, y: 7 } },
            { name: 'command-south',       tile: { x: 36, y: 12 } },
            { name: 'holographic-display', tile: { x: 33, y: 4 } },
        ],
        chatLines: [
            "Thinking through this...",
            "Let me reason about that.",
            "Interesting approach.",
            "I have some thoughts on that.",
        ],
    },
    'agent-researcher': {
        agentId: 'agent-researcher',
        deskTile: { x: 5, y: 18 },
        zones: [
            { name: 'data-archive',      tile: { x: 5, y: 22 } },
            { name: 'research-terminal', tile: { x: 7, y: 17 } },
            { name: 'codebreaker',       tile: { x: 6, y: 28 } },
        ],
        chatLines: [
            "Found an interesting source.",
            "Cross-referencing the data...",
            "This contradicts earlier findings.",
            "Need more data points.",
        ],
    },
    'agent-analyst': {
        agentId: 'agent-analyst',
        deskTile: { x: 12, y: 18 },
        zones: [
            { name: 'research-terminal', tile: { x: 9, y: 17 } },
            { name: 'data-archive',      tile: { x: 5, y: 24 } },
            { name: 'intel-south',       tile: { x: 10, y: 28 } },
        ],
        chatLines: [
            "The numbers are interesting.",
            "Running the analysis now.",
            "Patterns emerging in the data.",
            "Need a bigger sample size.",
        ],
    },
    'agent-skeptic': {
        agentId: 'agent-skeptic',
        deskTile: { x: 5, y: 26 },
        zones: [
            { name: 'codebreaker-console', tile: { x: 8, y: 28 } },
            { name: 'data-archive',        tile: { x: 5, y: 22 } },
            { name: 'research-terminal',   tile: { x: 9, y: 17 } },
        ],
        chatLines: [
            "I have doubts about that.",
            "What's the evidence?",
            "Seems too good to be true.",
            "Let me challenge that assumption.",
        ],
    },
    'agent-dev': {
        agentId: 'agent-dev',
        deskTile: { x: 20, y: 22 },
        zones: [
            { name: 'server-rack', tile: { x: 19, y: 20 } },
            { name: 'workbench',   tile: { x: 25, y: 22 } },
            { name: 'eng-south',   tile: { x: 22, y: 30 } },
        ],
        chatLines: [
            "Refactoring this module.",
            "Tests are green.",
            "Deploying the fix now.",
            "Found a race condition.",
        ],
    },
    'agent-qa': {
        agentId: 'agent-qa',
        deskTile: { x: 28, y: 22 },
        zones: [
            { name: 'testing-terminal', tile: { x: 30, y: 22 } },
            { name: 'server-rack',      tile: { x: 19, y: 24 } },
            { name: 'engineering-door', tile: { x: 26, y: 17 } },
        ],
        chatLines: [
            "Running the test suite.",
            "Found a regression.",
            "Edge case caught!",
            "All tests passing.",
        ],
    },
    'agent-librarian': {
        agentId: 'agent-librarian',
        deskTile: { x: 20, y: 28 },
        zones: [
            { name: 'data-archive', tile: { x: 5, y: 22 } },
            { name: 'server-rack',  tile: { x: 19, y: 20 } },
            { name: 'workbench',    tile: { x: 25, y: 22 } },
        ],
        chatLines: [
            "Cataloguing this for later.",
            "Already documented that.",
            "Check the knowledge base.",
            "Filing this under references.",
        ],
    },
    'agent-writer': {
        agentId: 'agent-writer',
        deskTile: { x: 28, y: 28 },
        zones: [
            { name: 'broadcast-console', tile: { x: 44, y: 17 } },
            { name: 'workbench',         tile: { x: 28, y: 22 } },
            { name: 'storage-lockers',   tile: { x: 43, y: 24 } },
        ],
        chatLines: [
            "Drafting the summary now.",
            "Need a better opening line.",
            "Posting to Slack shortly.",
            "Trimming the fluff.",
        ],
    },
    'agent-collector': {
        agentId: 'agent-collector',
        deskTile: { x: 43, y: 18 },
        zones: [
            { name: 'broadcast-terminal', tile: { x: 48, y: 17 } },
            { name: 'radio-tower',        tile: { x: 53, y: 22 } },
            { name: 'storage-lockers',    tile: { x: 44, y: 24 } },
        ],
        chatLines: [
            "New data feed incoming.",
            "Scraping the latest batch.",
            "Source is rate-limited again.",
            "Got a fresh dataset.",
        ],
    },
    'agent-voice': {
        agentId: 'agent-voice',
        deskTile: { x: 50, y: 18 },
        zones: [
            { name: 'radio-tower',       tile: { x: 53, y: 22 } },
            { name: 'broadcast-console', tile: { x: 48, y: 17 } },
            { name: 'ops-south',         tile: { x: 50, y: 28 } },
        ],
        chatLines: [
            "Adjusting the tone.",
            "Ready to broadcast.",
            "Signal is strong.",
            "Clear comms.",
        ],
    },
    // NOTE: crypto-bro excluded intentionally — real money, no cosmetic changes
    'agent-habits': {
        agentId: 'agent-habits',
        deskTile: { x: 14, y: 44 },
        zones: [
            { name: 'trading-terminal', tile: { x: 10, y: 42 } },
            { name: 'ticker-display',   tile: { x: 12, y: 45 } },
            { name: 'vault-safe',       tile: { x: 18, y: 48 } },
        ],
        chatLines: [
            "Tracking the habit streak.",
            "Consistency is key.",
            "Logging today's progress.",
            "Good pattern forming.",
        ],
    },
};

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/**
 * Get personality data for an agent. Returns undefined for unknown agents
 * (they won't get idle wander behavior — e.g. crypto-bro).
 */
export function getPersonality(agentId: string): AgentPersonality | undefined {
    return PERSONALITIES[agentId];
}

/**
 * Pick a random wander target: 70% personality zone, 30% communal area.
 */
export function pickWanderTarget(personality: AgentPersonality): TilePos {
    if (Math.random() < 0.7 && personality.zones.length > 0) {
        const zone = personality.zones[Math.floor(Math.random() * personality.zones.length)];
        return zone.tile;
    }
    const area = COMMUNAL_AREAS[Math.floor(Math.random() * COMMUNAL_AREAS.length)];
    return area.tile;
}

/**
 * Pick a random canned chat line for idle socializing.
 */
export function pickChatLine(personality: AgentPersonality): string {
    return personality.chatLines[Math.floor(Math.random() * personality.chatLines.length)];
}
