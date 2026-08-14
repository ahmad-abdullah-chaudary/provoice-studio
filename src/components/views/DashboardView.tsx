import React, { useState, useEffect } from 'react';
import { useStudioStore } from '@/store/useStudioStore';
import { Wand2, Mic, Clock, Cpu, FileText, ArrowRight, Play, Sparkles, Layers, Plus, FolderOpen, Loader2 } from 'lucide-react';

export const DashboardView: React.FC = () => {
  const {
    voices, selectedVoiceId, setSelectedVoiceId, setActiveTab,
    startGeneration, generationJob, systemStats, historyList,
    projectList, fetchProjects, openProject, createNewProject, saveCurrentProject, currentProject,
  } = useStudioStore();

  const [quickText, setQuickText] = useState(
    'Welcome to ProVoice Studio. Experience high-fidelity, offline AI voice narration built for professional creators.'
  );

  useEffect(() => { fetchProjects(); }, []);

  const isGenerating = generationJob.status === 'processing';

  return (
    <div className="p-8 space-y-8 max-w-[1400px] mx-auto">
      {/* Header Banner */}
      <div className="p-8 bg-surface rounded-card border-2 border-text-primary shadow-neo flex items-center justify-between">
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-accent/10 text-accent rounded-badge text-xs font-bold border border-accent/20">
            <Sparkles className="w-3.5 h-3.5" /> Studio Quality Voice Suite
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-text-primary">
            Create Natural Narration in Seconds
          </h1>
          <p className="text-sm text-text-secondary leading-relaxed">
            100% Offline AI narration powered by Kokoro ONNX. Zero telemetry, zero cloud latency, unlimited voice generation.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab('editor')}
            className="btn-neo px-6 py-3 text-sm flex items-center gap-2"
          >
            <FileText className="w-4 h-4" /> Open Script Editor
          </button>
        </div>
      </div>

      {/* Grid Layout: Quick Sandbox + System Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Quick Text-to-Speech Sandbox (2 Columns) */}
        <div className="lg:col-span-2 card-neo p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-accent" />
              <h2 className="font-bold text-base text-text-primary">Quick Speech Sandbox</h2>
            </div>
            {/* Voice Dropdown */}
            <select
              value={selectedVoiceId}
              onChange={(e) => setSelectedVoiceId(e.target.value)}
              className="bg-bg-secondary px-3 py-1.5 rounded-input border border-border text-xs font-bold text-text-primary cursor-pointer"
            >
              {voices.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.accent} {v.gender})
                </option>
              ))}
            </select>
          </div>

          <textarea
            value={quickText}
            onChange={(e) => setQuickText(e.target.value)}
            rows={4}
            className="w-full p-4 bg-bg-secondary rounded-input border border-border text-sm text-text-primary focus:outline-none focus:border-accent font-sans resize-none"
            placeholder="Enter quick text to synthesize..."
          />

          <div className="flex justify-between items-center pt-2">
            <div className="text-xs font-semibold text-text-muted">
              {quickText.length} Characters • ~{Math.ceil(quickText.split(' ').length / 3)}s Estimated
            </div>
            <button
              onClick={() => startGeneration(quickText)}
              disabled={isGenerating || !quickText.trim()}
              className="btn-neo px-5 py-2.5 text-xs flex items-center gap-2"
            >
              <Wand2 className="w-4 h-4 text-white" />
              <span>{isGenerating ? 'Synthesizing...' : 'Generate Sandbox Audio'}</span>
            </button>
          </div>
        </div>

        {/* Performance & Engine Stats (1 Column) */}
        <div className="card-neo p-6 space-y-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Cpu className="w-5 h-5 text-accent" />
              <h2 className="font-bold text-base text-text-primary">Engine Status</h2>
            </div>

            <div className="space-y-4">
              <div className="p-3.5 bg-bg-secondary rounded-input border border-border flex items-center justify-between">
                <span className="text-xs font-medium text-text-secondary">Engine Model</span>
                <span className="text-xs font-bold font-mono text-text-primary">Kokoro ONNX v1.0</span>
              </div>
              <div className="p-3.5 bg-bg-secondary rounded-input border border-border flex items-center justify-between">
                <span className="text-xs font-medium text-text-secondary">Available Voices</span>
                <span className="text-xs font-bold font-mono text-accent">{systemStats?.total_voices || voices.length} Voices</span>
              </div>
              <div className="p-3.5 bg-bg-secondary rounded-input border border-border flex items-center justify-between">
                <span className="text-xs font-medium text-text-secondary">Execution Provider</span>
                <span className="text-xs font-bold font-mono text-success">CPU Optimized</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setActiveTab('voices')}
            className="w-full btn-neo-secondary py-2.5 text-xs flex items-center justify-center gap-2"
          >
            <span>Explore Voice Library</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Recent Generations List */}
      <div className="card-neo p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-accent" />
            <h2 className="font-bold text-base text-text-primary">Recent Generations</h2>
          </div>
          <button
            onClick={() => setActiveTab('history')}
            className="text-xs font-bold text-accent hover:underline flex items-center gap-1"
          >
            View All History <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {historyList.length === 0 ? (
          <div className="p-8 text-center bg-bg-secondary rounded-input border border-dashed border-border space-y-2">
            <Mic className="w-8 h-8 text-text-muted mx-auto" />
            <div className="text-sm font-semibold text-text-primary">No generations yet</div>
            <p className="text-xs text-text-muted max-w-sm mx-auto">
              Synthesize your first script or sandbox audio to start building your studio collection.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {historyList.slice(0, 4).map((item) => (
              <div key={item.id} className="py-3 flex items-center justify-between">
                <div className="space-y-0.5 max-w-xl">
                  <div className="text-xs font-semibold text-text-primary truncate">
                    "{item.text}"
                  </div>
                  <div className="text-[11px] text-text-muted">
                    Voice: <span className="font-semibold text-text-secondary">{item.voice}</span> • Duration: {item.duration}s • Render Time: {item.render_time}s
                  </div>
                </div>
                <button
                  onClick={() => useStudioStore.getState().setCurrentAudio(item.audio_url, item)}
                  className="btn-neo-secondary px-3 py-1.5 text-xs flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5 text-accent fill-accent" /> Play Audio
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Projects ─────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-accent" />
            <h2 className="font-bold text-base text-text-primary">Projects</h2>
            <span className="text-xs font-bold text-text-muted bg-bg-secondary px-2 py-0.5 rounded-badge border border-border">{projectList.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={saveCurrentProject}
              className="btn-neo-secondary px-4 py-2 text-xs flex items-center gap-2">
              Save Current
            </button>
            <button onClick={createNewProject}
              className="btn-neo px-4 py-2 text-xs flex items-center gap-2">
              <Plus className="w-4 h-4 text-white" /> New Project
            </button>
          </div>
        </div>

        {projectList.length === 0 ? (
          <div className="p-10 bg-surface border border-dashed border-border rounded-card text-center">
            <FolderOpen className="w-8 h-8 text-border mx-auto mb-3" />
            <p className="text-sm text-text-muted">No projects yet. Save your current work or create a new project.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {projectList.map(p => (
              <button key={p.id} onClick={() => openProject(p)}
                className={`text-left p-5 bg-surface rounded-card border-2 transition-all hover:shadow-neo-sm ${
                  p.id === currentProject.id ? 'border-accent shadow-neo-sm' : 'border-border hover:border-text-primary'
                }`}>
                <div className="font-bold text-text-primary mb-1 truncate">{p.title}</div>
                <div className="text-xs text-text-muted mb-2">{p.voice} · {(p.segments || []).length} segment(s)</div>
                <div className="text-[11px] text-text-muted">
                  {new Date(p.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
