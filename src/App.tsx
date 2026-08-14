import React, { useEffect } from 'react';
import { useStudioStore } from '@/store/useStudioStore';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopNav } from '@/components/layout/TopNav';
import { AudioInspector } from '@/components/views/AudioInspector';
import { DashboardView } from '@/components/views/DashboardView';
import { ScriptEditorView } from '@/components/views/ScriptEditorView';
import { VoiceLibraryView } from '@/components/views/VoiceLibraryView';
import { BatchSubtitlesView } from '@/components/views/BatchSubtitlesView';
import { QueueView } from '@/components/views/QueueView';
import { PronunciationView } from '@/components/views/PronunciationView';
import { HistoryView } from '@/components/views/HistoryView';
import { SettingsView } from '@/components/views/SettingsView';
import { TimelineView } from '@/components/views/TimelineView';
import { VideoSyncView } from '@/components/views/VideoSyncView';
import { VideoTrimmerView } from '@/components/views/VideoTrimmerView';
import { ApiView } from '@/components/views/ApiView';
import { AudioPlayer } from '@/components/player/AudioPlayer';
import { ExportModal } from '@/components/ui/ExportModal';
import { KeyboardShortcuts } from '@/components/ui/KeyboardShortcuts';
import { AlertTriangle, CheckCircle2, Loader2, X } from 'lucide-react';

// ─── Toast Notification ────────────────────────────────────────────────────────

const Toast: React.FC = () => {
  const { toast, showToast } = useStudioStore();
  if (!toast || !toast.message) return null;

  const styles = {
    success: { border: 'border-l-4 border-l-[#22c55e]', icon: <CheckCircle2 className="w-4 h-4 text-[#22c55e] shrink-0" /> },
    error: { border: 'border-l-4 border-l-[#ef4444]', icon: <AlertTriangle className="w-4 h-4 text-[#ef4444] shrink-0" /> },
    info: { border: 'border-l-4 border-l-blue-500', icon: <Loader2 className="w-4 h-4 text-blue-500 shrink-0" /> },
  };
  const s = styles[toast.type] || styles.info;

  return (
    <div className={`fixed bottom-28 right-6 z-[100] bg-surface ${s.border} border border-border shadow-neo-lg rounded-card px-5 py-3.5 flex items-center gap-3 max-w-sm`}>
      {s.icon}
      <span className="text-sm font-semibold text-text-primary flex-1">{toast.message}</span>
      <button onClick={() => showToast('', 'info')} className="text-text-muted hover:text-text-primary ml-1 shrink-0">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

// ─── Backend Status Banner ─────────────────────────────────────────────────────

const BackendStatusBanner: React.FC = () => {
  const { backendStatus, fetchVoices, fetchSystemStats } = useStudioStore();
  if (backendStatus === 'online') return null;

  return (
    <div className={`w-full px-6 py-1.5 text-xs font-semibold flex items-center justify-between gap-3 shrink-0 ${
      backendStatus === 'connecting'
        ? 'bg-amber-50 border-b border-amber-200 text-amber-700'
        : 'bg-red-50 border-b border-red-200 text-red-700'
    }`}>
      <div className="flex items-center gap-2">
        {backendStatus === 'connecting'
          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
          : <AlertTriangle className="w-3.5 h-3.5" />}
        <span>
          {backendStatus === 'connecting'
            ? 'Connecting to Kokoro Engine on port 8000…'
            : 'Backend offline — run start.bat to start the server'}
        </span>
      </div>
      {backendStatus === 'offline' && (
        <button onClick={() => { fetchVoices(); fetchSystemStats(); }}
          className="px-3 py-0.5 bg-red-100 border border-red-300 rounded text-red-700 hover:bg-red-200 transition-all">
          Retry
        </button>
      )}
    </div>
  );
};

// ─── App ───────────────────────────────────────────────────────────────────────

export const App: React.FC = () => {
  const { activeTab, fetchVoices, fetchSystemStats, fetchHistory, fetchEmotionPresets, backendStatus } = useStudioStore();

  useEffect(() => {
    // Initial load
    fetchVoices();
    fetchSystemStats();
    fetchHistory();
    fetchEmotionPresets();

    // Poll stats every 5s — retry voices if still offline OR if voices list is empty
    // (Kokoro ONNX model can take ~15s to load, causing the first fetchVoices to return empty)
    const interval = setInterval(() => {
      fetchSystemStats();
      const state = useStudioStore.getState();
      if (state.backendStatus !== 'online' || state.voices.length === 0) fetchVoices();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':   return <DashboardView />;
      case 'editor':      return <ScriptEditorView />;
      case 'voices':      return <VoiceLibraryView />;
      case 'batch':       return <BatchSubtitlesView />;
      case 'queue':       return <QueueView />;
      case 'dictionary':  return <PronunciationView />;
      case 'history':     return <HistoryView />;
      case 'settings':    return <SettingsView />;
      case 'timeline':    return <TimelineView />;
      case 'videosync':   return <VideoSyncView />;
      case 'trimmer':     return <VideoTrimmerView />;
      case 'api':         return <ApiView />;
      default:            return <DashboardView />;
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* Global keyboard shortcuts handler */}
      <KeyboardShortcuts />

      {/* 280px Sidebar */}
      <Sidebar />

      {/* Main container */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Connection status bar (only when not online) */}
        <BackendStatusBanner />

        {/* 72px Top navigation */}
        <TopNav />

        {/* Content body + 340px Inspector */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          <main className="flex-1 overflow-y-auto min-w-0">
            {renderActiveView()}
          </main>
          <AudioInspector />
        </div>

        {/* Persistent waveform audio player */}
        <AudioPlayer />
      </div>

      {/* Global Modals */}
      <ExportModal />

      {/* Toast notifications */}
      <Toast />
    </div>
  );
};

export default App;
