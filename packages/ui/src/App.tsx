import React, { useState, useEffect } from 'react';
import { TaskBoard } from './components/TaskBoard';
import { ChatPanel } from './components/ChatPanel';
import { SystemLog } from './components/SystemLog';
import { AgentInspector } from './components/AgentInspector';
import { LogViewer } from './components/LogViewer';
import { RaijinRecs } from './components/RaijinRecs';
import { eventBus } from './events';

type ViewId = 'office' | 'raijin';

export function App() {
    const [showLogs, setShowLogs] = useState(false);
    const [currentView, setCurrentView] = useState<ViewId>('office');

    // Hide/show Phaser canvas based on view
    useEffect(() => {
        const el = document.getElementById('phaser-container');
        if (el) {
            el.style.display = currentView === 'office' ? '' : 'none';
        }
    }, [currentView]);

    const handleHome = () => {
        eventBus.dispatchEvent(new CustomEvent('camera-home'));
    };

    return (
        <>
            {/* Left sidebar nav — persistent across views */}
            <div style={{
                position: 'absolute', left: 0, top: 0, bottom: 0, width: 48,
                background: 'rgba(10,10,30,0.95)',
                borderRight: '1px solid rgba(108,92,231,0.2)',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                paddingTop: 12, gap: 4, zIndex: 30, pointerEvents: 'auto',
            }}>
                <NavButton
                    icon="S"
                    label="Office"
                    active={currentView === 'office'}
                    onClick={() => setCurrentView('office')}
                    color="#6c5ce7"
                />
                <NavButton
                    icon="R"
                    label="Raijin"
                    active={currentView === 'raijin'}
                    onClick={() => setCurrentView('raijin')}
                    color="#4fc3f7"
                />
                <div style={{ flex: 1 }} />
                <NavButton
                    icon="L"
                    label="Logs"
                    active={showLogs}
                    onClick={() => setShowLogs(!showLogs)}
                    color="#6c5ce7"
                />
                <div style={{ height: 8 }} />
            </div>

            {/* Log viewer — slides in from left (after nav) */}
            <LogViewer visible={showLogs} onClose={() => setShowLogs(false)} />

            {/* Office view */}
            {currentView === 'office' && (
                <>
                    <div style={{ marginLeft: showLogs ? 420 : 48, transition: 'margin-left 0.2s' }}>
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
                            L {showLogs ? 'Hide' : 'Show'} Logs
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
                            Home
                        </button>
                    </div>
                </>
            )}

            {/* Raijin view */}
            {currentView === 'raijin' && <RaijinRecs />}
        </>
    );
}

function NavButton({ icon, label, active, onClick, color }: {
    icon: string; label: string; active: boolean;
    onClick: () => void; color: string;
}) {
    return (
        <button
            onClick={onClick}
            title={label}
            style={{
                width: 36, height: 36, borderRadius: 8,
                background: active ? `${color}33` : 'transparent',
                border: active ? `1px solid ${color}` : '1px solid transparent',
                color: active ? color : '#636e72',
                fontSize: 14, fontWeight: 700,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
            }}
        >
            {icon}
        </button>
    );
}
