import express from 'express';
import cors from 'cors';
import { Server, matchMaker } from 'colyseus';
import { createServer } from 'http';
import { spawn, ChildProcess } from 'child_process';
import { ExternalOfficeRoom, getActiveRoom } from './rooms/ExternalOfficeRoom';

// Setup Express
const app = express();
app.use(express.json());
app.use(cors());

// Create HTTP and Colyseus server
const httpServer = createServer(app);
const colyseusServer = new Server({
    server: httpServer,
});

// Register our external-agent room (not the Ollama-driven one)
colyseusServer.define('office', ExternalOfficeRoom);

// ============================================================================
// REST API for external agents (Python) to push state updates
// ============================================================================

// Room reference — set directly by ExternalOfficeRoom.onCreate(),
// bypassing matchMaker.getRoomById() which doesn't trigger schema v2 change tracking.
function getRoom(): ExternalOfficeRoom | null {
    return getActiveRoom();
}

// Auto-create the room on startup (don't wait for first WebSocket client)
async function ensureRoom() {
    try {
        await matchMaker.createRoom('office', {});
        console.log('[Server] Office room created');
    } catch (e) {
        console.error('[Server] Failed to create office room:', e);
    }
}

// GET /api/agents — list all agents and their current state
app.get('/api/agents', async (req, res) => {
    const room = getRoom();
    if (!room) {
        res.json({ status: 'ok', agents: [] });
        return;
    }
    const agents: any[] = [];
    room.state.agents.forEach((agent, id) => {
        agents.push({
            id,
            name: agent.name,
            x: agent.x,
            y: agent.y,
            action: agent.action,
            currentTask: agent.currentTask,
            thought: agent.thought,
        });
    });
    res.json({ status: 'ok', agents });
});

// POST /api/heartbeat — update agent state (Miniverse-compatible)
// Body: { agent: "agent-pm", name: "PM", state: "working", task: "...", energy: 0.8 }
app.post('/api/heartbeat', async (req, res) => {
    const room = getRoom();
    if (!room) {
        res.status(503).json({ error: 'Office room not ready' });
        return;
    }
    const { agent, state, task } = req.body;
    if (!agent) {
        res.status(400).json({ error: 'agent is required' });
        return;
    }
    // Pass task as thought so agents show speech bubbles when working
    const thought = state === 'working' && task ? task : undefined;
    const ok = room.updateAgent(agent, state || 'idle', task, thought);
    res.json({ ok });
});

// POST /api/act — agent actions (Miniverse-compatible)
// Body: { agent: "agent-pm", action: { type: "speak", message: "Hello!" } }
// Body: { agent: "agent-pm", action: { type: "message", to: "agent-dev", message: "..." } }
app.post('/api/act', async (req, res) => {
    const room = getRoom();
    if (!room) {
        res.status(503).json({ error: 'Office room not ready' });
        return;
    }
    const { agent, action } = req.body;
    if (!agent || !action) {
        res.status(400).json({ error: 'agent and action are required' });
        return;
    }

    let ok = false;
    if (action.type === 'speak') {
        ok = room.agentSpeak(agent, action.message || '');
    } else if (action.type === 'message') {
        ok = room.agentMessage(agent, action.to || '', action.message || '');
    } else if (action.type === 'chat-bubble') {
        const duration = typeof action.duration === 'number' ? action.duration : 4.0;
        ok = room.agentShowSpeechBubble(agent, action.message || '', duration);
    } else if (action.type === 'handoff') {
        ok = room.agentHandoff(agent, action.to || '', action.label || '');
    }
    res.json({ ok });
});

// POST /api/chat-bubble — dedicated endpoint for showing speech bubbles
// Body: { agent: "agent-pm", message: "Hello!", duration: 4.0 }
app.post('/api/chat-bubble', async (req, res) => {
    const room = getRoom();
    if (!room) {
        res.status(503).json({ error: 'Office room not ready' });
        return;
    }
    const { agent, message, duration } = req.body;
    if (!agent || !message) {
        res.status(400).json({ error: 'agent and message are required' });
        return;
    }
    const durationSec = typeof duration === 'number' ? duration : 4.0;
    const ok = room.agentShowSpeechBubble(agent, message, durationSec);
    res.status(ok ? 200 : 404).json({ ok });
});

// GET /api/inbox — stub (our message bus handles this, not the viz layer)
app.get('/api/inbox', (req, res) => {
    res.json({ messages: [] });
});

// Health check
app.get('/api/offices', (req, res) => {
    res.json({ status: 'ok', offices: ['external'] });
});

// Debug: room state
app.get('/api/debug/room', (req, res) => {
    const room = getRoom();
    if (!room) {
        res.json({ error: 'no room', activeRoom: false });
        return;
    }
    res.json({
        roomId: room.roomId,
        clients: room.clients.length,
        agentCount: room.state.agents.size,
        autoDispose: room.autoDispose,
    });
});

// ============================================================================
// Raijin Recs Process Management
// ============================================================================

const RAIJIN_CWD = 'C:\\Users\\311da\\ai-agents';
let raijinProcess: ChildProcess | null = null;

function isRaijinRunning(): boolean {
    return raijinProcess !== null && raijinProcess.exitCode === null;
}

app.get('/api/raijin/status', async (req, res) => {
    // Check both process state AND whether :4000 is actually responding
    const processAlive = isRaijinRunning();
    let serverReady = false;
    if (processAlive) {
        try {
            const ctrl = new AbortController();
            const timeout = setTimeout(() => ctrl.abort(), 2000);
            const resp = await fetch('http://localhost:4000/health', { signal: ctrl.signal });
            clearTimeout(timeout);
            serverReady = resp.ok;
        } catch { /* not responding yet */ }
    }
    res.json({ running: processAlive, ready: serverReady, pid: raijinProcess?.pid ?? null });
});

app.post('/api/raijin/start', (req, res) => {
    if (isRaijinRunning()) {
        res.json({ ok: true, message: 'Already running', pid: raijinProcess!.pid });
        return;
    }
    console.log('[Raijin] Starting Raijin Recs server...');
    raijinProcess = spawn('uv', ['run', '--extra', 'raijin', 'python', '-m', 'raijin'], {
        cwd: RAIJIN_CWD,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true,
    });

    raijinProcess.stdout?.on('data', (data: Buffer) => {
        const line = data.toString().trim();
        if (line) console.log(`[Raijin] ${line}`);
    });
    raijinProcess.stderr?.on('data', (data: Buffer) => {
        const line = data.toString().trim();
        if (line) console.log(`[Raijin:err] ${line}`);
    });
    raijinProcess.on('exit', (code) => {
        console.log(`[Raijin] Process exited with code ${code}`);
        raijinProcess = null;
    });

    res.json({ ok: true, message: 'Starting', pid: raijinProcess.pid });
});

app.post('/api/raijin/stop', (req, res) => {
    if (!isRaijinRunning()) {
        res.json({ ok: true, message: 'Not running' });
        return;
    }
    console.log('[Raijin] Stopping Raijin Recs server...');
    raijinProcess!.kill();
    raijinProcess = null;
    res.json({ ok: true, message: 'Stopped' });
});

// ============================================================================
// Start server
// ============================================================================

const PORT = Number(process.env.PORT || 3000);
colyseusServer.listen(PORT).then(async () => {
    console.log(`[Server] AgentOffice Engine listening on ws://localhost:${PORT}`);
    console.log(`[Server] REST API at http://localhost:${PORT}/api/agents`);
    await ensureRoom();
});
