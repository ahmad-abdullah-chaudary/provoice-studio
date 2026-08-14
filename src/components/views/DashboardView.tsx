import React, { useState, useEffect } from 'react';
import { useStudioStore } from '@/store/useStudioStore';
import { Wand2, Mic, Clock, Cpu, FileText, ArrowRight, Play, Sparkles, Layers, Plus, FolderOpen, Loader2, Trash2, CheckCircle2 } from 'lucide-react';

export const DashboardView: React.FC = () => {
  const {
    voices, selectedVoiceId, setSelectedVoiceId, setActiveTab,
    startGeneration, generationJob, systemStats, historyList,
    projectList, fetchProjects, openProject, createNewProject, saveCurrentProject, currentProject, deleteProject,
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
            <h2 className="font-bold text-base text-text-primary">Saved Projects</h2>
            <span className="text-xs font-bold text-accent bg-accent/10 px-2.5 py-0.5 rounded-full border border-accent/20">
              {projectList.length}
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => saveCurrentProject()}
              className="btn-neo-secondary px-4 py-2 text-xs flex items-center gap-2"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-success" /> Save Current Project
            </button>
            <button
              onClick={() => createNewProject()}
              className="btn-neo px-4 py-2 text-xs flex items-center gap-2"
            >
              <Plus className="w-4 h-4 text-white" /> New Project
            </button>
          </div>
        </div>

        {projectList.length === 0 ? (
          <div className="p-10 bg-surface border-2 border-dashed border-border rounded-2xl text-center space-y-3">
            <FolderOpen className="w-10 h-10 text-text-muted mx-auto opacity-50" />
            <p className="text-sm font-semibold text-text-primary">No saved projects yet</p>
            <p className="text-xs text-text-muted max-w-sm mx-auto">
              Create a new project or save your current narration session to access it anytime here.
            </p>
            <button
              onClick={() => createNewProject()}
              className="btn-neo px-5 py-2.5 text-xs font-bold inline-flex items-center gap-2 mt-2"
            >
              <Plus className="w-4 h-4 text-white" /> Create First Project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {projectList.map((p) => {
              const isActive = p.id === currentProject.id;
              const dateStr = p.updated_at
                ? new Date(p.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                : 'Recently';
              return (
                <div
                  key={p.id}
                  onClick={() => openProject(p)}
                  className={`p-5 bg-surface rounded-2xl border-2 transition-all cursor-pointer hover:shadow-neo-sm space-y-3 ${
                    isActive ? 'border-accent shadow-neo-sm bg-accent/5' : 'border-border hover:border-text-primary'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-sm text-text-primary truncate flex items-center gap-2">
                        {p.title || 'Untitled Project'}
                        {isActive && (
                          <span className="px-2 py-0.5 text-[9px] font-bold bg-accent text-white rounded-full shrink-0">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-text-muted mt-0.5">
                        Voice: <span className="font-semibold text-text-secondary font-mono">{p.voice || 'af_bella'}</span> • {(p.segments || []).length} segment(s)
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete project "${p.title}"?`)) {
                          deleteProject(p.id);
                        }
                      }}
                      className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-all shrink-0"
                      title="Delete Project"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {p.script && (
                    <p className="text-xs text-text-secondary line-clamp-2 italic bg-bg-secondary p-2.5 rounded-lg border border-border/60">
                      "{p.script}"
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-1 border-t border-border/80 text-[11px] text-text-muted">
                    <span>Last modified: {dateStr}</span>
                    <span className="font-bold text-accent hover:underline flex items-center gap-1">
                      Open <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
