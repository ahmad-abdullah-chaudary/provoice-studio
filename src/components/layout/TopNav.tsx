import React from 'react';
import { useStudioStore } from '@/store/useStudioStore';
import { Wand2, Save, Mic, Loader2, Sliders, PanelRightClose, PanelRightOpen } from 'lucide-react';

export const TopNav: React.FC = () => {
  const {
    currentProject,
    updateProjectTitle,
    selectedVoiceId,
    setSelectedVoiceId,
    voices,
    startGeneration,
    generationJob,
    setActiveTab,
    inspectorCollapsed,
    toggleInspector,
  } = useStudioStore();

  return (
    <header className="h-[72px] bg-surface border-b border-border px-4 md:px-6 flex items-center justify-between shrink-0 select-none min-w-0">
      {/* Editable Project Title */}
      <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
        <input
          type="text"
          value={currentProject.title}
          onChange={(e) => updateProjectTitle(e.target.value)}
          className="font-bold text-base md:text-lg text-text-primary bg-transparent border-b border-transparent hover:border-border focus:border-accent focus:outline-none px-1.5 py-0.5 rounded transition-all max-w-[200px] sm:max-w-[300px] truncate"
          placeholder="Project Title..."
        />
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-bg-secondary rounded-badge border border-border text-xs text-text-muted font-medium shrink-0">
          <Save className="w-3.5 h-3.5 text-success" /> Auto-saved
        </div>
      </div>

      {/* Center Voice Switcher & Primary Actions */}
      <div className="flex items-center gap-2 md:gap-4 shrink-0">
        {/* Quick Voice Selector Dropdown */}
        <div className="hidden md:flex items-center gap-2 bg-bg-secondary px-3 py-1.5 rounded-button border border-border">
          <Mic className="w-4 h-4 text-accent shrink-0" />
          <select
            value={selectedVoiceId}
            onChange={(e) => setSelectedVoiceId(e.target.value)}
            className="bg-transparent text-xs font-semibold text-text-primary focus:outline-none cursor-pointer max-w-[140px] truncate"
          >
            {voices.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} ({v.category})
              </option>
            ))}
          </select>
          <button
            onClick={() => setActiveTab('voices')}
            className="text-[11px] font-bold text-accent hover:underline px-1 shrink-0"
          >
            Browse
          </button>
        </div>

        {/* Primary Action Button: Soft Neobrutalism Generate Button */}
        <button
          onClick={() => startGeneration(currentProject.script)}
          disabled={generationJob.status === 'processing' || !currentProject.script.trim()}
          className="btn-neo px-4 md:px-5 py-2 md:py-2.5 text-xs md:text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generationJob.status === 'processing' ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              <span className="hidden sm:inline">Rendering…</span>
            </>
          ) : (
            <>
              <Wand2 className="w-4 h-4 text-white stroke-[2.5]" />
              <span>Generate</span>
            </>
          )}
        </button>

        {/* Toggle Audio Inspector */}
        <button
          onClick={toggleInspector}
          className={`p-2 rounded-button border-2 transition-all flex items-center gap-1.5 text-xs font-bold ${
            !inspectorCollapsed
              ? 'bg-accent/10 border-accent text-accent'
              : 'bg-surface border-border text-text-secondary hover:border-text-primary'
          }`}
          title={inspectorCollapsed ? "Open Audio Inspector" : "Close Audio Inspector"}
        >
          <Sliders className="w-4 h-4 stroke-[2]" />
          <span className="hidden lg:inline">{inspectorCollapsed ? "DSP" : "DSP"}</span>
        </button>
      </div>
    </header>
  );
};
