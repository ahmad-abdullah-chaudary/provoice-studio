import React, { useState } from 'react';
import { useStudioStore } from '@/store/useStudioStore';
import { Layers, Upload, FileText, CheckCircle2, ListPlus, ArrowRight } from 'lucide-react';

export const BatchSubtitlesView: React.FC = () => {
  const { selectedVoiceId, setActiveTab } = useStudioStore();
  const [subtitles, setSubtitles] = useState<any[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsProcessing(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/subtitles/parse', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setSubtitles(data.subtitles || []);
      }
    } catch (err) {
      console.error('Error parsing subtitle:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendToQueue = async () => {
    for (const sub of subtitles) {
      await fetch('/api/queue/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Block #${sub.id} (${sub.duration}s)`,
          text: sub.text,
          voice: selectedVoiceId,
        }),
      });
    }
    setActiveTab('queue');
  };

  return (
    <div className="p-8 space-y-6 max-w-[1400px] mx-auto select-none">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary flex items-center gap-2">
          <Layers className="w-6 h-6 text-accent" /> Batch Generation & Subtitle Importer
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Import subtitle files (.srt, .vtt) or text documents to automatically convert every line into synchronized narration.
        </p>
      </div>

      {/* File Upload Box */}
      <div className="p-8 bg-surface rounded-card border-2 border-dashed border-border text-center space-y-4 hover:border-accent transition-all">
        <div className="w-12 h-12 rounded-full bg-accent/10 text-accent flex items-center justify-center mx-auto">
          <Upload className="w-6 h-6" />
        </div>
        <div>
          <h3 className="font-bold text-base text-text-primary">
            Upload Subtitle or Script File
          </h3>
          <p className="text-xs text-text-muted mt-1">
            Supports .SRT, .VTT, .TXT, .MD, .CSV, .JSON formats
          </p>
        </div>
        <input
          type="file"
          accept=".srt,.vtt,.txt,.md,.json,.csv"
          onChange={handleFileUpload}
          className="hidden"
          id="file-upload-input"
        />
        <label
          htmlFor="file-upload-input"
          className="btn-neo px-6 py-2.5 text-xs inline-flex items-center gap-2 cursor-pointer"
        >
          {isProcessing ? 'Parsing File...' : 'Choose File to Import'}
        </label>
      </div>

      {/* Parsed Subtitle Blocks Table */}
      {subtitles.length > 0 && (
        <div className="card-neo p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-base text-text-primary">
                Parsed Subtitle Blocks ({subtitles.length})
              </h2>
              <span className="text-xs text-text-muted">Source: {fileName}</span>
            </div>

            <button
              onClick={handleSendToQueue}
              className="btn-neo px-5 py-2.5 text-xs flex items-center gap-2"
            >
              <ListPlus className="w-4 h-4" /> Send All Blocks to Queue
            </button>
          </div>

          <div className="border border-border rounded-input overflow-hidden divide-y divide-border">
            <div className="bg-bg-secondary px-4 py-2.5 text-xs font-bold text-text-secondary flex justify-between">
              <span className="w-16">Block #</span>
              <span className="w-36">Duration</span>
              <span className="flex-1">Narration Text</span>
            </div>
            {subtitles.map((item) => (
              <div key={item.id} className="px-4 py-3 text-xs flex items-center justify-between">
                <span className="w-16 font-mono font-bold text-text-primary">#{item.id}</span>
                <span className="w-36 font-mono text-text-muted">
                  {item.start_time}s → {item.end_time}s ({item.duration}s)
                </span>
                <span className="flex-1 font-medium text-text-primary">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
