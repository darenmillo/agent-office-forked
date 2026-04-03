import React, { useState, useRef, useCallback, useEffect } from 'react';
import { pip, glowText } from '../raijinTheme';

// ── Upkeep Logo: Short U / Mariner's Compass (approved favorite) ──────────
const DEFAULT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
<defs><clipPath id="rounded"><rect x="0" y="0" width="1024" height="1024" rx="128" ry="128"/></clipPath></defs>
<g clip-path="url(#rounded)">
<rect width="1024" height="1024" fill="#0d1117"/>
<g transform="translate(504, 512) scale(1.55)">
  <path d="M-110 -140 L-110 30 C-110 110 -56 140 0 140 C56 140 110 110 110 30 L110 -140" fill="none" stroke="#3ecfb4" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
  <polygon points="-5.5,-4.3 110,-140 5.5,4.3" fill="#e8a84c" opacity="0.9"/>
  <polygon points="4.9,-4.9 95,95 -4.9,4.9" fill="#e8a84c" opacity="0.9"/>
  <polygon points="0,-88 10,0 -10,0" fill="#e8a84c" opacity="0.9"/>
  <polygon points="0,88 10,0 -10,0" fill="#e8a84c" opacity="0.9"/>
  <polygon points="50,0 0,-8 0,8" fill="#e8a84c" opacity="0.3"/>
  <polygon points="-50,0 0,-8 0,8" fill="#e8a84c" opacity="0.3"/>
  <polygon points="-24,-32 -5,4 5,-4" fill="#e8a84c" opacity="0.25"/>
  <polygon points="-24,32 -5,-4 5,4" fill="#e8a84c" opacity="0.25"/>
  <circle cx="0" cy="0" r="21" fill="#0d1117" stroke="#e8a84c" stroke-width="3"/>
  <circle cx="0" cy="0" r="11" fill="#0d1117" stroke="#e8a84c" stroke-width="2"/>
  <circle cx="0" cy="0" r="4.5" fill="#e8a84c"/>
