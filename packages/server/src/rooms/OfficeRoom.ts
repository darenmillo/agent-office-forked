import { Room, Client } from 'colyseus';
import { OfficeState } from '../schema/OfficeState';
import { Agent, Office, OfficeConfig, ConversationMessage } from '@agent-office/core';
import { OllamaAdapter } from '@agent-office/adapters';
import { ToolExecutor } from '../tools/ToolExecutor';
import { MemoryStore } from '../memory/MemoryStore';

export class OfficeRoom extends Room<OfficeState> {
    maxClients = 100;
    private office!: Office;
    private demoTickCount = 0;
    private coreAgents: Map<string, Agent> = new Map();
    private thinkingLocks: Map<string, boolean> = new Map();
    private ollamaAdapter = new OllamaAdapter('http://localhost:11434');
    private hireCount = 0; // Counter for generating unique IDs
    private toolExecutor = new ToolExecutor();
    private memoryStore = new MemoryStore();
    private sessionId = `session_${Date.now()}`;

    // Furniture interaction points: named locations agents can walk to
    private furnitureTargets: Record<string, { x: number; y: number; type: string }> = {
        'alice-desk': { x: 5, y: 18, type: 'desk' },
        'bob-desk': { x: 5, y: 23, type: 'desk' },
        'meeting-table': { x: 10, y: 5, type: 'table' },
        'coffee-machine': { x: 25, y: 25, type: 'appliance' },
        'whiteboard': { x: 17, y: 3, type: 'board' },
        'water-cooler': { x: 28, y: 27, type: 'appliance' },
        'bookshelf': { x: 32, y: 12, type: 'furniture' },
        'beanbag': { x: 28, y: 6, type: 'seating' },
        // Extra desks for dynamically hired agents
        'hire_0-desk': { x: 15, y: 18, type: 'desk' },
        'hire_1-desk': { x: 15, y: 23, type: 'desk' },
        'hire_2-desk': { x: 25, y: 18, type: 'desk' },
        'hire_3-desk': { x: 25, y: 8, type: 'desk' },
        'hire_4-desk': { x: 32, y: 18, type: 'desk' },
    };

    async onCreate(options: any) {
        this.setState(new OfficeState());

        // Initialize memory store
        await this.memoryStore.initialize();

        const config: OfficeConfig = {
            name: options.name || 'Startup HQ',
            grid: { width: 64, height: 64, tileSize: 16 },
            rooms: [],
            furniture: [],
            spawnPoints: [{ x: 10, y: 10 }],
            zones: []
        };
        this.office = new Office(config);

        // Setup Core Agents with AI capabilities
        const setupCoreAgent = async (id: string, name: string, role: string, x: number, y: number) => {
            this.state.createAgent(id, name);
            const state = this.state.agents.get(id);
            if (state) { state.x = x; state.y = y; }

            const coreAgent = new Agent({
                id, name, role, avatar: 'sprite.png',
                inference: {
                    provider: 'ollama',
                    model: 'llama3.2:latest',
                    systemPrompt: `You are ${name}, a ${role} in a virtual office. Be social, do your work, and collaborate with colleagues. Keep thoughts SHORT.`,
                },
                personality: {
                    traits: { openness: 0.8, conscientiousness: 0.9, extraversion: 0.6, agreeableness: 0.7, neuroticism: 0.1 },
                    communicationStyle: role === 'Engineer' ? 'technical' : 'casual',
                    workHours: { start: '09:00', end: '17:00' },
                    breakFrequency: 120
                },
                capabilities: [
                    { name: 'code_execute', description: 'Execute JavaScript code' },
                    { name: 'web_search', description: 'Search the web for information' },
                    { name: 'write_note', description: 'Write a note or memo' },
                    { name: 'create_task', description: 'Create a task and assign it to yourself or another agent' },
                    { name: 'hire_agent', description: 'Hire a new team member (intern, developer, designer). Params: { name: string, role: string }' }
                ],
                memory: { shortTermLimit: 50 }
            });

            coreAgent.setInferenceAdapter(this.ollamaAdapter);
            await coreAgent.initialize();

            // Load persistent memories from previous sessions
            const previousMemories = await this.memoryStore.loadMemories(id, 20);
            if (previousMemories.length > 0) {
                coreAgent.loadMemories(previousMemories);
                console.log(`[${name}] Loaded ${previousMemories.length} memories from previous sessions`);
            }

            this.coreAgents.set(id, coreAgent);
            this.thinkingLocks.set(id, false);
        };

        await setupCoreAgent('alice', 'Alice', 'Engineer', 10, 10);
        await setupCoreAgent('bob', 'Bob', 'Product Manager', 20, 15);

        // ─── MESSAGE HANDLERS ───

        this.onMessage('command', (client, message) => {
            console.log(`Command from ${client.sessionId}:`, message);
        });

        this.onMessage('chat', (client, message) => {
            console.log(`Chat from ${client.sessionId}: ${message.text}`);
            this.broadcast('chat', { sender: 'User', text: message.text });
        });

        // UI-driven task assignment
        this.onMessage('assign-task', (client, message) => {
            const { title, agentId } = message;
            console.log(`[TaskBoard] Assigning "${title}" to ${agentId || 'auto'}`);

            // Pick agent: explicit or auto-assign to least busy
            const targetId = agentId || this.autoAssignAgent();
            const agent = this.coreAgents.get(targetId);
            const agentState = this.state.agents.get(targetId);

            if (agent && agentState) {
                agent.currentTask = title;
                agentState.currentTask = title;
                agentState.action = 'work';

                // Persist task
                this.memoryStore.createTask(title, targetId);

                this.broadcast('chat', {
                    sender: 'System',
                    text: `📋 Task "${title}" assigned to ${agentState.name}`
                });

                this.broadcast('task-update', {
                    agentId: targetId,
                    agentName: agentState.name,
                    task: title,
                    status: 'in_progress'
                });
            }
        });

        // Save office layout from editor
        this.onMessage('save-layout', async (client, message) => {
            await this.memoryStore.saveLayout(message.name || 'default', JSON.stringify(message.layout));
            this.broadcast('chat', { sender: 'System', text: '✅ Office layout saved!' });
        });

        // Start Simulation Loop
        this.setSimulationInterval((delta) => this.update(delta), 100);
    }

