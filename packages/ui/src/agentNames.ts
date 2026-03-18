/** Maps agent_id → display name. Used across all panels. */
export const AGENT_NAMES: Record<string, string> = {
    'agent_pm': 'Path Palmer',
    'agent_dev': 'Dazzle Devlord',
    'agent_qa': 'Quinn',
    'agent_researcher': 'Rubick Reeves',
    'agent_analyst': 'Arcade Ashworth',
    'agent_skeptic': 'Sombra Steele',
    'agent_writer': 'Windranger Watts',
    'agent_collector': 'Caustic Crawford',
    'agent_librarian': 'Lina Ledger',
    'agent_habits': 'Horizon Hayes',
    'agent_voice': 'Victor Voss',
    'agent_cryptobro': 'CryptoBro',
};

export function agentName(id: string | null | undefined): string {
    if (!id) return 'Unknown';
    return AGENT_NAMES[id] || id.replace('agent_', '').replace(/_/g, ' ');
}

const API = 'http://localhost:5050';
export { API };
