import React from 'react';
import { useStudioStore } from '@/store/useStudioStore';
import {
  LayoutDashboard, FileText, Mic, Layers, ListMusic, BookOpen,
  Clock, Settings, Cpu, HardDrive, CheckCircle2, ChevronLeft, ChevronRight,
  Film, Code2, Scissors
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const {
    activeTab, setActiveTab, systemStats, selectedVoiceId, voices,
    sidebarCollapsed, toggleSidebar
  } = useStudioStore();

  const currentVoice = voices.find((v) => v.id === selectedVoiceId);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'editor', label: 'Script Editor', icon: FileText },
    { id: 'voices', label: 'Voice Library', icon: Mic },
    { id: 'batch', label: 'Batch & Subtitles', icon: Layers },
    { id: 'queue', label: 'Queue Manager', icon: ListMusic },
    { id: 'dictionary', label: 'Pronunciation', icon: BookOpen },
    { id: 'history', label: 'History', icon: Clock },
    { id: 'settings', label: 'Settings', icon: Settings },
  ] as const;

  const studioItems = [
    { id: 'timeline', label: 'Timeline Editor', icon: Layers },
    { id: 'videosync', label: 'Video Sync', icon: Film },
    { id: 'trimmer', label: 'Batch Trimmer', icon: Scissors },
    { id: 'api', label: 'REST API', icon: Code2 },
  ] as const;

  type AllNavId = typeof navItems[number]['id'] | typeof studioItems[number]['id'];

  return (
    <aside
      className={`relative bg-surface border-r border-border flex flex-col h-screen shrink-0 select-none transition-all duration-300 ${
        sidebarCollapsed ? 'w-[84px]' : 'w-[280px]'
      }`}
    >
      {/* Floating Border Edge Collapse Toggle Button */}
      <button
        onClick={toggleSidebar}
        className="absolute -right-3.5 top-5 z-40 w-7 h-7 bg-surface border-2 border-text-primary rounded-full shadow-neo-sm flex items-center justify-center text-text-primary hover:text-accent hover:scale-110 active:scale-95 transition-all cursor-pointer"
        title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
      >
        {sidebarCollapsed ? (
          <ChevronRight className="w-4 h-4 stroke-[2.5]" />
        ) : (
          <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
        )}
      </button>

      {/* Brand Header */}
      <div className="h-[72px] border-b border-border flex items-center px-4">
        {!sidebarCollapsed ? (
          <div className="flex items-center gap-3 min-w-0 overflow-hidden pr-4">
            {/* Brand Logo Icon */}
            <div className="w-10 h-10 bg-accent border-2 border-text-primary rounded-xl flex items-center justify-center shadow-neo-sm shrink-0">
              <Mic className="w-5 h-5 text-white stroke-[2.5]" />
            </div>
            <div className="truncate">
              <h1 className="font-bold text-base tracking-tight text-text-primary">
                ProVoice <span className="text-accent">Studio</span>
              </h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                  100% Offline
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* Perfectly Centered Logo in Collapsed Mode */
          <div className="w-full flex items-center justify-center">
            <div
              className="w-10 h-10 bg-accent border-2 border-text-primary rounded-xl flex items-center justify-center shadow-neo-sm shrink-0"
              title="ProVoice Studio"
            >
              <Mic className="w-5 h-5 text-white stroke-[2.5]" />
            </div>
          </div>
        )}
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 px-2.5 py-4 space-y-1.5 overflow-y-auto">
        {!sidebarCollapsed && (
          <div className="px-3 mb-2 text-[11px] font-bold text-text-muted uppercase tracking-wider">
            Navigation
          </div>
        )}
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              title={sidebarCollapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3.5 px-3 py-2.5 rounded-button text-sm font-semibold transition-all ${
                sidebarCollapsed ? 'justify-center' : ''
              } ${
                isActive
                  ? 'bg-surface text-text-primary border-2 border-text-primary shadow-neo-sm translate-x-0.5'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover border border-transparent'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 stroke-[2] ${isActive ? 'text-accent' : 'text-text-muted'}`} />
              {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}

        {/* Studio Tools Divider */}
        {!sidebarCollapsed && (
          <div className="px-3 pt-3 pb-1 text-[11px] font-bold text-text-muted uppercase tracking-wider border-t border-border mt-2">
            Studio Tools
          </div>
        )}
        {sidebarCollapsed && <div className="border-t border-border my-2" />}

        {studioItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              title={sidebarCollapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3.5 px-3 py-2.5 rounded-button text-sm font-semibold transition-all ${
                sidebarCollapsed ? 'justify-center' : ''
              } ${
                isActive
                  ? 'bg-surface text-text-primary border-2 border-text-primary shadow-neo-sm translate-x-0.5'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover border border-transparent'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 stroke-[2] ${isActive ? 'text-accent' : 'text-text-muted'}`} />
              {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Active Voice & System Status Footer */}
      {!sidebarCollapsed ? (
        <div className="p-4 border-t border-border bg-bg-secondary space-y-3">
          {/* Selected Voice Card */}
          <div className="p-3 bg-surface rounded-input border border-border flex items-center gap-3">
            <div className="w-8 h-8 rounded-badge bg-accent/10 text-accent font-bold flex items-center justify-center text-xs shrink-0">
              {currentVoice ? currentVoice.name.substring(0, 2).toUpperCase() : 'BE'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-text-primary truncate">
                {currentVoice?.name || 'Bella'}
              </div>
              <div className="text-[11px] text-text-muted truncate">
                {currentVoice?.category || 'Storyteller'} • {currentVoice?.accent || 'American'}
              </div>
            </div>
            <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
          </div>

          {/* CPU & RAM Performance Monitor */}
          <div className="p-3 bg-surface rounded-input border border-border space-y-2 text-xs">
            <div className="flex items-center justify-between text-text-secondary font-medium">
              <span className="flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-accent" /> CPU
              </span>
              <span className="font-mono font-bold text-text-primary">
                {systemStats ? `${systemStats.cpu_percent}%` : '12%'}
              </span>
            </div>
            <div className="w-full bg-border h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-accent h-full transition-all duration-500 rounded-full"
                style={{ width: `${systemStats?.cpu_percent || 12}%` }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="p-3 border-t border-border bg-bg-secondary flex justify-center">
          <div
            className="w-8 h-8 rounded-badge bg-accent/10 text-accent font-bold flex items-center justify-center text-xs"
            title={`Active Voice: ${currentVoice?.name || 'Bella'}`}
          >
            {currentVoice ? currentVoice.name.substring(0, 2).toUpperCase() : 'BE'}
          </div>
        </div>
      )}
    </aside>
  );
};
