import React, { useState, useRef, useEffect } from 'react';
import { useStudioStore } from '@/store/useStudioStore';
import {
  Scissors, Upload, Play, Pause, Download, Trash2,
  Plus, Clock, ArrowUp, ArrowDown, Film, CheckCircle2,
  Sparkles, RefreshCw, FileVideo, Layers, Video, Smartphone, Monitor, Square,
  Zap, Archive, Eye, RotateCcw, X, FileText, ShieldAlert, Sliders, ChevronDown, ChevronUp
} from 'lucide-react';

interface ClipSegment {
  id: string;
  index: number;
  rawInput: string;
  startSec: number;
  endSec: number;
  duration: number;
  formattedStart: string;
  formattedEnd: string;
  formattedDuration: string;
}

interface TrimmedResult {
  clip_number: number;
  filename: string;
  path?: string;
  download_url?: string;
  start_sec: number;
  end_sec: number;
  duration: number;
  status: string;
  error?: string;
}

type PreviewFrameMode = 'mobile' | 'desktop' | 'square';
type ExportQualityMode = 'original' | '1080p' | '2k' | '4k';
type AspectFitMode = 'original' | 'mobile_9_16' | 'square_1_1';

export const VideoTrimmerView: React.FC = () => {
  const { showToast } = useStudioStore();

  // Video State
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [backendVideoPath, setBackendVideoPath] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Dedicated Clip Preview State
  const [activePreviewClip, setActivePreviewClip] = useState<{
    title: string;
    startSec?: number;
    endSec?: number;
    clipUrl?: string;
  } | null>(null);

  // Preview Frame & Export Quality State
  const [previewFrame, setPreviewFrame] = useState<PreviewFrameMode>('mobile');
  const [exportQuality, setExportQuality] = useState<ExportQualityMode>('original');
  const [aspectFit, setAspectFit] = useState<AspectFitMode>('mobile_9_16');

  // Marker State
  const [markerStart, setMarkerStart] = useState<number | null>(null);

  // Persistent Text Timeline Input State (Loaded from localStorage)
  const [rawText, setRawText] = useState<string>(() => {
    return localStorage.getItem('provoice_trimmer_raw_text') || '0:0:1:45-0:0:2:45\n0:1:1:45-0:1:2:45';
  });
  const [segments, setSegments] = useState<ClipSegment[]>([]);

  // Persistent Results State (Loaded from localStorage)
  const [trimmedResults, setTrimmedResults] = useState<TrimmedResult[]>(() => {
    const saved = localStorage.getItem('provoice_trimmer_results');
    return saved ? JSON.parse(saved) : [];
  });

  // Section Visibility / Dismiss State (on click crossed)
  const [showImportCard, setShowImportCard] = useState<boolean>(true);
  const [showTimelineEditor, setShowTimelineEditor] = useState<boolean>(true);
  const [showClipSequence, setShowClipSequence] = useState<boolean>(true);
  const [showResultsPanel, setShowResultsPanel] = useState<boolean>(true);

  // Processing State
  const [isTrimming, setIsTrimming] = useState<boolean>(false);
  const [isDetectingSpeech, setIsDetectingSpeech] = useState<boolean>(false);
  const [mergeAll, setMergeAll] = useState<boolean>(false);
  const [combinedUrl, setCombinedUrl] = useState<string | null>(null);
  const [zipDownloadUrl, setZipDownloadUrl] = useState<string | null>(null);
  const [isZipping, setIsZipping] = useState<boolean>(false);

  // Copyright Bypass State
  const [showBypassPanel, setShowBypassPanel] = useState<boolean>(false);
  const [bypassProfile, setBypassProfile] = useState<string>('light');
  const [isBypassing, setIsBypassing] = useState<boolean>(false);
  const [bypassResult, setBypassResult] = useState<{ filename: string; download_url: string } | null>(null);
  const [bypassAfterUrl, setBypassAfterUrl] = useState<string | null>(null);
  const [bypassSettings, setBypassSettings] = useState<Record<string, boolean | number>>({
    flip: false,
    zoom: 0,
    hue: 0,
    saturation: 1.0,
    brightness: 0,
    contrast: 1.0,
    rotation: 0,
    blur: 0,
    speed: 1.0,
    letterbox: false,
    color_grade: false,
    pitch_semitones: 0,
    bg_noise: false,
    eq_lowpass: false,
    normalize: false,
    stereo_remix: false,
    reverb: false,
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Save persistent state whenever changed
  useEffect(() => {
    localStorage.setItem('provoice_trimmer_raw_text', rawText);
  }, [rawText]);

  useEffect(() => {
    localStorage.setItem('provoice_trimmer_results', JSON.stringify(trimmedResults));
  }, [trimmedResults]);

  // Spacebar = toggle play/pause (only when video is loaded, skip if user is typing in input/textarea)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (!videoRef.current) return;
        if (videoRef.current.paused) {
          videoRef.current.play();
          setIsPlaying(true);
        } else {
          videoRef.current.pause();
          setIsPlaying(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Helper: Format seconds to HH:MM:SS.ms
  const formatTimecode = (sec: number): string => {
    if (isNaN(sec) || sec < 0) return '00:00:00.000';
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 1000);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };

  // Helper: Parse any timestamp string into seconds (H:M:S:MS, HH:MM:SS.ms, MM:SS, SS)
  const parseTimestamp = (str: string): number => {
    const clean = str ? str.trim().replace(',', '.') : '';
    if (!clean) return 0;

    const parts = clean.split(':');
    try {
      if (parts.length === 4) {
        const h = parseFloat(parts[0]) || 0;
        const m = parseFloat(parts[1]) || 0;
        const s = parseFloat(parts[2]) || 0;
        const msPart = parseFloat(parts[3]) || 0;
        const ms = parts[3].length <= 2 ? msPart / 100 : msPart / 1000;
        return h * 3600 + m * 60 + s + ms;
      } else if (parts.length === 3) {
        const h = parseFloat(parts[0]) || 0;
        const m = parseFloat(parts[1]) || 0;
        const s = parseFloat(parts[2]) || 0;
        return h * 3600 + m * 60 + s;
      } else if (parts.length === 2) {
        const m = parseFloat(parts[0]) || 0;
        const s = parseFloat(parts[1]) || 0;
        return m * 60 + s;
      } else if (parts.length === 1) {
        return parseFloat(parts[0]) || 0;
      }
    } catch {
      return 0;
    }
    return 0;
  };

  // Helper: Format seconds back to 0:0:1:45 style
  const formatShortTimecode = (sec: number): string => {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = Math.floor(sec % 60);
    const cs = Math.floor((sec % 1) * 100);
    return `${hrs}:${mins}:${secs}:${cs.toString().padStart(2, '0')}`;
  };

  // Auto-parse multi-line rawText whenever it changes
  useEffect(() => {
    const lines = rawText.split('\n');
    const parsed: ClipSegment[] = [];
    let clipIndex = 1;

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) return;

      let parts: string[] = [];
      if (trimmed.includes('->')) {
        parts = trimmed.split('->');
      } else if (trimmed.includes('to')) {
        parts = trimmed.split('to');
      } else if (trimmed.includes('-')) {
        const dashIdx = trimmed.indexOf('-');
        if (dashIdx > 0) {
          parts = [trimmed.slice(0, dashIdx), trimmed.slice(dashIdx + 1)];
        }
      }

      if (parts.length >= 2) {
        const startSec = parseTimestamp(parts[0]);
        const endSec = parseTimestamp(parts[1]);
        const dur = Math.max(0, endSec - startSec);

        parsed.push({
          id: `clip_${clipIndex}_${Date.now()}`,
          index: clipIndex,
          rawInput: trimmed,
          startSec,
          endSec,
          duration: dur,
          formattedStart: formatTimecode(startSec),
          formattedEnd: formatTimecode(endSec),
          formattedDuration: `${dur.toFixed(2)}s`,
        });
        clipIndex++;
      }
    });

    setSegments(parsed);
  }, [rawText]);

  // Upload Video File
  const uploadVideoFile = async (file: File) => {
    setVideoFile(file);
    const localBlobUrl = URL.createObjectURL(file);
    setVideoUrl(localBlobUrl);
    setActivePreviewClip(null);
    setIsUploading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      let res = await fetch('/api/video/upload', { method: 'POST', body: formData });
      if (!res.ok) res = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!res.ok) res = await fetch('/api/audio/upload', { method: 'POST', body: formData });

      if (res.ok) {
        const data = await res.json();
        const serverPath = data.video_path || data.video_url || data.audio_url;
        setBackendVideoPath(serverPath);
        if (data.duration) setVideoDuration(data.duration);
        showToast(`Video "${file.name}" imported successfully!`, 'success');
      } else {
        setBackendVideoPath(localBlobUrl);
        showToast('Video preview loaded', 'info');
      }
    } catch {
      setBackendVideoPath(localBlobUrl);
      showToast('Video preview loaded', 'info');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadVideoFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('video/')) {
      uploadVideoFile(file);
    } else if (file) {
      showToast('Please drop a valid video file (.mp4, .mkv, .mov, etc.)', 'error');
    }
  };

  // Video playback listeners
  const handleTimeUpdate = () => {
    if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setVideoDuration(videoRef.current.duration);
      // Auto-play when a new video is imported
      videoRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(() => {
        // Browser may block autoplay, that's fine
        setIsPlaying(false);
      });
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const changePlaybackRate = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) videoRef.current.playbackRate = rate;
  };

  // Interactive Markers
  const handleSetStart = () => {
    setMarkerStart(currentTime);
    showToast(`Start marker set at ${formatShortTimecode(currentTime)}`, 'info');
  };

  const handleSetEnd = () => {
    if (markerStart === null) {
      showToast('Please set a Start Marker first!', 'info');
      return;
    }
    if (currentTime <= markerStart) {
      showToast('End marker must be greater than Start marker!', 'error');
      return;
    }

    const startStr = formatShortTimecode(markerStart);
    const endStr = formatShortTimecode(currentTime);
    const newLine = `${startStr}-${endStr}`;

    setRawText((prev) => (prev ? `${prev}\n${newLine}` : newLine));
    setMarkerStart(null);
    showToast(`Added Clip range ${newLine}`, 'success');
  };

  // Auto-Detect Speech & Generate Timelines
  const handleDetectSpeech = async () => {
    if (!backendVideoPath && !videoUrl) {
      showToast('Please import a video file first!', 'info');
      return;
    }
    setIsDetectingSpeech(true);

    try {
      const res = await fetch('/api/video/detect-silence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_path: backendVideoPath || videoUrl }),
      });

      if (res.ok) {
        const data = await res.json();
        const speechSegs: Array<{ start_sec: number; end_sec: number }> = data.segments || [];
        if (speechSegs.length === 0) {
          showToast('No clear speech intervals detected', 'info');
        } else {
          const textLines = speechSegs
            .map((s) => `${formatShortTimecode(s.start_sec)}-${formatShortTimecode(s.end_sec)}`)
            .join('\n');
          setRawText(textLines);
          showToast(`Auto-detected ${speechSegs.length} speech clip timeline(s)!`, 'success');
        }
      } else {
        showToast('Speech detection failed', 'error');
      }
    } catch {
      showToast('Backend offline — start the server first', 'error');
    } finally {
      setIsDetectingSpeech(false);
    }
  };

  // Seek & Preview Segment
  const previewSegment = (seg: ClipSegment) => {
    setActivePreviewClip({
      title: `Clip #${seg.index} (${formatShortTimecode(seg.startSec)} → ${formatShortTimecode(seg.endSec)})`,
      startSec: seg.startSec,
      endSec: seg.endSec,
    });

    if (videoRef.current) {
      videoRef.current.currentTime = seg.startSec;
      videoRef.current.play();
      setIsPlaying(true);

      const checkPause = setInterval(() => {
        if (videoRef.current && videoRef.current.currentTime >= seg.endSec) {
          videoRef.current.pause();
          setIsPlaying(false);
          clearInterval(checkPause);
        }
      }, 100);
    }
  };

  // Preview generated output clip
  const previewOutputClip = (clip: TrimmedResult) => {
    if (!clip.download_url) return;
    setActivePreviewClip({
      title: `Trimmed Output: Clip #${clip.clip_number} (${clip.filename})`,
      clipUrl: clip.download_url,
    });
  };

  const resetToFullVideo = () => {
    setActivePreviewClip(null);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  // Reorder / Delete Segments
  const moveSegment = (idx: number, direction: 'up' | 'down') => {
    const lines = rawText.split('\n').filter((l) => l.trim());
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= lines.length) return;

    const temp = lines[idx];
    lines[idx] = lines[targetIdx];
    lines[targetIdx] = temp;

    setRawText(lines.join('\n'));
  };

  const deleteSegment = (idx: number) => {
    const lines = rawText.split('\n').filter((l) => l.trim());
    lines.splice(idx, 1);
    setRawText(lines.join('\n'));
    showToast('Clip range removed', 'info');
  };

  const removeResultClip = (clipNum: number) => {
    setTrimmedResults((prev) => prev.filter((c) => c.clip_number !== clipNum));
    showToast(`Clip #${clipNum} removed from results`, 'info');
  };

  // Execute FFmpeg Batch Trimming
  const handleStartTrimming = async () => {
    if (segments.length === 0) {
      showToast('Please enter or paste timestamp ranges to trim!', 'info');
      return;
    }

    const activeVideoPath = backendVideoPath || videoUrl || 'upload';

    setIsTrimming(true);
    setCombinedUrl(null);
    setZipDownloadUrl(null);

    const rangesPayload = segments.map((seg) => ({
      clip_number: seg.index,
      start_sec: seg.startSec,
      end_sec: seg.endSec,
    }));

    const reqBody = JSON.stringify({
      video_path: activeVideoPath,
      ranges: rangesPayload,
      merge_all: mergeAll,
      export_quality: exportQuality,
      aspect_fit: aspectFit,
    });

    try {
      let res = await fetch('/api/video/trim-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: reqBody,
      });

      if (!res.ok) {
        res = await fetch('/api/trim-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: reqBody,
        });
      }

      if (res.ok) {
        const data = await res.json();
        setTrimmedResults(data.clips || []);
        setShowResultsPanel(true);
        if (data.combined_url) setCombinedUrl(data.combined_url);
        showToast(`Successfully trimmed ${data.total_clips} clip(s)!`, 'success');
      } else {
        const err = await res.json();
        showToast(`Batch trimming failed: ${err.detail || 'Error'}`, 'error');
      }
    } catch {
      showToast('Backend offline — start the server first', 'error');
    } finally {
      setIsTrimming(false);
    }
  };

  // Export ZIP Archive of All Clips
  const handleExportZip = async () => {
    if (trimmedResults.length === 0) return;
    setIsZipping(true);

    const filenames = trimmedResults.map((c) => c.filename).filter(Boolean);

    try {
      const res = await fetch('/api/video/export-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filenames }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.download_url) {
          setZipDownloadUrl(data.download_url);
          const a = document.createElement('a');
          a.href = data.download_url;
          a.download = data.filename || 'Trimmed_Clips.zip';
          a.click();
          showToast('ZIP Archive created and downloaded!', 'success');
        }
      } else {
        showToast('ZIP packaging failed', 'error');
      }
    } catch {
      showToast('Backend offline — cannot create ZIP', 'error');
    } finally {
      setIsZipping(false);
    }
  };

  // Current video source URL
  const currentVideoSrc = activePreviewClip?.clipUrl || videoUrl;

  return (
    <div className="p-8 space-y-6 max-w-[1600px] mx-auto select-none">
      {/* Clean Header & View Restore Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary flex items-center gap-2">
            <Scissors className="w-6 h-6 text-accent" /> Batch Video Trimmer & Timeline Splitter
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Separate video import, device preview frames, persistent text timeline editor & output clips.
          </p>
        </div>

        {/* Restore Section Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          {!showImportCard && (
            <button
              onClick={() => setShowImportCard(true)}
              className="px-2.5 py-1 rounded bg-surface border border-border text-xs font-bold text-accent hover:bg-accent/10 flex items-center gap-1"
            >
              <Upload className="w-3.5 h-3.5" /> Show Video Import
            </button>
          )}
          {!showTimelineEditor && (
            <button
              onClick={() => setShowTimelineEditor(true)}
              className="px-2.5 py-1 rounded bg-surface border border-border text-xs font-bold text-accent hover:bg-accent/10 flex items-center gap-1"
            >
              <FileText className="w-3.5 h-3.5" /> Show Timelines Editor
            </button>
          )}
          {!showClipSequence && (
            <button
              onClick={() => setShowClipSequence(true)}
              className="px-2.5 py-1 rounded bg-surface border border-border text-xs font-bold text-accent hover:bg-accent/10 flex items-center gap-1"
            >
              <Film className="w-3.5 h-3.5" /> Show Clip Sequence
            </button>
          )}
          {!showResultsPanel && trimmedResults.length > 0 && (
            <button
              onClick={() => setShowResultsPanel(true)}
              className="px-2.5 py-1 rounded bg-surface border border-border text-xs font-bold text-success hover:bg-success/10 flex items-center gap-1"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Show Trimmed Results ({trimmedResults.length})
            </button>
          )}

          <button
            onClick={handleDetectSpeech}
            disabled={isDetectingSpeech || (!backendVideoPath && !videoUrl)}
            className="px-3.5 py-2 rounded-badge text-xs font-bold bg-accent/10 border border-accent/30 text-accent hover:bg-accent hover:text-white transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            {isDetectingSpeech ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Zap className="w-3.5 h-3.5" />
            )}
            Auto-Detect Speech
          </button>
        </div>
      </div>

      {/* ─── SECTION 1: SEPARATE DEDICATED VIDEO IMPORT CARD ─── */}
      {showImportCard && (
        <div className="card-neo p-5 space-y-3 relative">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider flex items-center gap-2">
              <Upload className="w-4 h-4 text-accent" /> 1. Video Import Section
            </h2>

            <button
              onClick={() => setShowImportCard(false)}
              className="p-1 rounded-md text-text-muted hover:text-danger hover:bg-surface-hover transition-all"
              title="Close/Hide Import Section"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`flex-1 w-full p-4 rounded-xl border-2 border-dashed flex items-center justify-between gap-4 transition-all ${
                isDragging ? 'border-accent bg-accent/10' : 'border-text-primary/30 bg-surface'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/20 border border-accent flex items-center justify-center text-accent shrink-0">
                  <Video className="w-5 h-5" />
                </div>
                <div className="truncate">
                  <h4 className="text-xs font-bold text-text-primary truncate">
                    {videoFile ? videoFile.name : (videoUrl ? 'Video File Imported' : 'Drag & Drop Video File')}
                  </h4>
                  <p className="text-[11px] text-text-muted">
                    {videoFile ? `${(videoFile.size / (1024 * 1024)).toFixed(1)} MB` : 'Supports MP4, MKV, MOV, WEBM'}
                  </p>
                </div>
              </div>

              <label className="px-4 py-2 text-xs font-bold text-white bg-accent hover:bg-accent-hover rounded-card border border-text-primary cursor-pointer shrink-0 shadow-neo-sm hover:scale-105 transition-all">
                {videoUrl ? 'Change Video' : 'Browse Video'}
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column — SECTION 2: SEPARATE DEDICATED PREVIEW DEVICES CARD (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="card-neo p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider flex items-center gap-2">
                <FileVideo className="w-4 h-4 text-accent" /> 2. Interactive Preview Device
              </h2>

              {/* Preview Frame Mode Switcher */}
              <div className="flex items-center gap-1 bg-surface p-1 rounded-lg border border-border text-[11px]">
                <button
                  onClick={() => setPreviewFrame('mobile')}
                  className={`px-2.5 py-1 rounded flex items-center gap-1 transition-all ${
                    previewFrame === 'mobile' ? 'bg-accent text-white font-bold shadow-sm' : 'text-text-secondary hover:text-text-primary'
                  }`}
                  title="📱 Mobile 9:16 Vertical View"
                >
                  <Smartphone className="w-3.5 h-3.5" /> Mobile 9:16
                </button>
                <button
                  onClick={() => setPreviewFrame('desktop')}
                  className={`px-2.5 py-1 rounded flex items-center gap-1 transition-all ${
                    previewFrame === 'desktop' ? 'bg-accent text-white font-bold shadow-sm' : 'text-text-secondary hover:text-text-primary'
                  }`}
                  title="🖥️ Desktop 16:9 View"
                >
                  <Monitor className="w-3.5 h-3.5" /> 16:9 Desktop
                </button>
                <button
                  onClick={() => setPreviewFrame('square')}
                  className={`px-2.5 py-1 rounded flex items-center gap-1 transition-all ${
                    previewFrame === 'square' ? 'bg-accent text-white font-bold shadow-sm' : 'text-text-secondary hover:text-text-primary'
                  }`}
                  title="🔳 Square 1:1 View"
                >
                  <Square className="w-3.5 h-3.5" /> 1:1 Square
                </button>
              </div>
            </div>

            {/* Active Clip Preview Banner */}
            {activePreviewClip && (
              <div className="p-2.5 bg-accent/10 border border-accent/30 rounded-lg flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 truncate font-semibold text-accent">
                  <Eye className="w-4 h-4 shrink-0" />
                  <span className="truncate">Previewing: {activePreviewClip.title}</span>
                </div>
                <button
                  onClick={resetToFullVideo}
                  className="px-2 py-1 rounded bg-surface border border-border text-[11px] font-bold text-text-primary hover:text-accent shrink-0 flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" /> Full Video
                </button>
              </div>
            )}

            {/* Persistent Single Video Frame Container */}
            <div className="relative bg-neutral-950 rounded-xl overflow-hidden border-2 border-text-primary/40 transition-all flex items-center justify-center min-h-[460px]">
              {currentVideoSrc ? (
                <div className="w-full flex items-center justify-center p-4">
                  <div
                    className={`transition-all duration-300 ${
                      previewFrame === 'mobile'
                        ? 'relative w-[270px] h-[510px] bg-neutral-950 border-[10px] border-neutral-800 rounded-[44px] shadow-2xl overflow-hidden flex flex-col justify-between items-center group ring-2 ring-white/10'
                        : previewFrame === 'square'
                        ? 'relative w-[340px] h-[340px] bg-black rounded-lg overflow-hidden border-2 border-border shadow-lg'
                        : 'relative w-full aspect-video bg-black rounded-lg overflow-hidden border-2 border-border shadow-lg'
                    }`}
                  >
                    {previewFrame === 'mobile' && (
                      <>
                        <span className="absolute -left-[12px] top-24 w-1 h-10 bg-neutral-700 rounded-l" />
                        <span className="absolute -left-[12px] top-38 w-1 h-10 bg-neutral-700 rounded-l" />
                        <span className="absolute -right-[12px] top-28 w-1 h-12 bg-neutral-700 rounded-r" />

                        <div className="absolute top-2.5 z-30 w-28 h-4 bg-black rounded-full flex items-center justify-center gap-2.5 border border-white/10 shadow-sm">
                          <span className="w-2 h-2 rounded-full bg-neutral-800" />
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-900 animate-pulse" />
                        </div>
                      </>
                    )}

                    <div className="w-full h-full bg-black flex items-center justify-center overflow-hidden relative">
                      <video
                        ref={videoRef}
                        src={currentVideoSrc}
                        onTimeUpdate={handleTimeUpdate}
                        onLoadedMetadata={handleLoadedMetadata}
                        onEnded={() => setIsPlaying(false)}
                        className={`w-full h-full ${previewFrame === 'mobile' || previewFrame === 'square' ? 'object-cover' : 'object-contain'}`}
                      />
                    </div>

                    {previewFrame === 'mobile' && (
                      <>
                        <div className="absolute bottom-1.5 z-30 w-32 h-1 bg-white/40 rounded-full" />
                        <div className="absolute bottom-5 z-30 px-3 py-1 bg-black/75 backdrop-blur-md rounded-full border border-white/20 text-[10px] font-mono text-white flex items-center gap-1.5 shadow-lg">
                          <Smartphone className="w-3 h-3 text-accent" /> 9:16 Shorts View
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center p-8 space-y-4">
                  <Video className="w-12 h-12 text-neutral-500 mx-auto" />
                  <p className="text-xs text-neutral-400">Import a video above to display live preview</p>
                </div>
              )}
            </div>

            {/* Controls Bar */}
            {currentVideoSrc && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <input
                    type="range"
                    min={0}
                    max={videoDuration || 100}
                    step={0.01}
                    value={currentTime}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setCurrentTime(val);
                      if (videoRef.current) videoRef.current.currentTime = val;
                    }}
                    className="w-full h-1.5 bg-surface-hover rounded-lg appearance-none cursor-pointer accent-accent"
                  />
                  <div className="flex justify-between text-[11px] font-mono text-text-muted">
                    <span>{formatTimecode(currentTime)}</span>
                    <span>{formatTimecode(videoDuration)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    onClick={togglePlay}
                    className="p-2.5 rounded-lg bg-surface border-2 border-text-primary text-text-primary hover:text-accent hover:bg-surface-hover shadow-neo-sm transition-all"
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                  </button>

                  <div className="flex items-center gap-1 bg-surface p-1 rounded-lg border border-border text-[11px]">
                    {[0.5, 1.0, 1.5, 2.0].map((rate) => (
                      <button
                        key={rate}
                        onClick={() => changePlaybackRate(rate)}
                        className={`px-2 py-0.5 rounded font-mono transition-all ${
                          playbackRate === rate
                            ? 'bg-accent text-white font-bold shadow-sm'
                            : 'text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        {rate}x
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-3 bg-surface rounded-card border-2 border-text-primary space-y-2 shadow-neo-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleSetStart}
                      className="btn-neo-secondary py-2 text-xs flex items-center justify-center gap-1.5 font-semibold"
                    >
                      <Clock className="w-3.5 h-3.5 text-accent" /> Set Start Marker
                    </button>
                    <button
                      onClick={handleSetEnd}
                      className="px-4 py-2 text-xs font-bold rounded-card bg-accent text-white border-2 border-text-primary flex items-center justify-center gap-1.5 shadow-neo-sm hover:scale-105 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5 text-white" /> Set End & Add Clip
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column (Timelines Input, Clip Sequence & Output Results — 7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Export Quality Settings Panel */}
          <div className="card-neo p-5 space-y-3">
            <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider flex items-center gap-2 border-b border-border pb-2">
              <Zap className="w-4 h-4 text-accent" /> Aspect Fitting & Export Quality
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-primary">Mobile Aspect Fitting:</label>
                <select
                  value={aspectFit}
                  onChange={(e) => setAspectFit(e.target.value as AspectFitMode)}
                  className="w-full p-2.5 bg-surface rounded-input border-2 border-text-primary text-xs text-text-primary focus:outline-none focus:border-accent font-bold shadow-neo-sm"
                >
                  <option value="mobile_9_16">📱 9:16 Vertical Shorts Crop</option>
                  <option value="original">🖥️ Widescreen 16:9 Original</option>
                  <option value="square_1_1">🔳 Square 1:1 Feed Post</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-primary">Export Resolution:</label>
                <select
                  value={exportQuality}
                  onChange={(e) => setExportQuality(e.target.value as ExportQualityMode)}
                  className="w-full p-2.5 bg-surface rounded-input border-2 border-text-primary text-xs text-text-primary focus:outline-none focus:border-accent font-bold shadow-neo-sm"
                >
                  <option value="original">⚡ Original (Instant Stream Copy - 0 Sec)</option>
                  <option value="1080p">📺 1080p Full HD</option>
                  <option value="2k">🚀 2K QHD (2560x1440 60fps)</option>
                  <option value="4k">🌟 4K UHD (3840x2160 Ultra-Sharp)</option>
                </select>
              </div>
            </div>
          </div>

          {/* ─── PERSISTENT TIMELINE EDITOR CARD (WITH [X] DISMISS BUTTON) ─── */}
          {showTimelineEditor && (
            <div className="card-neo p-5 space-y-3 relative">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider flex items-center gap-2">
                  <Layers className="w-4 h-4 text-accent" /> Batch Timestamp Ranges (Persistent Text)
                </h2>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-muted font-mono font-bold">
                    {segments.length} clip(s) detected
                  </span>
                  <button
                    onClick={() => setShowTimelineEditor(false)}
                    className="p-1 rounded-md text-text-muted hover:text-danger hover:bg-surface-hover transition-all"
                    title="Dismiss Timeline Editor"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <textarea
                rows={4}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Paste timelines here:\n0:0:1:45-0:0:2:45\n0:1:1:45-0:1:2:45"
                className="w-full p-3 bg-surface rounded-input border-2 border-text-primary font-mono text-xs text-text-primary focus:outline-none focus:border-accent leading-relaxed shadow-neo-sm"
              />
            </div>
          )}

          {/* ─── PERSISTENT ORDERED CLIP SEQUENCE CARD (WITH [X] DISMISS BUTTON) ─── */}
          {showClipSequence && (
            <div className="card-neo p-5 space-y-4 relative">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider flex items-center gap-2">
                  <Film className="w-4 h-4 text-accent" /> Numbered Clip Sequence
                </h2>
                <div className="flex items-center gap-2">
                  {segments.length > 0 && (
                    <button
                      onClick={() => setRawText('')}
                      className="text-xs text-text-muted hover:text-danger flex items-center gap-1 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Clear All
                    </button>
                  )}
                  <button
                    onClick={() => setShowClipSequence(false)}
                    className="p-1 rounded-md text-text-muted hover:text-danger hover:bg-surface-hover transition-all"
                    title="Dismiss Clip Sequence"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {segments.length === 0 ? (
                <div className="text-center py-6 text-text-muted space-y-1">
                  <Scissors className="w-6 h-6 text-text-muted mx-auto opacity-50" />
                  <p className="text-xs font-semibold">No timestamp ranges entered yet.</p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                  {segments.map((seg, idx) => (
                    <div
                      key={seg.id}
                      className="p-3 bg-surface rounded-lg border-2 border-border flex items-center justify-between gap-3 hover:border-accent transition-all shadow-neo-sm group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-accent text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm">
                          #{seg.index}
                        </div>
                        <div className="truncate">
                          <div className="font-mono text-xs font-semibold text-text-primary flex items-center gap-2">
                            <span>{seg.formattedStart}</span>
                            <span className="text-text-muted">→</span>
                            <span>{seg.formattedEnd}</span>
                          </div>
                          <div className="text-[11px] text-text-muted mt-0.5">
                            Duration: <strong className="text-text-primary font-mono">{seg.formattedDuration}</strong>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => previewSegment(seg)}
                          className="px-2.5 py-1.5 rounded-md bg-accent/10 border border-accent/30 text-xs font-bold text-accent hover:bg-accent hover:text-white flex items-center gap-1 transition-all"
                        >
                          <Play className="w-3 h-3 fill-current" /> Preview Clip
                        </button>
                        <button
                          onClick={() => moveSegment(idx, 'up')}
                          disabled={idx === 0}
                          className="p-1 rounded bg-surface border border-border text-text-muted hover:text-text-primary disabled:opacity-30"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => moveSegment(idx, 'down')}
                          disabled={idx === segments.length - 1}
                          className="p-1 rounded bg-surface border border-border text-text-muted hover:text-text-primary disabled:opacity-30"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deleteSegment(idx)}
                          className="p-1 rounded bg-surface border border-border text-text-muted hover:text-danger hover:border-danger/40 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* VIBRANT ACCENT BLUE START TRIMMING BUTTON */}
              <div className="pt-3 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-text-secondary select-none">
                  <input
                    type="checkbox"
                    checked={mergeAll}
                    onChange={(e) => setMergeAll(e.target.checked)}
                    className="rounded border-border text-accent focus:ring-accent"
                  />
                  <span>Merge all clips into 1 reel</span>
                </label>

                <button
                  onClick={handleStartTrimming}
                  className="w-full sm:w-auto px-7 py-3 text-xs font-bold text-white rounded-card bg-accent hover:bg-accent-hover border-2 border-text-primary shadow-neo-md hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2.5 cursor-pointer"
                >
                  {isTrimming ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-white" /> Rendering ({exportQuality.toUpperCase()})...
                    </>
                  ) : (
                    <>
                      <Scissors className="w-4 h-4 text-white" /> Start Trimming ({segments.length} Clips)
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ─── PERSISTENT GENERATED RESULTS PANEL (WITH [X] DISMISS & INDIVIDUAL CLIP CROSSED) ─── */}
          {showResultsPanel && trimmedResults.length > 0 && (
            <div className="card-neo p-5 space-y-4 bg-accent/5 border-accent/30 relative">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
                <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-success" /> Persistent Output Results ({trimmedResults.length})
                </h2>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportZip}
                    disabled={isZipping}
                    className="px-4 py-2 text-xs font-bold text-white bg-accent border-2 border-text-primary rounded-card shadow-neo-sm hover:scale-105 transition-all flex items-center gap-1.5"
                  >
                    {isZipping ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />}
                    Download ZIP
                  </button>

                  {combinedUrl && (
                    <a
                      href={combinedUrl}
                      download
                      className="btn-neo-secondary px-3.5 py-1.5 text-xs flex items-center gap-1.5 text-accent font-bold"
                    >
                      <Download className="w-3.5 h-3.5" /> Download Reel
                    </a>
                  )}

                  <button
                    onClick={() => setShowResultsPanel(false)}
                    className="p-1 rounded-md text-text-muted hover:text-danger hover:bg-surface-hover transition-all"
                    title="Dismiss Results Panel"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto">
                {trimmedResults.map((clip) => (
                  <div
                    key={clip.clip_number}
                    className="p-3 bg-surface rounded-lg border-2 border-border space-y-2 shadow-neo-sm relative group"
                  >
                    <button
                      onClick={() => removeResultClip(clip.clip_number)}
                      className="absolute top-2 right-2 p-1 text-text-muted hover:text-danger rounded transition-all"
                      title="Remove Clip from Results"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>

                    <div className="flex items-center justify-between pr-5">
                      <span className="font-bold text-xs text-accent">
                        Clip #{clip.clip_number}
                      </span>
                      <span className="text-[11px] font-mono text-text-muted">
                        {clip.duration}s
                      </span>
                    </div>

                    <p className="text-[11px] font-mono text-text-secondary truncate">
                      {clip.filename}
                    </p>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => previewOutputClip(clip)}
                        className="btn-neo-secondary flex-1 py-1.5 text-[11px] font-bold flex items-center justify-center gap-1 hover:text-accent"
                      >
                        <Play className="w-3 h-3 fill-current text-accent" /> Play Clip
                      </button>
                      {clip.download_url && (
                        <a
                          href={clip.download_url}
                          download
                          className="bg-accent text-white flex-1 py-1.5 text-[11px] font-bold rounded border border-text-primary flex items-center justify-center gap-1 shadow-sm hover:opacity-90"
                        >
                          <Download className="w-3 h-3" /> Download
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── COPYRIGHT BYPASS SECTION ─── */}
      <div className="card-neo p-5 space-y-5 border-2 border-accent/30 bg-accent/5">
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setShowBypassPanel(!showBypassPanel)}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
              <ShieldAlert className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
                Copyright Bypass Engine
                <span className="px-2 py-0.5 text-[10px] font-bold bg-accent text-white rounded-full">18 Transforms</span>
              </h2>
              <p className="text-[11px] text-text-muted">Visual + Audio FFmpeg transformations to defeat fingerprinting algorithms</p>
            </div>
          </div>
          <button className="p-1.5 rounded-lg bg-surface border border-border text-text-muted hover:text-accent transition-all">
            {showBypassPanel ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {showBypassPanel && (
          <div className="space-y-5 pt-2">
            {/* Preset Profile Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-accent" /> One-Click Preset Profiles
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'light', label: '🔵 Light (Subtle)', desc: 'Flip + Hue + Pitch ±2st' },
                  { id: 'medium', label: '🟡 Medium', desc: 'Zoom + Color grade + Pitch ±3st' },
                  { id: 'heavy', label: '🔴 Heavy (Max)', desc: 'Flip + Zoom + Blur + Pitch ±5st + Noise' },
                  { id: 'cinematic', label: '🎨 Cinematic', desc: 'LUT + Letterbox + Reverb' },
                ].map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setBypassProfile(p.id)}
                    className={`p-3 rounded-lg border-2 text-left transition-all space-y-1 ${
                      bypassProfile === p.id
                        ? 'border-accent bg-accent/10'
                        : 'border-border bg-surface hover:border-accent/50'
                    }`}
                  >
                    <div className="text-xs font-bold text-text-primary">{p.label}</div>
                    <div className="text-[10px] text-text-muted">{p.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Individual Toggles Grid */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-accent" /> Visual Transformations
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {[
                  { key: 'flip', label: 'Horizontal Flip', type: 'bool' },
                  { key: 'zoom', label: 'Zoom 1.03x', type: 'num', val: 1.03, off: 0 },
                  { key: 'hue', label: 'Hue Shift +15°', type: 'num', val: 15, off: 0 },
                  { key: 'saturation', label: 'Saturation +15%', type: 'num', val: 1.15, off: 1.0 },
                  { key: 'brightness', label: 'Brightness +5%', type: 'num', val: 0.05, off: 0 },
                  { key: 'contrast', label: 'Contrast +5%', type: 'num', val: 1.05, off: 1.0 },
                  { key: 'rotation', label: 'Rotation 0.8°', type: 'num', val: 0.8, off: 0 },
                  { key: 'blur', label: 'Blur 0.3px', type: 'num', val: 0.3, off: 0 },
                  { key: 'letterbox', label: 'Letterbox', type: 'bool' },
                  { key: 'color_grade', label: 'Color Grade (LUT)', type: 'bool' },
                ].map((item) => {
                  const isOn = item.type === 'bool'
                    ? !!bypassSettings[item.key]
                    : bypassSettings[item.key] !== (item as any).off;
                  return (
                    <button
                      key={item.key}
                      onClick={() => setBypassSettings((prev) => ({
                        ...prev,
                        [item.key]: isOn
                          ? (item.type === 'bool' ? false : (item as any).off)
                          : (item.type === 'bool' ? true : (item as any).val),
                      }))}
                      className={`p-2.5 rounded-lg border-2 text-xs font-semibold text-left transition-all ${
                        isOn ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-surface text-text-muted hover:border-accent/40'
                      }`}
                    >
                      <span className="block text-base mb-0.5">{isOn ? '✅' : '⬜'}</span>
                      {item.label}
                    </button>
                  );
                })}
              </div>

              <label className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-1.5 pt-1">
                <Zap className="w-3.5 h-3.5 text-accent" /> Audio Transformations
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {[
                  { key: 'pitch_semitones', label: 'Pitch Shift +3st', type: 'num', val: 3, off: 0 },
                  { key: 'speed', label: 'Speed +3%', type: 'num', val: 1.03, off: 1.0 },
                  { key: 'bg_noise', label: 'BG Noise Layer', type: 'bool' },
                  { key: 'eq_lowpass', label: 'EQ / Low-pass', type: 'bool' },
                  { key: 'normalize', label: 'Vol. Normalize', type: 'bool' },
                  { key: 'stereo_remix', label: 'Stereo Remix', type: 'bool' },
                  { key: 'reverb', label: 'Subtle Reverb', type: 'bool' },
                ].map((item) => {
                  const isOn = item.type === 'bool'
                ].map((item) => {
                  const isOn = item.type === 'bool'
                    ? !!bypassSettings[item.key]
                    : bypassSettings[item.key] !== (item as any).off;
                  return (
                    <button
                      key={item.key}
                      onClick={() => setBypassSettings((prev) => ({
                        ...prev,
                        [item.key]: isOn
                          ? (item.type === 'bool' ? false : (item as any).off)
                          : (item.type === 'bool' ? true : (item as any).val),
                      }))}
                      className={`p-2.5 rounded-lg border-2 text-xs font-semibold text-left transition-all ${
                        isOn ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-surface text-text-muted hover:border-accent/40'
                      }`}
                    >
                      <span className="block text-base mb-0.5">{isOn ? '✅' : '⬜'}</span>
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Action Row */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 border-t border-border">
              <div className="text-xs text-text-muted flex items-start gap-2 max-w-sm">
                <ShieldAlert className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                <span>
                  Selected preset + checked transforms will be applied to your <strong className="text-text-primary">entire uploaded video</strong>.
                  The processed file can be downloaded and then trimmed using the timeline above.
                </span>
              </div>

              <button
                onClick={async () => {
                  setIsBypassing(true);
                  setBypassResult(null);
                  setBypassAfterUrl(null);
                  const payload: Record<string, unknown> = {
                    video_path: backendVideoPath || videoUrl || 'upload',
                    profile: bypassProfile,
                    settings: bypassSettings,
                    apply_mode: 'entire',
                  };
                  try {
                    let res = await fetch('/api/video/copyright-bypass', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(payload),
                    });
                    if (!res.ok && res.status === 404) {
                      res = await fetch('/api/copyright-bypass', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                      });
                    }
                    if (res.ok) {
                      const data = await res.json();
                      setBypassResult(data);
                      setBypassAfterUrl(data.download_url);
                      showToast(`Bypass complete! Profile: ${data.profile}`, 'success');
                    } else {
                      const err = await res.json();
                      showToast(`Bypass failed: ${err.detail || 'Error processing'}`, 'error');
                    }
                  } catch {
                    showToast('Backend offline — start the server first', 'error');
                  } finally {
                    setIsBypassing(false);
                  }
                }}
                className="px-7 py-3 text-xs font-bold text-white rounded-card bg-accent hover:bg-accent-hover border-2 border-text-primary shadow-neo-md hover:scale-105 active:scale-95 transition-all flex items-center gap-2.5"
              >
                {isBypassing ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> Applying Bypass...</>
                ) : (
                  <><ShieldAlert className="w-4 h-4" /> Apply Copyright Bypass</>
                )}
              </button>
            </div>

            {/* Before / After Preview */}
            {bypassAfterUrl && (
              <div className="space-y-3 pt-2 border-t border-border">
                <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-2">
                  <Eye className="w-4 h-4 text-accent" /> Before / After Preview
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* BEFORE */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">🎬 Before (Original)</span>
                    <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden border-2 border-border">
                      <video
                        src={videoUrl || ''}
                        className="w-full h-full object-contain"
                        controls
                        muted
                      />
                    </div>
                  </div>

                  {/* AFTER */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-accent uppercase tracking-wider">✅ After (Bypassed)</span>
                    <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden border-2 border-accent/50">
                      <video
                        src={bypassAfterUrl}
                        className="w-full h-full object-contain"
                        controls
                        autoPlay
                        muted
                      />
                    </div>
                    {bypassResult && (
                      <a
                        href={bypassResult.download_url}
                        download
                        className="btn-neo-primary w-full py-2 text-xs font-bold flex items-center justify-center gap-2 mt-1"
                      >
                        <Download className="w-3.5 h-3.5" /> Download Bypassed Video ({bypassResult.filename})
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