    private autoAssignAgent(): string {
        // Pick the agent with no current task, or the first one
        for (const [id, agent] of this.coreAgents) {
            if (!agent.currentTask) return id;
        }
        return 'alice'; // fallback
    }

    async update(delta: number) {
        if (Math.random() < 0.02) {
            console.log(`[Server] Agents: ${this.state.agents.size} | Session: ${this.sessionId}`);
        }

        this.state.officeTime = new Date().toISOString();

        // ─── AGENT THINK CYCLE ───
        this.coreAgents.forEach((coreAgent, id) => {
            if (!this.thinkingLocks.get(id)) {
                this.thinkingLocks.set(id, true);

                const agentState = this.state.agents.get(id);
                if (!agentState) return;

                // Build nearby agents list
                const nearbyAgents: { name: string; role: string; distance: number }[] = [];
                this.coreAgents.forEach((other, otherId) => {
                    if (otherId === id) return;
                    const otherState = this.state.agents.get(otherId);
                    if (otherState) {
                        const dist = Math.abs(agentState.x - otherState.x) + Math.abs(agentState.y - otherState.y);
                        nearbyAgents.push({ name: other.config.name, role: other.config.role, distance: dist });
                    }
                });

                coreAgent.think({
                    time: this.state.officeTime,
                    location: `${agentState.x},${agentState.y}`,
                    nearbyAgents,
                    currentTask: coreAgent.currentTask || null,
                    recentMessages: coreAgent.getUnreadMessages(),
                    memories: coreAgent.getRecentMemories(5)
                }).then(async (decision) => {
                    agentState.action = decision.action;

                    if (decision.thought) {
                        agentState.thought = decision.thought;
                    }

                    // ─── HANDLE TALK ACTION (Agent-to-Agent) ───
                    if (decision.action === 'talk' && decision.message) {
                        const targetName = decision.target || '';
                        let targetId = '';
                        this.coreAgents.forEach((a, aId) => {
                            if (a.config.name.toLowerCase() === targetName.toLowerCase()) targetId = aId;
                        });

                        const targetAgent = this.coreAgents.get(targetId);
                        if (targetAgent) {
                            const msg: ConversationMessage = {
                                from: coreAgent.config.name,
                                to: targetAgent.config.name,
                                content: decision.message,
                                timestamp: this.state.officeTime
                            };
                            targetAgent.receiveMessage(msg);

                            // Broadcast to UI chat
                            this.broadcast('chat', {
                                sender: coreAgent.config.name,
                                text: `💬 (to ${targetAgent.config.name}): ${decision.message}`
                            });

                            // Save conversation memory
                            await this.memoryStore.saveMemory(id, {
                                content: `Said to ${targetAgent.config.name}: "${decision.message}"`,
                                type: 'conversation',
                                timestamp: this.state.officeTime,
                                importance: 0.7
                            }, this.sessionId);
                        }

                        coreAgent.clearInbox(); // Clear after processing
                    }

                    // ─── HANDLE TOOL EXECUTION ───
                    if (decision.action === 'use_tool' && decision.toolCall) {
                        // Special case: agent-created tasks
                        if (decision.toolCall.name === 'create_task') {
                            const { title, assignee } = decision.toolCall.params;
                            const targetId = assignee?.toLowerCase() || this.autoAssignAgent();
                            const targetAgent = this.coreAgents.get(targetId);
                            const targetState = this.state.agents.get(targetId);

                            if (targetAgent && targetState) {
                                targetAgent.currentTask = title;
                                targetState.currentTask = title;
                                await this.memoryStore.createTask(title, targetId);

                                this.broadcast('chat', {
                                    sender: coreAgent.config.name,
                                    text: `📋 Created task "${title}" for ${targetAgent.config.name}`
                                });
                                this.broadcast('task-update', {
                                    agentId: targetId,
                                    agentName: targetAgent.config.name,
                                    task: title,
                                    status: 'in_progress'
                                });
                            }
                        } else if (decision.toolCall.name === 'hire_agent') {
                            // ─── DYNAMIC AGENT HIRING ───
                            const hireParams = decision.toolCall.params;
                            const hireName = hireParams.name || ['Charlie', 'Diana', 'Eve', 'Frank', 'Grace'][this.hireCount % 5];
                            const hireRole = hireParams.role || 'Intern';
                            const hireId = `hire_${this.hireCount}`;

                            if (this.hireCount < 5 && !this.coreAgents.has(hireId)) {
                                // Spawn at office door (top-center), then walk to their desk
                                const spawnX = 20;
                                const spawnY = 2;

                                this.state.createAgent(hireId, hireName);
                                const hireState = this.state.agents.get(hireId);
                                if (hireState) { hireState.x = spawnX; hireState.y = spawnY; }

                                const hireAgent = new Agent({
                                    id: hireId, name: hireName, role: hireRole, avatar: 'sprite.png',
                                    inference: {
                                        provider: 'ollama',
                                        model: 'llama3.2:latest',
                                        systemPrompt: `You are ${hireName}, a ${hireRole} who just joined the team at a virtual office. You were hired by ${coreAgent.config.name}. Be enthusiastic, helpful, and eager to learn. Introduce yourself to your colleagues. Keep thoughts SHORT.`,
                                    },
                                    personality: {
                                        traits: { openness: 0.9, conscientiousness: 0.7, extraversion: 0.8, agreeableness: 0.9, neuroticism: 0.2 },
                                        communicationStyle: hireRole.includes('Design') ? 'creative' : 'casual',
                                        workHours: { start: '09:00', end: '17:00' },
                                        breakFrequency: 90
                                    },
                                    capabilities: [
                                        { name: 'code_execute', description: 'Execute JavaScript code' },
                                        { name: 'web_search', description: 'Search the web' },
                                        { name: 'write_note', description: 'Write a note' },
                                        { name: 'create_task', description: 'Create a task for the team' }
                                    ],
                                    memory: { shortTermLimit: 50 }
                                });

                                hireAgent.setInferenceAdapter(this.ollamaAdapter);
                                await hireAgent.initialize();
                                this.coreAgents.set(hireId, hireAgent);
                                this.thinkingLocks.set(hireId, false);

                                this.hireCount++;

                                this.broadcast('chat', {
                                    sender: '🏢 Office',
                                    text: `🎉 ${coreAgent.config.name} hired ${hireName} as ${hireRole}! Welcome to the team!`
                                });

                                // Give the hiring agent a memory of the hire
                                coreAgent.addMemory({
                                    content: `I hired ${hireName} as a ${hireRole}. They just joined the team.`,
                                    type: 'achievement',
                                    timestamp: this.state.officeTime,
                                    importance: 0.9
                                });
                            } else if (this.hireCount >= 5) {
                                this.broadcast('chat', {
                                    sender: '🏢 Office',
                                    text: `⚠️ ${coreAgent.config.name} tried to hire but the office is full! (Max 7 agents)`
                                });
                            }
                        } else {
                            const result = await this.toolExecutor.execute(
                                decision.toolCall.name,
                                decision.toolCall.params
                            );

                            this.broadcast('chat', {
                                sender: coreAgent.config.name,
                                text: `🔧 Used tool [${decision.toolCall.name}]: ${result.success ? result.output.slice(0, 100) : result.error}`
                            });

                            coreAgent.addMemory({
                                content: `Tool ${decision.toolCall.name} result: ${result.output.slice(0, 200)}`,
                                type: 'task_result',
                                timestamp: this.state.officeTime,
                                importance: 0.8
                            });
                        }
                    }

                    // ─── PERSIST MEMORIES PERIODICALLY ───
                    if (Math.random() < 0.3) {
                        const recentMemories = coreAgent.memories.slice(-3);
                        await this.memoryStore.saveMemories(id, recentMemories, this.sessionId);
                    }

                    setTimeout(() => this.thinkingLocks.set(id, false), 15000);

                }).catch(err => {
                    console.error(`Agent ${id} think error:`, err);
                    setTimeout(() => this.thinkingLocks.set(id, false), 15000);
                });
            }
        });

        // ─── FURNITURE INTERACTION PATHFINDING ───
        // Office grid boundaries (agents must stay inside)
        const BOUNDS = { minX: 2, maxX: 62, minY: 2, maxY: 62 };
        const clamp = (agent: any) => {
            agent.x = Math.max(BOUNDS.minX, Math.min(BOUNDS.maxX, agent.x));
            agent.y = Math.max(BOUNDS.minY, Math.min(BOUNDS.maxY, agent.y));
        };

        this.demoTickCount++;
        if (this.demoTickCount >= 5) {
            this.demoTickCount = 0;
            this.state.agents.forEach((agent, key) => {
                // Default targets: agent's own desk chair
                const deskKey = `${key}-desk`;
                const target = this.furnitureTargets[deskKey] || { x: 5, y: 18 };

                // If agent action is 'talk', move towards the other agent instead
                if (agent.action === 'talk') {
                    let closest: { x: number; y: number } | null = null;
                    let minDist = Infinity;
                    this.state.agents.forEach((other, otherKey) => {
                        if (otherKey === key) return;
                        const dist = Math.abs(agent.x - other.x) + Math.abs(agent.y - other.y);
                        if (dist < minDist) { minDist = dist; closest = { x: other.x, y: other.y + 2 }; }
                    });
                    if (closest && minDist > 2) {
                        const c = closest as { x: number; y: number };
                        if (agent.x < c.x) agent.x += 1;
                        else if (agent.x > c.x) agent.x -= 1;
                        else if (agent.y < c.y) agent.y += 1;
                        else if (agent.y > c.y) agent.y -= 1;
                        clamp(agent);
                        return;
                    }
                }

                // Walk to desk/furniture target
                if (agent.x < target.x) agent.x += 1;
                else if (agent.x > target.x) agent.x -= 1;
                else if (agent.y < target.y) agent.y += 1;
                else if (agent.y > target.y) agent.y -= 1;
                clamp(agent);
            });
        }
    }

    onJoin(client: Client, options: any) {
        console.log(client.sessionId, "joined the office room!");
        // Send existing tasks to newly joined client
        this.memoryStore.getTasks().then(tasks => {
            client.send('tasks-sync', tasks);
        });
    }

    onLeave(client: Client, consented: boolean) {
        console.log(client.sessionId, "left the office room!");
    }

    async onDispose() {
        console.log("room", this.roomId, "disposing... saving memories");
        // Persist all agent memories on shutdown
        for (const [id, agent] of this.coreAgents) {
            await this.memoryStore.saveMemories(id, agent.memories, this.sessionId);
        }
        await this.memoryStore.close();
    }
}