</g>
</g>
</svg>`;

type BgMode = 'dark' | 'light' | 'checker' | 'custom';

// ── Helpers ────────────────────────────────────────────────────────────────

function parseDims(svg: string): { width: number; height: number } {
    const vb = svg.match(/viewBox=["']\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*["']/);
    if (vb) return { width: +vb[3], height: +vb[4] };
    const w = svg.match(/width=["'](\d+)/);
    const h = svg.match(/height=["'](\d+)/);
    return { width: w ? +w[1] : 512, height: h ? +h[1] : 512 };
}

/** Replace root <svg> width/height with 100% so it fills its container */
function makeResponsive(svg: string): string {
    if (!/viewBox=/.test(svg)) return svg;
    return svg
        .replace(/(<svg\b[^>]*)\bwidth=["'][^"']*["']/, '$1width="100%"')
        .replace(/(<svg\b[^>]*)\bheight=["'][^"']*["']/, '$1height="100%"');
}

/** Save blob via File System Access API (path picker) with download fallback */
async function pickAndSave(blob: Blob, name: string, types: any[]): Promise<string | null> {
    if ('showSaveFilePicker' in window) {
        try {
            const handle = await (window as any).showSaveFilePicker({ suggestedName: name, types });
            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
            return handle.name;
        } catch (e: any) {
            if (e.name === 'AbortError') return null;
            // Cross-origin / security restriction — fall through to download
        }
    }
    // Fallback: browser download (goes to Downloads folder)
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return name;
}

/** Render SVG to canvas, export as PNG or JPEG blob */
function svgToRaster(
    svg: string, w: number, h: number,
    fmt: 'png' | 'jpeg', bgFill?: string, quality = 0.92,
): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        img.onload = () => {
            const c = document.createElement('canvas');
            c.width = w; c.height = h;
            const ctx = c.getContext('2d')!;
            if (fmt === 'jpeg' && bgFill) {
                ctx.fillStyle = bgFill;
                ctx.fillRect(0, 0, w, h);
            }
            ctx.drawImage(img, 0, 0, w, h);
            URL.revokeObjectURL(url);
            c.toBlob(b => b ? resolve(b) : reject(new Error('Export failed')), `image/${fmt}`, quality);
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Invalid SVG')); };
        img.src = url;
    });
}

const CHECKER: React.CSSProperties = {
    backgroundColor: '#fff',
    backgroundImage: [
        'linear-gradient(45deg, #ddd 25%, transparent 25%, transparent 75%, #ddd 75%)',
        'linear-gradient(45deg, #ddd 25%, transparent 25%, transparent 75%, #ddd 75%)',
    ].join(', '),
    backgroundSize: '16px 16px',
    backgroundPosition: '0 0, 8px 8px',
};

// ── Main Component ─────────────────────────────────────────────────────────

export function DesignPlayground() {
    const [code, setCode] = useState(DEFAULT_SVG);
    const [fileName, setFileName] = useState('upkeep-logo-short-u');
    const [bgMode, setBgMode] = useState<BgMode>('dark');
    const [customBg, setCustomBg] = useState('#0d1117');
    const [zoom, setZoom] = useState(50);
    const [exportW, setExportW] = useState(1024);
    const [exportH, setExportH] = useState(1024);
    const [jpgQ, setJpgQ] = useState(92);
    const [status, setStatus] = useState<{ text: string; ok: boolean } | null>(null);
    const [parseErr, setParseErr] = useState('');
    const [viewMode, setViewMode] = useState<'editor' | 'gallery'>('editor');

    // ── Playground file watcher ──
    const [pgFiles, setPgFiles] = useState<{ name: string; modified: number }[]>([]);
    const [watchingFile, setWatchingFile] = useState<string | null>(null);

    const fetchPgFiles = useCallback(async () => {
        try {
            const res = await fetch('/_playground/files');
            if (res.ok) setPgFiles(await res.json());
        } catch { /* plugin not loaded or dev server down */ }
    }, []);

    const loadPgFile = useCallback(async (name: string) => {
        try {
            const res = await fetch(`/_playground/file/${encodeURIComponent(name)}`);
            if (res.ok) {
                const content = await res.text();
                setCode(content);
                setFileName(name.replace(/\.[^.]+$/, ''));
                setWatchingFile(name);
                flash(`Loaded ${name}`);
            }
        } catch { flash('Failed to load file', false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const saveToPlayground = useCallback(async () => {
        try {
            const ext = code.includes('<svg') ? '.svg' : '.html';
            const name = fileName.includes('.') ? fileName : fileName + ext;
            const res = await fetch('/_playground/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, content: code }),
            });
            if (res.ok) {
                setWatchingFile(name);
                flash(`Saved to playground/${name}`);
                fetchPgFiles();
            } else { flash('Save failed', false); }
        } catch { flash('Save failed', false); }
    }, [code, fileName, fetchPgFiles]);

    // Fetch playground file list on mount
    useEffect(() => { fetchPgFiles(); }, [fetchPgFiles]);

    // HMR: auto-reload watched file when it changes on disk
    useEffect(() => {
        const hot = (import.meta as any).hot;
        if (!hot) return;
        const handler = (data: { file: string; event: string }) => {
            fetchPgFiles();
            if (data.file === watchingFile) loadPgFile(data.file);
        };
        hot.on('playground:update', handler);
        return () => { hot.off?.('playground:update', handler); };
    }, [watchingFile, fetchPgFiles, loadPgFile]);

    // Sync export dims with SVG viewBox
    useEffect(() => {
        try {
            const d = parseDims(code);
            setExportW(d.width); setExportH(d.height);
            setParseErr(code.trim() && !code.includes('<svg') ? 'No <svg> element found' : '');
        } catch { setParseErr('Parse error'); }
    }, [code]);

    // Auto-clear status flash
    useEffect(() => {
        if (!status) return;
        const t = setTimeout(() => setStatus(null), 3500);
        return () => clearTimeout(t);
    }, [status]);

    const flash = (text: string, ok = true) => setStatus({ text, ok });

    // ── Save / Export actions ──

    const saveSvg = useCallback(async () => {
        const blob = new Blob([code], { type: 'image/svg+xml' });
        const name = await pickAndSave(blob, `${fileName}.svg`, [
            { description: 'SVG Image', accept: { 'image/svg+xml': ['.svg'] } },
        ]);
        if (name) flash(`Saved ${name}`);
    }, [code, fileName]);

    const exportRaster = useCallback(async (fmt: 'png' | 'jpg') => {
        try {
            flash(`Exporting ${fmt.toUpperCase()}...`);
            const mime = fmt === 'jpg' ? 'jpeg' as const : 'png' as const;
            const bgFill = bgMode === 'dark' ? '#0d0d0d' : bgMode === 'light' ? '#f5f5f5'
                : bgMode === 'custom' ? customBg : '#ffffff';
            const blob = await svgToRaster(code, exportW, exportH, mime, bgFill, jpgQ / 100);
            const name = await pickAndSave(blob, `${fileName}.${fmt}`, [
                { description: fmt.toUpperCase(), accept: { [`image/${mime}`]: [`.${fmt}`] } },
            ]);
            if (name) flash(`Exported ${name} (${exportW}x${exportH})`);
        } catch (e: any) { flash(`Error: ${e.message}`, false); }
    }, [code, fileName, exportW, exportH, jpgQ, bgMode, customBg]);

    // Stable refs for keyboard handler (avoids re-subscribing on every keystroke)
    const saveSvgRef = useRef(saveSvg);    saveSvgRef.current = saveSvg;
    const exportRef = useRef(exportRaster); exportRef.current = exportRaster;

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                if (e.shiftKey) exportRef.current('png');
                else saveSvgRef.current();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    // Tab key inserts 2 spaces
    const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            const ta = e.currentTarget;
            const s = ta.selectionStart, end = ta.selectionEnd;
            const v = ta.value;
            setCode(v.substring(0, s) + '  ' + v.substring(end));
            requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = s + 2; });
        }
    }, []);

    // ── Derived values ──
    const dims = parseDims(code);
    const previewW = dims.width * (zoom / 100);
    const previewH = dims.height * (zoom / 100);
    const responsiveSvg = makeResponsive(code);
    const lines = code.split('\n').length;

    const bgStyle = (): React.CSSProperties => {
        switch (bgMode) {
            case 'dark':    return { backgroundColor: '#0d0d0d' };
            case 'light':   return { backgroundColor: '#f5f5f5' };
            case 'checker': return CHECKER;
            case 'custom':  return { backgroundColor: customBg };
        }
    };

    return (
        <div style={{
            position: 'absolute', top: 0, left: 48, right: 0, bottom: 0,
            display: 'flex', flexDirection: 'column',
            background: pip.bgDeep, fontFamily: pip.font, pointerEvents: 'auto',
        }}>
            {/* ── Top Bar ── */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '8px 16px', flexShrink: 0,
                borderBottom: `2px solid ${pip.amberFaint}`,
                background: pip.bgPanel,
            }}>
                <span style={{
                    color: pip.amber, fontSize: pip.textMd, fontWeight: 700,
                    letterSpacing: 2, textShadow: glowText(pip.amber),
                }}>DESIGN PLAYGROUND</span>

                <Sep />

                <Chip label="EDITOR" active={viewMode === 'editor'} onClick={() => setViewMode('editor')} />
                <Chip label="GALLERY" active={viewMode === 'gallery'} onClick={() => setViewMode('gallery')} />

                <Sep />

                <Lbl>FILE</Lbl>
                <input value={fileName} onChange={e => setFileName(e.target.value)} style={{
                    background: pip.bgInset, border: `1px solid ${pip.amberFaint}`,
                    color: pip.amber, fontFamily: pip.font, fontSize: pip.textSm,
                    padding: '3px 8px', width: 200, outline: 'none',
                }} />

                <div style={{ flex: 1 }} />

                <ActionBtn label="SAVE SVG" color={pip.green} onClick={saveSvg} hint="Ctrl+S" />
                <ActionBtn label="EXPORT PNG" color={pip.blue} onClick={() => exportRaster('png')} hint="Ctrl+Shift+S" />
                <ActionBtn label="EXPORT JPG" color="#DDA0DD" onClick={() => exportRaster('jpg')} />
                <Sep />
                <ActionBtn label="SAVE TO PLAYGROUND" color={pip.catTimer} onClick={saveToPlayground} />

                {status && (
                    <span style={{
                        color: status.ok ? pip.green : pip.red,
                        fontSize: pip.textSm, marginLeft: 4,
                        textShadow: status.ok ? glowText(pip.green, 3) : undefined,
                    }}>
                        {status.text}
                    </span>
                )}
            </div>

            {/* ── Playground File Bar ── */}
            {pgFiles.length > 0 && (
                <div style={{
                    padding: '3px 16px', flexShrink: 0,
                    background: pip.bgInset,
                    borderBottom: `1px solid ${pip.amberGhost}`,
                    display: 'flex', alignItems: 'center', gap: 6,
                }}>
                    <Lbl>PLAYGROUND</Lbl>
                    {pgFiles.map(f => (
                        <Chip key={f.name} label={f.name}
                            active={watchingFile === f.name}
                            onClick={() => loadPgFile(f.name)} />
                    ))}
                    {watchingFile && (
                        <>
                            <Sep />
                            <span style={{ color: pip.green, fontSize: pip.textXs, letterSpacing: 1 }}>
                                WATCHING
                            </span>
                            <Chip label="DETACH" active={false} onClick={() => setWatchingFile(null)} />
                        </>
                    )}
                    <div style={{ flex: 1 }} />
                    <span style={{ color: pip.amberDim, fontSize: 9, opacity: 0.6 }}>
                        agent-office/packages/ui/playground/
                    </span>
                </div>
            )}

            {/* ── Main Content: Editor or Gallery ── */}
            {viewMode === 'editor' ? (
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

                {/* ── Code Editor (left) ── */}
                <div style={{
                    width: '40%', minWidth: 280, display: 'flex', flexDirection: 'column',
                    borderRight: `2px solid ${pip.amberFaint}`,
                }}>
                    <div style={{
                        padding: '5px 12px', background: pip.bgPanel,
                        borderBottom: `1px solid ${pip.amberGhost}`,
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                        <Lbl>SVG SOURCE</Lbl>
                        <span style={{ color: pip.amberDim, fontSize: pip.textXs }}>
                            {lines} lines &middot; {code.length} chars
                        </span>
                    </div>
                    <textarea
                        value={code}
                        onChange={e => setCode(e.target.value)}
                        onKeyDown={onKeyDown}
                        spellCheck={false}
                        style={{
                            flex: 1, resize: 'none',
                            background: pip.bgDeep, color: pip.amberBright,
                            fontFamily: "'Share Tech Mono', 'Courier New', monospace",
                            fontSize: 13, lineHeight: '1.6',
                            padding: 12, border: 'none', outline: 'none',
                            tabSize: 2,
                        }}
                    />
                    {parseErr && (
                        <div style={{
                            padding: '4px 12px', background: pip.redDim,
                            color: '#fff', fontSize: pip.textXs,
                        }}>
                            {parseErr}
                        </div>
                    )}
                </div>

                {/* ── Preview Panel (right) ── */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>

                    {/* Controls: BG + Zoom */}
                    <div style={{
                        padding: '5px 12px', background: pip.bgPanel,
                        borderBottom: `1px solid ${pip.amberGhost}`,
                        display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
                    }}>
                        <Lbl>BG</Lbl>
                        {(['dark', 'light', 'checker', 'custom'] as BgMode[]).map(m => (
                            <Chip key={m} label={m} active={bgMode === m} onClick={() => setBgMode(m)} />
                        ))}
                        {bgMode === 'custom' && (
                            <input type="color" value={customBg} onChange={e => setCustomBg(e.target.value)}
                                style={{ width: 22, height: 18, border: 'none', cursor: 'pointer', padding: 0 }} />
                        )}

                        <Sep />

                        <Lbl>ZOOM</Lbl>
                        {[25, 50, 75, 100, 200].map(z => (
                            <Chip key={z} label={`${z}%`} active={zoom === z} onClick={() => setZoom(z)} />
                        ))}
                        <input type="range" min={10} max={400} value={zoom}
                            onChange={e => setZoom(+e.target.value)}
                            style={{ width: 80, accentColor: pip.amber }} />
                        <span style={{ color: pip.amberDim, fontSize: pip.textXs, minWidth: 30 }}>{zoom}%</span>

                        <div style={{ flex: 1 }} />
                        <span style={{ color: pip.amberDim, fontSize: pip.textXs }}>
                            {dims.width}&times;{dims.height}
                        </span>
                    </div>

                    {/* Controls: Export size + JPG quality */}
                    <div style={{
                        padding: '4px 12px', background: pip.bgInset,
                        borderBottom: `1px solid ${pip.amberGhost}`,
                        display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                        <Lbl>EXPORT</Lbl>
                        <DimInput value={exportW} onChange={setExportW} />
                        <span style={{ color: pip.amberFaint, fontSize: pip.textXs }}>&times;</span>
                        <DimInput value={exportH} onChange={setExportH} />

                        {[
                            ['1x', dims.width, dims.height],
                            ['2x', dims.width * 2, dims.height * 2],
                            ['512', 512, 512],
                            ['256', 256, 256],
                            ['128', 128, 128],
                        ].map(([label, w, h]) => (
                            <Chip key={label as string} label={label as string}
                                active={exportW === w && exportH === h}
                                onClick={() => { setExportW(w as number); setExportH(h as number); }} />
                        ))}

                        <Sep />
                        <Lbl>JPG Q</Lbl>
                        <input type="range" min={10} max={100} value={jpgQ}
                            onChange={e => setJpgQ(+e.target.value)}
                            style={{ width: 60, accentColor: pip.amber }} />
                        <span style={{ color: pip.amberDim, fontSize: pip.textXs }}>{jpgQ}%</span>
                    </div>

                    {/* Preview Canvas */}
                    <div style={{
                        flex: 1, overflow: 'auto',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        ...bgStyle(),
                        transition: 'background-color 0.15s',
                    }}>
                        <div style={{ width: previewW, height: previewH, flexShrink: 0 }}>
                            <div
                                style={{ width: '100%', height: '100%' }}
                                dangerouslySetInnerHTML={{ __html: responsiveSvg }}
                            />
                        </div>
                    </div>
                </div>
            </div>
            ) : (
                <GalleryView
                    files={pgFiles}
                    bgMode={bgMode}
                    customBg={customBg}
                    onSelect={(name) => { loadPgFile(name); setViewMode('editor'); }}
                />
            )}
        </div>
    );
}

// ── Tiny sub-components ────────────────────────────────────────────────────

function Lbl({ children }: { children: React.ReactNode }) {
    return (
        <span style={{
            color: pip.amberDim, fontSize: pip.textXs,
            letterSpacing: 1, textTransform: 'uppercase',
        }}>
            {children}
        </span>
    );
}

function Sep() {
    return <div style={{ width: 1, height: 18, background: pip.amberFaint, margin: '0 2px', flexShrink: 0 }} />;
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
    return (
        <button onClick={onClick} style={{
            background: active ? pip.amberGhost : 'transparent',
            border: `1px solid ${active ? pip.amber : pip.amberFaint}`,
            color: active ? pip.amber : pip.amberDim,
            fontSize: 10, padding: '1px 7px', cursor: 'pointer',
            fontFamily: pip.font, textTransform: 'uppercase',
            transition: 'all 0.12s',
        }}>
            {label}
        </button>
    );
}

function DimInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
    return (
        <input value={value} onChange={e => onChange(+e.target.value || 0)} style={{
            width: 52, background: pip.bgDeep, border: `1px solid ${pip.amberFaint}`,
            color: pip.amber, fontFamily: pip.font, fontSize: 11,
            padding: '2px 6px', textAlign: 'center', outline: 'none',
        }} />
    );
}

// ── Gallery View ──────────────────────────────────────────────────────────

function GalleryView({ files, bgMode, customBg, onSelect }: {
    files: { name: string; modified: number }[];
    bgMode: BgMode; customBg: string;
    onSelect: (name: string) => void;
}) {
    const [contents, setContents] = useState<Map<string, string>>(new Map());

    useEffect(() => {
        let cancelled = false;
        const fetchAll = async () => {
            const map = new Map<string, string>();
            await Promise.all(files.map(async f => {
                try {
                    const res = await fetch(`/_playground/file/${encodeURIComponent(f.name)}`);
                    if (res.ok && !cancelled) map.set(f.name, await res.text());
                } catch { /* skip */ }
            }));
            if (!cancelled) setContents(map);
        };
        fetchAll();
        return () => { cancelled = true; };
    }, [files]);

    const cardBg = bgMode === 'dark' ? '#0d0d0d' : bgMode === 'light' ? '#f5f5f5'
        : bgMode === 'custom' ? customBg : undefined;

    if (files.length === 0) {
        return (
            <div style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: pip.amberDim, fontSize: pip.textBase,
            }}>
                No files in playground/ — save something or have another session write here
            </div>
        );
    }

    return (
        <div style={{
            flex: 1, overflow: 'auto', padding: 16,
            background: pip.bgDeep,
        }}>
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: 16,
            }}>
                {files.map(f => {
                    const svg = contents.get(f.name);
                    if (!svg) return null;
                    return (
                        <GalleryCard key={f.name} name={f.name} svg={svg}
                            cardBg={cardBg} onClick={() => onSelect(f.name)} />
                    );
                })}
            </div>
        </div>
    );
}

function GalleryCard({ name, svg, cardBg, onClick }: {
    name: string; svg: string; cardBg?: string; onClick: () => void;
}) {
    const [hov, setHov] = useState(false);
    const responsive = makeResponsive(svg);
    return (
        <div
            onClick={onClick}
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            style={{
                background: pip.bgPanel,
                border: `2px solid ${hov ? pip.amber : pip.amberFaint}`,
                cursor: 'pointer',
                transition: 'border-color 0.15s',
            }}
        >
            <div style={{
                padding: 16,
                aspectRatio: '1',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: cardBg,
            }}>
                <div
                    style={{ width: '100%', height: '100%' }}
                    dangerouslySetInnerHTML={{ __html: responsive }}
                />
            </div>
            <div style={{
                padding: '6px 12px',
                borderTop: `1px solid ${pip.amberFaint}`,
                color: hov ? pip.amber : pip.amberDim,
                fontSize: pip.textXs,
                letterSpacing: 1,
                fontFamily: pip.font,
                transition: 'color 0.15s',
            }}>
                {name}
            </div>
        </div>
    );
}

function ActionBtn({ label, color, onClick, hint }: {
    label: string; color: string; onClick: () => void; hint?: string;
}) {
    const [hov, setHov] = useState(false);
    return (
        <button
            onClick={onClick} title={hint}
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            style={{
                background: hov ? `${color}18` : 'transparent',
                border: `1px solid ${hov ? color : color + '44'}`,
                color, fontSize: pip.textXs,
                padding: '3px 10px', cursor: 'pointer',
                fontFamily: pip.font, fontWeight: 700,
                letterSpacing: 1, transition: 'all 0.12s',
            }}
        >
            {label}
        </button>
    );
}
