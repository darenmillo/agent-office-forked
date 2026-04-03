import React, { useState, useEffect } from 'react';
import { TaskBoard } from './components/TaskBoard';
import { ChatPanel } from './components/ChatPanel';
import { SystemLog } from './components/SystemLog';
import { AgentInspector } from './components/AgentInspector';
import { LogViewer } from './components/LogViewer';
import { RaijinRecs } from './components/RaijinRecs';
import { DesignPlayground } from './components/DesignPlayground';
import { eventBus } from './events';
import { pip, glowText } from './raijinTheme';

type ViewId = 'office' | 'raijin' | 'playground';

export function App() {
    const [showLogs, setShowLogs] = useState(false);
    const [currentView, setCurrentView] = useState<ViewId>('office');

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
            {/* Left sidebar nav */}
            <div style={{
                position: 'absolute', left: 0, top: 0, bottom: 0, width: 48,
                background: pip.bgPanel,
                borderRight: `2px solid ${pip.amberFaint}`,
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                paddingTop: 12, gap: 4, zIndex: 30, pointerEvents: 'auto',
            }}>
                <NavButton icon="S" label="Office" active={currentView === 'office'} onClick={() => setCurrentView('office')} />
                <NavButton icon="R" label="Raijin" active={currentView === 'raijin'} onClick={() => setCurrentView('raijin')} />
                <NavButton icon="D" label="Design" active={currentView === 'playground'} onClick={() => setCurrentView('playground')} />
                <div style={{ flex: 1 }} />
                <NavButton icon="L" label="Logs" active={showLogs} onClick={() => setShowLogs(!showLogs)} />
                <div style={{ height: 8 }} />
            </div>

            <LogViewer visible={showLogs} onClose={() => setShowLogs(false)} />

            {currentView === 'office' && (
                <>
                    <div style={{ marginLeft: showLogs ? 420 : 48, transition: 'margin-left 0.2s' }}>
                        <TaskBoard />
                        <ChatPanel />
                        <SystemLog />
                        <AgentInspector />
                    </div>

                    <div style={{
                        position: 'absolute', top: 12, right: showLogs ? 12 : 310, zIndex: 25, pointerEvents: 'auto',
                        display: 'flex', gap: 6,
                    }}>
                        <button
                            onClick={() => setShowLogs(!showLogs)}
                            title={showLogs ? 'Hide Logs' : 'Show Logs'}
                            style={{
                                background: showLogs ? pip.amberGhost : 'rgba(13,13,8,0.88)',
                                border: `1px solid ${pip.amberFaint}`,
                                borderRadius: 0, padding: '5px 12px',
                                color: showLogs ? pip.amber : pip.amberDim,
                                fontSize: 11, cursor: 'pointer', fontWeight: 700,
                                fontFamily: pip.font, letterSpacing: 1,
                            }}
                        >
                            L {showLogs ? 'HIDE' : 'SHOW'} LOGS
                        </button>
                    </div>

                    <div style={{
                        position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
                        display: 'flex', gap: 8, zIndex: 10, pointerEvents: 'auto',
                    }}>
                        <button onClick={handleHome} title="Reset camera (or press H)" style={{
                            background: 'rgba(13,13,8,0.88)',
                            border: `1px solid ${pip.amberFaint}`,
                            borderRadius: 0, padding: '6px 14px',
                            color: pip.amber, fontSize: 12, cursor: 'pointer',
                            fontWeight: 700, fontFamily: pip.font, letterSpacing: 1,
                        }}>
                            HOME
                        </button>
                    </div>
                </>
            )}

            {currentView === 'raijin' && <RaijinRecs />}
            {currentView === 'playground' && <DesignPlayground />}
        </>
    );
}

function NavButton({ icon, label, active, onClick }: {
    icon: string; label: string; active: boolean; onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            title={label}
            style={{
                width: 36, height: 36, borderRadius: 0,
                background: active ? pip.amberGhost : 'transparent',
                border: active ? `2px solid ${pip.amber}` : '1px solid transparent',
                color: active ? pip.amber : pip.amberDim,
                fontSize: 14, fontWeight: 700,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
                fontFamily: pip.font,
                textShadow: active ? glowText(pip.amber) : undefined,
            }}
        >
            {icon}
        </button>
    );
}
