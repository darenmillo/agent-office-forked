/**
 * ExternalOfficeRoom — A Colyseus room for externally-controlled agents.
 *
 * Unlike OfficeRoom (which runs autonomous Ollama-driven agents), this room
 * accepts state updates via REST API from external Python agents. The Phaser
 * UI connects via WebSocket and sees the same state schema.
 *
 * REST endpoints are registered in index.ts and call methods on this room.
 */

import { Room, Client } from 'colyseus';
import { OfficeState } from '../schema/OfficeState';

// Direct room reference — set by onCreate, used by REST endpoints.
// matchMaker.getRoomById() doesn't reliably trigger schema v2 change tracking,
// so REST endpoints use this direct reference instead.
let _activeRoom: ExternalOfficeRoom | null = null;
export function getActiveRoom(): ExternalOfficeRoom | null {
    return _activeRoom;
}

// Agent desk positions — 5 named team zones for 64×64 Vault layout
const AGENT_DESKS: Record<string, { name: string; x: number; y: number }> = {
    // ⬡ OVERSEER'S DECK — Command (top center, tiles x:18-46, y:2-13)
    'agent-pm':         { name: 'Path Palmer',       x: 22, y: 6  },
    'command-center':   { name: 'Daren',             x: 36, y: 5  },
    'claude':           { name: 'Claude',            x: 36, y: 11 },
    // ⬡ INTELLIGENCE WING (left, tiles x:2-15, y:14-31)
    'agent-researcher': { name: 'Rubick Reeves',     x: 5,  y: 18 },
    'agent-analyst':    { name: 'Arcade Ashworth',   x: 12, y: 18 },
    'agent-skeptic':    { name: 'Sombra Steele',     x: 5,  y: 26 },
    // ⬡ ENGINEERING BAY (center, tiles x:17-37, y:17-33)
    'agent-dev':        { name: 'Dazzle Devlord',    x: 20, y: 22 },
    'agent-qa':         { name: 'Quinn',             x: 28, y: 22 },
    'agent-librarian':  { name: 'Lina Ledger',       x: 20, y: 30 },
    'agent-writer':     { name: 'Windranger Watts',  x: 28, y: 30 },
    // ⬡ BROADCAST / OPS WING (right, tiles x:40-56, y:14-31)
    'agent-collector':  { name: 'Caustic Crawford',  x: 43, y: 18 },
    'agent-voice':      { name: 'Victor Voss',       x: 50, y: 18 },
    // ⬡ TRADING VAULT (bottom-left, tiles x:2-22, y:40-56)
    'crypto-bro':       { name: 'CryptoBro',         x: 6,  y: 44 },
    'agent-habits':     { name: 'Horizon Hayes',     x: 14, y: 44 },
};

export class ExternalOfficeRoom extends Room<OfficeState> {
    maxClients = 100;

    async onCreate(options: any) {
        this.autoDispose = false; // Keep room alive even when all clients disconnect
        this.setState(new OfficeState());
        _activeRoom = this; // Register direct reference for REST endpoints

        // Create all agents at their desk positions
        for (const [agentId, config] of Object.entries(AGENT_DESKS)) {
            this.state.createAgent(agentId, config.name);
            const agent = this.state.agents.get(agentId);
            if (agent) {
                agent.x = config.x;
                agent.y = config.y;
                agent.action = 'idle';
            }
        }

        console.log(`[ExternalOffice] Created ${this.state.agents.size} agents`);

        // Handle chat messages from the UI
        this.onMessage('chat', (client, message) => {
            this.broadcast('chat', { sender: 'User', text: message.text });
        });

        // Tick the office clock + test broadcast every 10s
        let tickCount = 0;
        this.setSimulationInterval(() => {
            this.state.officeTime = new Date().toISOString();
            tickCount++;
            if (tickCount % 10 === 0) {
                this.broadcast('heartbeat-ping', { tick: tickCount, clients: this.clients.length });
                console.log(`[Room] broadcast heartbeat-ping tick=${tickCount} clients=${this.clients.length}`);
            }
        }, 1000);
    }

    // === Methods called by REST endpoints in index.ts ===

    updateAgent(agentId: string, state: string, task?: string, thought?: string) {
        let agent = this.state.agents.get(agentId);
        if (!agent) {
            // Auto-create unknown agents
            const name = agentId.replace('agent-', '').replace(/-/g, ' ');
            this.state.createAgent(agentId, name);
            agent = this.state.agents.get(agentId);
        }
        if (!agent) return false;

        agent.action = state;
        if (task !== undefined) agent.currentTask = task;
        if (thought !== undefined) agent.thought = thought;

        // Broadcast state change as explicit message — schema v2 patches
        // are unreliable across minor versions, so the client uses this instead.
        this.broadcast('agent-state', {
            agentId,
            name: agent.name,
            action: state,
            task: task || '',
            thought: thought || '',
        });
        return true;
    }

    agentSpeak(agentId: string, message: string) {
        const agent = this.state.agents.get(agentId);
        if (!agent) return false;

        agent.thought = message;
        this.broadcast('agent-state', {
            agentId,
            name: agent.name,
            action: agent.action,
            thought: message,
        });
        this.broadcast('chat', {
            sender: agent.name,
            text: `💬 ${message}`,
        });
        return true;
    }

    agentMessage(fromId: string, toId: string, message: string) {
        const from = this.state.agents.get(fromId);
        if (!from) return false;

        this.broadcast('chat', {
            sender: from.name,
            text: `(to ${toId}): ${message}`,
        });
        return true;
    }

    onJoin(client: Client) {
        console.log(`[ExternalOffice] Client joined: ${client.sessionId}`);
    }

    onLeave(client: Client) {
        console.log(`[ExternalOffice] Client left: ${client.sessionId}`);
    }

    onDispose() {
        _activeRoom = null;
        console.log('[ExternalOffice] Room disposed');
    }
}
