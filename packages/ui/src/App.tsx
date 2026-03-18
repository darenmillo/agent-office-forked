import React, { useState } from 'react';
import { TaskBoard } from './components/TaskBoard';
import { ChatPanel } from './components/ChatPanel';
import { SystemLog } from './components/SystemLog';
import { AgentInspector } from './components/AgentInspector';
import { LogViewer } from './components/LogViewer';
import { eventBus } from './events';

export function App() {
    const [showLogs, setShowLogs] = useState(false);

    const handleHome = () => {
        eventBus.dispatchEvent(new CustomEvent('camera-home'));
    };

    return (
        <>
            {/* Log viewer — slides in from left */}
            <LogViewer visible={showLogs} onClose={() => setShowLogs(false)} />

            {/* Main panels — shift right when logs are open */}
            <div style={{ marginLeft: showLogs ? 420 : 0, transition: 'margin-left 0.2s' }}>
                <TaskBoard />
                <ChatPanel />
                <SystemLog />
                <AgentInspector />
            </div>

            {/* Top-right controls */}
            <div style={{
                position: 'absolute', top: 12, right: showLogs ? 12 : 310, zIndex: 25, pointerEvents: 'auto',
                display: 'flex', gap: 6,
            }}>
                <button
                    onClick={() => setShowLogs(!showLogs)}
                    title={showLogs ? 'Hide Logs' : 'Show Logs'}
                    style={{
                        background: showLogs ? 'rgba(108,92,231,0.6)' : 'rgba(10,10,30,0.88)',
                        border: '1px solid rgba(108,92,231,0.3)',
                        borderRadius: 8, padding: '5px 12px', color: '#dfe6e9', fontSize: 11,
                        cursor: 'pointer', fontWeight: 600,
                    }}
                >
                    📟 {showLogs ? 'Hide' : 'Show'} Logs
                </button>
            </div>

            {/* Bottom center navigation */}
            <div style={{
                position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
                display: 'flex', gap: 8, zIndex: 10, pointerEvents: 'auto',
            }}>
                <button onClick={handleHome} title="Reset camera (or press H)" style={{
                    background: 'rgba(10,10,30,0.88)', border: '1px solid rgba(108,92,231,0.3)',
                    borderRadius: 8, padding: '6px 14px', color: '#dfe6e9', fontSize: 12,
                    cursor: 'pointer', fontWeight: 600,
                }}>
                    🏠 Home
                </button>
            </div>
        </>
    );
}
