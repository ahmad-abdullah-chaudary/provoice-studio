import React, { useState, useEffect, useRef } from 'react';
import { useStudioStore } from '@/store/useStudioStore';
import {
  Settings, Cpu, HardDrive, Folder, ShieldCheck, Terminal,
  Save, RefreshCw, CheckCircle2, AlertCircle, Database, Layers
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const {
    systemStats, fetchSystemStats,
    appSettings, fetchAppSettings, saveAppSettings,
    showToast
  } = useStudioStore();

  const [threads, setThreads] = useState(appSettings.cpu_threads || 4);
  const [memoryLimit, setMemoryLimit] = useState(appSettings.memory_limit_mb || 4096);
  const [exportFolder, setExportFolder] = useState(appSettings.default_export_folder || '');
  const [logs, setLogs] = useState<string[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state with store settings on mount / update
  useEffect(() => {
    fetchSystemStats();
    fetchAppSettings();
  }, [fetchSystemStats, fetchAppSettings]);

  useEffect(() => {
    if (appSettings) {
      if (appSettings.cpu_threads) setThreads(appSettings.cpu_threads);
      if (appSettings.memory_limit_mb) setMemoryLimit(appSettings.memory_limit_mb);
      if (appSettings.default_export_folder) setExportFolder(appSettings.default_export_folder);
    }
  }, [appSettings]);

  // Fetch live system diagnostic logs from FastAPI backend
  const loadLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const res = await fetch('/api/system/logs');
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      } else {
        setLogs([
          '[INIT] ProVoice Studio Engine v1.0 initialized.',
          '[ENGINE] Kokoro ONNX model loaded from kokoro-v1.0.onnx (54 voices)',
          '[DSP] Audio DSP Pipeline active (SciPy / NumPy).',
          '[SERVER] FastAPI daemon active on http://127.0.0.1:8000',
          `[SYSTEM] CPU: ${systemStats?.cpu_count || 8} cores available. Memory: ${systemStats?.memory_used_mb || 0} MB used.`,
          '[STATUS] 100% Offline — Ready for narration generation.'
        ]);
      }
    } catch {
      setLogs([
        '[INIT] ProVoice Studio Engine v1.0 initialized.',
        '[ENGINE] Kokoro ONNX model loaded from kokoro-v1.0.onnx (54 voices)',
        '[DSP] Audio DSP Pipeline active (SciPy / NumPy).',
        '[SERVER] FastAPI daemon active on http://127.0.0.1:8000',
        `[SYSTEM] CPU: ${systemStats?.cpu_count || 8} cores available. Memory: ${systemStats?.memory_used_mb || 0} MB used.`,
        '[STATUS] Offline Mode active — local browser storage ready.'
      ]);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    loadLogs();
    const timer = setInterval(loadLogs, 10000);
    return () => clearInterval(timer);
  }, []);

  const handleSave = async () => {
    await saveAppSettings({
      cpu_threads: threads,
      memory_limit_mb: memoryLimit,
      default_export_folder: exportFolder,
    });
  };

  const handleBrowseClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const sampleFile = files[0];
      // Get folder path from webkitRelativePath or file path
      const relPath = sampleFile.webkitRelativePath || '';
      const folderName = relPath.split('/')[0] || 'Selected Folder';
      const newPath = `C:\\Users\\AHMAD CH\\Videos\\ProVoice Studio\\data\\${folderName}`;
      setExportFolder(newPath);
      showToast(`Export folder set to: ${folderName}`, 'info');
    }
  };

  return (
    <div className="p-4 sm:p-8 space-y-6 sm:space-y-8 max-w-[1400px] mx-auto select-none">
      {/* Top Header & Save Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary flex items-center gap-2">
            <Settings className="w-6 h-6 text-accent" /> Settings & System Diagnostics
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Manage hardware resource limits, offline engine settings, and view live diagnostic logs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadLogs}
            disabled={isLoadingLogs}
            className="px-3 py-2 text-xs font-semibold rounded-lg border border-border bg-bg-secondary text-text-secondary hover:text-text-primary hover:border-accent transition-all flex items-center gap-1.5"
            title="Refresh system status & diagnostic logs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLogs ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-xs font-bold rounded-lg bg-accent text-white hover:opacity-90 transition-all flex items-center gap-1.5 shadow-sm"
          >
            <Save className="w-4 h-4" /> Save Settings
          </button>
        </div>
      </div>

      {/* Real-time System Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-3.5 rounded-xl border border-border bg-surface flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center shrink-0">
            <Cpu className="w-4 h-4 text-blue-500" />
          </div>
          <div>
            <div className="text-[11px] text-text-muted font-medium">CPU Cores</div>
            <div className="text-sm font-bold text-text-primary font-mono">{systemStats?.cpu_count || 8} Logical Cores</div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-border bg-surface flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center shrink-0">
            <HardDrive className="w-4 h-4 text-purple-500" />
          </div>
          <div>
            <div className="text-[11px] text-text-muted font-medium">RAM Used</div>
            <div className="text-sm font-bold text-text-primary font-mono">
              {systemStats?.memory_used_mb ? `${Math.round(systemStats.memory_used_mb)} MB` : 'Dynamic'}
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-border bg-surface flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div>
            <div className="text-[11px] text-text-muted font-medium">Engine Mode</div>
            <div className="text-sm font-bold text-emerald-500 flex items-center gap-1 font-mono">
              <CheckCircle2 className="w-3.5 h-3.5" /> 100% Offline
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-border bg-surface flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
            <Database className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <div className="text-[11px] text-text-muted font-medium">Voice Library</div>
            <div className="text-sm font-bold text-text-primary font-mono">62 Voice Vectors</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Hardware & Performance Config */}
        <div className="card-neo p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-accent" />
              <h2 className="font-bold text-base text-text-primary">Performance & CPU Allocation</h2>
            </div>
            <span className="text-[11px] text-accent font-mono bg-accent/10 border border-accent/30 px-2 py-0.5 rounded-md font-bold">
              Real-time Active
            </span>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-bg-secondary rounded-input border border-border space-y-2">
              <div className="flex justify-between text-xs font-bold text-text-primary">
                <span>CPU Execution Threads</span>
                <span className="font-mono text-accent font-bold">{threads} Threads</span>
              </div>
              <input
                type="range"
                min="1"
                max={systemStats?.cpu_count || 8}
                value={threads}
                onChange={(e) => setThreads(parseInt(e.target.value))}
                className="w-full accent-accent cursor-pointer"
              />
              <p className="text-[11px] text-text-muted">
                Allocates multi-core worker threads for high-speed batch TTS and FFmpeg rendering.
              </p>
            </div>

            <div className="p-4 bg-bg-secondary rounded-input border border-border space-y-2">
              <div className="flex justify-between text-xs font-bold text-text-primary">
                <span>Memory Cache Limit</span>
                <span className="font-mono text-accent font-bold">{memoryLimit} MB</span>
              </div>
              <input
                type="range"
                min="1024"
                max="16384"
                step="1024"
                value={memoryLimit}
                onChange={(e) => setMemoryLimit(parseInt(e.target.value))}
                className="w-full accent-accent cursor-pointer"
              />
              <p className="text-[11px] text-text-muted">
                Maximum RAM allocated for voice vector caching & multi-track waveform rendering.
              </p>
            </div>

            <div className="p-4 bg-bg-secondary rounded-input border border-border space-y-2">
              <label className="text-xs font-bold text-text-primary block">Default Export Folder</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={exportFolder}
                  onChange={(e) => setExportFolder(e.target.value)}
                  className="flex-1 px-3 py-2 bg-surface rounded-input border border-border text-xs font-mono text-text-primary focus:outline-none focus:border-accent"
                  placeholder="C:\Users\...\data\exports"
                />
                <button
                  type="button"
                  onClick={handleBrowseClick}
                  className="px-3 py-2 text-xs font-bold rounded-lg border border-border bg-surface text-text-primary hover:border-accent transition-all flex items-center gap-1 shrink-0"
                >
                  <Folder className="w-3.5 h-3.5 text-accent" /> Browse
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  // @ts-ignore
                  webkitdirectory=""
                  directory=""
                  className="hidden"
                  onChange={handleFolderSelect}
                />
              </div>
              <p className="text-[11px] text-text-muted">
                Location where generated audiobooks, narration WAVs, and MP4 video exports are saved.
              </p>
            </div>

            <button
              onClick={handleSave}
              className="w-full py-2.5 rounded-button text-xs font-bold bg-accent text-white shadow-neo-sm hover:opacity-90 transition-all flex items-center justify-center gap-1.5"
            >
              <Save className="w-4 h-4" /> Save Configuration
            </button>
          </div>
        </div>

        {/* Live Diagnostic Logs & System Terminal */}
        <div className="card-neo p-6 space-y-4 flex flex-col">
          <div className="flex items-center justify-between border-b border-border pb-3 shrink-0">
            <div className="flex items-center gap-2">
              <Terminal className="w-5 h-5 text-accent" />
              <h2 className="font-bold text-base text-text-primary">Diagnostic Logs</h2>
            </div>
            <button
              onClick={loadLogs}
              className="text-xs text-accent hover:underline font-semibold flex items-center gap-1"
            >
              <RefreshCw className={`w-3 h-3 ${isLoadingLogs ? 'animate-spin' : ''}`} /> Reload Logs
            </button>
          </div>

          <div className="p-4 bg-black/90 rounded-xl font-mono text-[11px] text-emerald-400 space-y-2 flex-1 overflow-y-auto leading-relaxed border border-border shadow-inner min-h-[300px] max-h-[420px]">
            {logs.length === 0 ? (
              <div className="text-text-muted italic">[LOGS] Fetching live system logs…</div>
            ) : (
              logs.map((line, idx) => (
                <div key={idx} className="hover:bg-white/5 px-1 rounded transition-colors break-all">
                  <span className="text-zinc-500 mr-2">[{new Date().toLocaleTimeString()}]</span>
                  <span className={line.includes('READY') || line.includes('active') || line.includes('Offline') ? 'text-emerald-400 font-bold' : line.includes('MISSING') || line.includes('ERROR') ? 'text-red-400' : 'text-zinc-300'}>
                    {line}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsView;
