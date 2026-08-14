import React, { useEffect } from 'react';
import { useStudioStore } from '@/store/useStudioStore';
import { Clock, Play, Download, Trash2, FileAudio } from 'lucide-react';

export const HistoryView: React.FC = () => {
  const { historyList, fetchHistory, setCurrentAudio } = useStudioStore();

  useEffect(() => {
    fetchHistory();
  }, []);

  const deleteItem = async (id: string) => {
    try {
      const res = await fetch(`/api/history/${id}`, { method: 'DELETE' });
      if (res.ok) fetchHistory();
    } catch {}
  };

  return (
    <div className="p-8 space-y-6 max-w-[1400px] mx-auto select-none">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary flex items-center gap-2">
          <Clock className="w-6 h-6 text-accent" /> Generation History
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Review all rendered narration files with metadata, durations, and instant playback.
        </p>
      </div>

      <div className="card-neo p-6 space-y-4">
        {historyList.length === 0 ? (
          <div className="p-12 text-center bg-bg-secondary rounded-input border border-dashed border-border space-y-2">
            <FileAudio className="w-8 h-8 text-text-muted mx-auto" />
            <div className="text-sm font-semibold text-text-primary">No audio history</div>
            <p className="text-xs text-text-muted">
              Generations will appear here automatically after rendering.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {historyList.map((item) => (
              <div key={item.id} className="py-4 flex items-center justify-between">
                <div className="space-y-1 max-w-2xl">
                  <div className="text-sm font-bold text-text-primary truncate">
                    "{item.text}"
                  </div>
                  <div className="text-xs text-text-muted flex items-center gap-3">
                    <span>Voice: <strong className="text-text-secondary">{item.voice}</strong></span>
                    <span>•</span>
                    <span>Duration: <strong className="text-text-secondary font-mono">{item.duration}s</strong></span>
                    <span>•</span>
                    <span>Render Time: <strong className="text-text-secondary font-mono">{item.render_time}s</strong></span>
                    <span>•</span>
                    <span>Size: <strong className="text-text-secondary font-mono">{Math.round(item.file_size / 1024)} KB</strong></span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setCurrentAudio(item.audio_url, item)}
                    className="btn-neo px-4 py-2 text-xs flex items-center gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5 text-white fill-white" /> Play Audio
                  </button>
                  <a
                    href={item.audio_url}
                    download={`provoice_${item.id}.wav`}
                    className="btn-neo-secondary px-3 py-2 text-xs flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" /> Save WAV
                  </a>
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="p-2 text-text-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                    title="Delete history entry"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
