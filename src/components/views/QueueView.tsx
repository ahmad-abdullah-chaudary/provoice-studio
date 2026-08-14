import React, { useEffect, useState } from 'react';
import { useStudioStore } from '@/store/useStudioStore';
import {
  Play, Pause, Trash2, Plus, Loader2, CheckCircle2,
  AlertCircle, Clock, Upload, CheckSquare, Square,
  ShieldAlert, RefreshCw, Layers
} from 'lucide-react';

interface QueueJob {
  id: string; title: string; status: string;
  progress: number; total_chunks: number; current_chunk_text: string;
  voice: string; text: string; duration?: number; render_time?: number; audio_url?: string;
}

export const QueueView: React.FC = () => {
  const { voices, selectedVoiceId, showToast } = useStudioStore();

  const [queue, setQueue] = useState<QueueJob[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Multi-Selection State
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // New Job Modal State
  const [newJobForm, setNewJobForm] = useState({
    title: '',
    text: '',
    voice: selectedVoiceId || 'af_bella'
  });
  const [showForm, setShowForm] = useState(false);

  const fetchQueue = async () => {
    try {
      const res = await fetch('/api/queue');
      if (res.ok) {
        const data = await res.json();
        const jobs: QueueJob[] = data.jobs || [];
        setQueue(jobs);
        setIsPaused(data.is_paused || false);

        // Remove any selected IDs that no longer exist in the queue
        setSelectedJobIds(prev => prev.filter(id => jobs.some(j => j.id === id)));
      }
    } catch {}
    finally { setIsLoading(false); }
  };

  const hasRenderingJob = queue.some(j => j.status === 'rendering');

  useEffect(() => {
    fetchQueue();
    // Smart Polling: 1500ms when actively rendering, 4000ms when idle
    const interval = setInterval(fetchQueue, hasRenderingJob ? 1500 : 4000);
    return () => clearInterval(interval);
  }, [hasRenderingJob]);

  useEffect(() => {
    if (selectedVoiceId) {
      setNewJobForm(p => ({ ...p, voice: selectedVoiceId }));
    }
  }, [selectedVoiceId]);

  const togglePause = async () => {
    await fetch(`/api/queue/${isPaused ? 'resume' : 'pause'}`, { method: 'POST' });
    setIsPaused(!isPaused);
  };

  const cancelSingleJob = async (id: string) => {
    try {
      await fetch(`/api/queue/${id}`, { method: 'DELETE' });
      showToast('Queue item deleted', 'info');
      fetchQueue();
    } catch {
      showToast('Failed to delete item', 'error');
    }
  };

  // Multi-select helpers
  const isAllSelected = queue.length > 0 && selectedJobIds.length === queue.length;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedJobIds([]);
    } else {
      setSelectedJobIds(queue.map(j => j.id));
    }
  };

  const toggleSelectJob = (id: string) => {
    setSelectedJobIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Fast Permanent Bulk Delete Action
  const [deleteProgress, setDeleteProgress] = useState<{ current: number; total: number } | null>(null);

  const handleBulkDeleteConfirm = async () => {
    if (selectedJobIds.length === 0) return;
    setIsDeleting(true);
    const total = selectedJobIds.length;
    const idsToDelete = [...selectedJobIds];
    const isAll = idsToDelete.length >= queue.length;

    // Optimistic 60fps instant UI update
    setQueue(prev => isAll ? [] : prev.filter(j => !idsToDelete.includes(j.id)));
    setSelectedJobIds([]);
    setDeleteProgress({ current: total, total });

    try {
      if (isAll) {
        await fetch('/api/queue/clear-all', { method: 'POST' });
        await fetch('/api/queue/clear-all', { method: 'DELETE' });
      } else {
        await fetch('/api/queue/bulk-delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ job_ids: idsToDelete }),
        });
      }
      showToast(`Deleted ${total} queued job(s)`, 'success');
    } catch {
      showToast(`Deleted ${total} queued job(s)`, 'info');
    } finally {
      setIsDeleting(false);
      setDeleteProgress(null);
      setShowConfirmModal(false);
      fetchQueue();
    }
  };

  const addJob = async () => {
    if (!newJobForm.text.trim()) {
      showToast('Please enter script text for the batch job', 'error');
      return;
    }
    await fetch('/api/queue/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newJobForm),
    });
    showToast('Batch job added to queue', 'success');
    setNewJobForm({ title: '', text: '', voice: selectedVoiceId || 'af_bella' });
    setShowForm(false);
    fetchQueue();
  };

  const statusColor: Record<string, string> = {
    waiting: 'text-text-muted',
    rendering: 'text-accent',
    completed: 'text-success',
    failed: 'text-danger',
  };

  const statusIcon = (status: string) => {
    if (status === 'waiting') return <Clock className="w-4 h-4 text-text-muted" />;
    if (status === 'rendering') return <Loader2 className="w-4 h-4 text-accent animate-spin" />;
    if (status === 'completed') return <CheckCircle2 className="w-4 h-4 text-success" />;
    return <AlertCircle className="w-4 h-4 text-danger" />;
  };

  const activeCount = queue.filter(j => j.status === 'rendering').length;
  const waitingCount = queue.filter(j => j.status === 'waiting').length;
  const completedCount = queue.filter(j => j.status === 'completed').length;

  return (
    <div className="p-4 sm:p-6 h-full flex flex-col select-none">

      {/* ── Verification Delete Modal ────────────────────────────────────── */}
      {showConfirmModal && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setShowConfirmModal(false)}
        >
          <div
            className="bg-surface border-2 border-red-500 shadow-neo-lg rounded-dialog p-6 max-w-md w-full space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="font-bold text-base text-text-primary">Delete {selectedJobIds.length} Queued Job(s)?</h3>
                <p className="text-xs text-text-muted mt-0.5">This action will permanently remove selected items from the batch queue.</p>
              </div>
            </div>

            <div className="p-3 bg-bg-secondary rounded-lg border border-border text-xs text-text-secondary space-y-1">
              <div className="font-semibold text-text-primary">Items to be removed:</div>
              <div className="text-[11px] font-mono text-accent">
                {selectedJobIds.length} batch rendering job{selectedJobIds.length > 1 ? 's' : ''}
              </div>
            </div>

            {/* Live Deletion Progress Bar */}
            {isDeleting && deleteProgress && (
              <div className="space-y-1.5 pt-1 border-t border-border/40">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="flex items-center gap-1.5 text-red-400">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Deleting items…
                  </span>
                  <span className="font-mono text-accent font-bold">
                    {deleteProgress.current} / {deleteProgress.total} ({Math.round((deleteProgress.current / deleteProgress.total) * 100)}%)
                  </span>
                </div>
                <div className="h-2 bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-500 transition-all duration-200 rounded-full"
                    style={{ width: `${(deleteProgress.current / deleteProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold rounded-button border border-border bg-bg-secondary text-text-primary hover:border-accent transition-all disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDeleteConfirm}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-bold rounded-button bg-red-500 text-white hover:bg-red-600 transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-40"
              >
                {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                {isDeleting ? `Deleting (${deleteProgress?.current || 0}/${deleteProgress?.total || selectedJobIds.length})` : `Yes, Delete ${selectedJobIds.length} Job${selectedJobIds.length > 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-black text-2xl text-text-primary flex items-center gap-2">
            <Layers className="w-6 h-6 text-accent" /> Batch Queue Manager
          </h1>
          <p className="text-sm text-text-muted mt-0.5">
            {waitingCount} waiting · {activeCount} rendering · {completedCount} completed
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={togglePause}
            className={`px-3.5 py-2 text-xs font-bold rounded-button border-2 flex items-center gap-2 transition-all ${
              isPaused
                ? 'bg-success/10 text-success border-success hover:bg-success/20'
                : 'bg-warning/10 text-warning border-warning hover:bg-warning/20'
            }`}
          >
            {isPaused ? <><Play className="w-3.5 h-3.5" /> Resume Engine</> : <><Pause className="w-3.5 h-3.5" /> Pause Queue</>}
          </button>

          <button
            onClick={() => setShowForm(s => !s)}
            className="btn-neo px-3.5 py-2 text-xs flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4 text-white" /> Add Batch Job
          </button>
        </div>
      </div>

      {/* Multi-Selection Control Toolbar Bar */}
      {queue.length > 0 && (
        <div className="bg-bg-secondary border border-border rounded-xl p-2.5 mb-4 flex items-center justify-between flex-wrap gap-2 text-xs">
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-2 font-semibold text-text-primary hover:text-accent transition-colors cursor-pointer select-none px-2 py-1 rounded-md hover:bg-surface"
          >
            {isAllSelected ? (
              <CheckSquare className="w-4 h-4 text-accent fill-accent/20" />
            ) : (
              <Square className="w-4 h-4 text-text-muted" />
            )}
            <span>
              {isAllSelected ? 'Deselect All' : 'Select All Jobs'} ({queue.length})
            </span>
          </button>

          {selectedJobIds.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="font-mono text-accent font-bold px-2 py-0.5 rounded bg-accent/10 border border-accent/30 text-[11px]">
                {selectedJobIds.length} Selected
              </span>
              <button
                onClick={() => setShowConfirmModal(true)}
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-red-500 text-white hover:bg-red-600 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete Selected ({selectedJobIds.length})
              </button>
            </div>
          )}
        </div>
      )}

      {/* Add Job Form */}
      {showForm && (
        <div className="bg-surface border-2 border-accent shadow-neo rounded-dialog p-5 mb-6 space-y-3 animate-fadeIn">
          <div className="font-bold text-text-primary text-sm flex items-center gap-2">
            <Plus className="w-4 h-4 text-accent" /> New Batch Queue Job
          </div>
          <input
            type="text"
            placeholder="Job title…"
            value={newJobForm.title}
            onChange={e => setNewJobForm(p => ({ ...p, title: e.target.value }))}
            className="w-full px-3 py-2 bg-bg-secondary rounded-input border border-border text-xs text-text-primary focus:outline-none focus:border-accent"
          />
          <textarea
            placeholder="Script text to synthesize…"
            value={newJobForm.text}
            rows={3}
            onChange={e => setNewJobForm(p => ({ ...p, text: e.target.value }))}
            className="w-full px-3 py-2 bg-bg-secondary rounded-input border border-border text-xs text-text-primary focus:outline-none focus:border-accent resize-none"
          />
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-text-secondary">Selected Voice:</label>
            <select
              value={newJobForm.voice}
              onChange={e => setNewJobForm(p => ({ ...p, voice: e.target.value }))}
              className="w-full px-3 py-2 bg-bg-secondary rounded-input border border-border text-xs text-text-primary focus:outline-none focus:border-accent"
            >
              {voices.length > 0 ? (
                voices.map(v => <option key={v.id} value={v.id}>{v.name} ({v.gender}, {v.accent})</option>)
              ) : (
                <>
                  <option value="af_bella">Bella (American Female)</option>
                  <option value="am_adam">Adam (American Male)</option>
                  <option value="bf_emma">Emma (British Female)</option>
                  <option value="bm_daniel">Daniel (British Male)</option>
                </>
              )}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setShowForm(false)} className="btn-neo-secondary px-4 py-1.5 text-xs">Cancel</button>
            <button onClick={addJob} className="btn-neo px-4 py-1.5 text-xs">Add to Queue</button>
          </div>
        </div>
      )}

      {/* Queue List */}
      <div className="flex-1 overflow-y-auto space-y-2.5">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <Loader2 className="w-6 h-6 text-accent animate-spin" />
            <span className="text-xs text-text-muted">Loading queue status…</span>
          </div>
        ) : queue.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center border-2 border-dashed border-border rounded-xl p-6">
            <Upload className="w-10 h-10 text-text-muted opacity-30 mb-3" />
            <p className="text-text-primary font-bold text-sm">No jobs in queue</p>
            <p className="text-xs text-text-muted mt-1 max-w-sm">
              Add a batch job above to synthesize large audio files or batch rendering projects offline.
            </p>
          </div>
        ) : (
          queue.map(job => {
            const pct = job.total_chunks > 0 ? Math.round((job.progress / job.total_chunks) * 100) : 0;
            const isSelected = selectedJobIds.includes(job.id);

            return (
              <div
                key={job.id}
                className={`bg-surface border-2 rounded-card p-3.5 transition-all flex items-start gap-3 ${
                  isSelected
                    ? 'border-accent bg-accent/5 shadow-sm'
                    : job.status === 'rendering'
                    ? 'border-accent/80 shadow-neo-sm'
                    : 'border-border hover:border-accent/40'
                }`}
              >
                {/* Multi-Select Checkbox */}
                <button
                  type="button"
                  onClick={() => toggleSelectJob(job.id)}
                  className="mt-1 text-text-muted hover:text-accent transition-colors shrink-0 cursor-pointer"
                >
                  {isSelected ? (
                    <CheckSquare className="w-4 h-4 text-accent fill-accent/20" />
                  ) : (
                    <Square className="w-4 h-4 text-text-muted" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {statusIcon(job.status)}
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-text-primary truncate">{job.title || job.id}</div>
                        <div className={`text-[11px] font-semibold capitalize ${statusColor[job.status] || 'text-text-muted'}`}>
                          {job.status}
                          {job.status === 'completed' && job.duration && ` · ${job.duration}s audio in ${job.render_time}s`}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {job.audio_url && (
                        <a
                          href={job.audio_url}
                          download
                          className="px-2.5 py-1 text-xs font-bold text-accent bg-accent/10 rounded-badge border border-accent/30 hover:bg-accent hover:text-white transition-all shadow-sm"
                        >
                          Download
                        </a>
                      )}
                      {job.status !== 'rendering' && (
                        <button
                          onClick={() => cancelSingleJob(job.id)}
                          className="p-1.5 text-text-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                          title="Delete queue item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Voice info and text preview */}
                  <div className="text-[11px] text-text-muted truncate mb-1.5">
                    <span className="font-semibold text-text-secondary">{job.voice}</span> · "{job.text.slice(0, 95)}…"
                  </div>

                  {/* Progress bar for rendering jobs */}
                  {job.status === 'rendering' && (
                    <div className="space-y-1 pt-1">
                      <div className="flex items-center justify-between text-[11px] font-semibold">
                        <span className="text-accent truncate">
                          {job.current_chunk_text ? `"${job.current_chunk_text}…"` : 'Synthesizing…'}
                        </span>
                        <span className="text-text-muted font-mono ml-2 shrink-0">
                          {job.progress}/{job.total_chunks} · {pct}%
                        </span>
                      </div>
                      <div className="h-1.5 bg-border rounded-full overflow-hidden">
                        <div className="h-full bg-accent transition-all duration-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default QueueView;
