import React, { useState } from 'react';
import { useStudioStore } from '@/store/useStudioStore';
import { Download, X, Music, CheckCircle2, Loader2 } from 'lucide-react';

const FORMATS = ['wav', 'mp3', 'flac', 'ogg'] as const;
const QUALITIES = ['Draft', 'Standard', 'Studio', 'Lossless'] as const;

export const ExportModal: React.FC = () => {
  const { showExportModal, setShowExportModal, currentAudioUrl, currentAudioMeta, showToast } = useStudioStore();
  const [format, setFormat] = useState<typeof FORMATS[number]>('mp3');
  const [quality, setQuality] = useState<typeof QUALITIES[number]>('Studio');
  const [customName, setCustomName] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportedUrl, setExportedUrl] = useState<string | null>(null);

  if (!showExportModal) return null;

  const audioFilename = currentAudioUrl?.split('/').pop() || '';

  const handleExport = async () => {
    if (!audioFilename) return;
    setIsExporting(true);
    setExportedUrl(null);
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: audioFilename,
          format,
          quality,
          custom_name: customName || audioFilename.replace('.wav', ''),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setExportedUrl(data.download_url);
        showToast(`Exported as ${data.format.toUpperCase()} · ${(data.file_size / 1024).toFixed(0)} KB`, 'success');
      } else {
        showToast('Export failed — ffmpeg may not be installed. WAV download available.', 'error');
        setExportedUrl(currentAudioUrl);
      }
    } catch {
      showToast('Export error', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const qualityDesc = {
    Draft: '128 kbps · Smallest file',
    Standard: '192 kbps · Good quality',
    Studio: '320 kbps · Professional',
    Lossless: '320 kbps / FLAC lossless',
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setShowExportModal(false)}>
      <div
        className="bg-surface border-2 border-text-primary shadow-neo-lg rounded-dialog w-[480px] p-7"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-accent" />
            <h2 className="font-bold text-lg text-text-primary">Export Audio</h2>
          </div>
          <button onClick={() => setShowExportModal(false)} className="text-text-muted hover:text-text-primary">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Source info */}
        {currentAudioMeta && (
          <div className="p-3.5 bg-bg-secondary rounded-input border border-border mb-5 text-xs text-text-secondary space-y-1">
            <div className="flex justify-between">
              <span>Voice</span>
              <strong className="text-text-primary">{currentAudioMeta.voice}</strong>
            </div>
            <div className="flex justify-between">
              <span>Duration</span>
              <strong className="text-text-primary">{currentAudioMeta.duration}s</strong>
            </div>
            <div className="flex justify-between">
              <span>Sample Rate</span>
              <strong className="text-text-primary font-mono">{currentAudioMeta.sample_rate} Hz</strong>
            </div>
          </div>
        )}

        {/* Format Selection */}
        <div className="mb-4">
          <label className="text-xs font-bold text-text-secondary uppercase tracking-wider block mb-2">Output Format</label>
          <div className="grid grid-cols-4 gap-2">
            {FORMATS.map(f => (
              <button key={f}
                onClick={() => setFormat(f)}
                className={`py-2 text-sm font-bold rounded-button border-2 transition-all uppercase ${format === f ? 'bg-accent text-white border-text-primary shadow-neo-sm' : 'bg-surface text-text-secondary border-border hover:border-text-primary'}`}>
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Quality Selection */}
        {format !== 'wav' && (
          <div className="mb-4">
            <label className="text-xs font-bold text-text-secondary uppercase tracking-wider block mb-2">Quality Preset</label>
            <div className="space-y-2">
              {QUALITIES.map(q => (
                <button key={q} onClick={() => setQuality(q)}
                  className={`w-full px-4 py-2.5 text-left rounded-input border-2 transition-all flex items-center justify-between ${quality === q ? 'border-text-primary shadow-neo-sm bg-surface' : 'border-border hover:border-accent/40'}`}>
                  <span className="text-sm font-bold text-text-primary">{q}</span>
                  <span className="text-xs text-text-muted">{qualityDesc[q]}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Custom filename */}
        <div className="mb-6">
          <label className="text-xs font-bold text-text-secondary uppercase tracking-wider block mb-2">Filename (optional)</label>
          <input type="text" value={customName} onChange={e => setCustomName(e.target.value)}
            placeholder={`narration_${Date.now()}`}
            className="w-full px-3 py-2 bg-bg-secondary rounded-input border border-border text-sm text-text-primary focus:outline-none focus:border-accent font-mono" />
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button onClick={() => setShowExportModal(false)}
            className="btn-neo-secondary flex-1 py-2.5 text-sm">Cancel</button>
          <button onClick={handleExport} disabled={isExporting || !audioFilename}
            className="btn-neo flex-1 py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {isExporting
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Converting…</>
              : <><Download className="w-4 h-4" /> Export {format.toUpperCase()}</>}
          </button>
        </div>

        {/* Download link after export */}
        {exportedUrl && !isExporting && (
          <a href={exportedUrl} download
            className="mt-4 w-full py-2.5 text-sm font-bold text-success border-2 border-success rounded-button flex items-center justify-center gap-2 hover:bg-success/10 transition-all">
            <CheckCircle2 className="w-4 h-4" /> Click to Save File
          </a>
        )}
      </div>
    </div>
  );
};
