import React, { useState, useRef, useEffect } from 'react';
import { useStudioStore } from '@/store/useStudioStore';
import {
  Scissors, Upload, Play, Pause, Volume2, Download, Trash2,
  Plus, Clock, ArrowUp, ArrowDown, Film, CheckCircle2, AlertCircle,
  Sparkles, RefreshCw, FileVideo, Layers, Video, Smartphone, Monitor, Square,
  Zap, Archive, Info, HelpCircle
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

  // Preview Frame & Export Quality State
  const [previewFrame, setPreviewFrame] = useState<PreviewFrameMode>('mobile');
  const [exportQuality, setExportQuality] = useState<ExportQualityMode>('2k');
  const [aspectFit, setAspectFit] = useState<AspectFitMode>('mobile_9_16');
  const [showHowItWorks, setShowHowItWorks] = useState<boolean>(true);

  // Marker State
  const [markerStart, setMarkerStart] = useState<number | null>(null);

  // Text Timeline Input State
  const [rawText, setRawText] = useState<string>(
    '0:0:1:45-0:0:2:45\n0:1:1:45-0:1:2:45'
  );
  const [segments, setSegments] = useState<ClipSegment[]>([]);

  // Processing & Results State
  const [isTrimming, setIsTrimming] = useState<boolean>(false);
  const [isDetectingSpeech, setIsDetectingSpeech] = useState<boolean>(false);
  const [mergeAll, setMergeAll] = useState<boolean>(false);
  const [trimmedResults, setTrimmedResults] = useState<TrimmedResult[]>([]);
  const [combinedUrl, setCombinedUrl] = useState<string | null>(null);
  const [zipDownloadUrl, setZipDownloadUrl] = useState<string | null>(null);
  const [isZipping, setIsZipping] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Helper: Format seconds to HH:MM:SS.ms
  const formatTimecode = (sec: number): string => {
    if (isNaN(sec) || sec < 0) return '00:00:00.000';
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 1000);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };

  // Helper: Parse timestamp string to seconds
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

  // Upload Video File (supports File input & Drag and Drop)
  const uploadVideoFile = async (file: File) => {
    setVideoFile(file);
    const localBlobUrl = URL.createObjectURL(file);
    setVideoUrl(localBlobUrl);
    setIsUploading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      let res = await fetch('/api/video/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
      }

      if (!res.ok) {
        res = await fetch('/api/audio/upload', {
          method: 'POST',
          body: formData,
        });
      }

      if (res.ok) {
        const data = await res.json();
        const serverPath = data.video_path || data.video_url || data.audio_url;
        setBackendVideoPath(serverPath);
        if (data.duration) setVideoDuration(data.duration);
        showToast(`Video "${file.name}" imported successfully!`, 'success');
      } else {
        setBackendVideoPath(localBlobUrl);
        showToast('Video preview loaded locally', 'info');
      }
    } catch {
      setBackendVideoPath(localBlobUrl);
      showToast('Video preview loaded locally', 'info');
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
    if (videoRef.current) setVideoDuration(videoRef.current.duration);
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
    if (!backendVideoPath) {
      showToast('Please upload a video file first!', 'info');
      return;
    }
    setIsDetectingSpeech(true);

    try {
      const res = await fetch('/api/video/detect-silence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_path: backendVideoPath }),
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

  // Execute FFmpeg Batch Trimming
  const handleStartTrimming = async () => {
    if (!backendVideoPath) {
      showToast('Please upload a video file first!', 'info');
      return;
    }
    if (segments.length === 0) {
      showToast('No valid timestamp ranges found to trim!', 'error');
      return;
    }

    setIsTrimming(true);
    setTrimmedResults([]);
    setCombinedUrl(null);
    setZipDownloadUrl(null);

    const rangesPayload = segments.map((seg) => ({
      clip_number: seg.index,
      start_sec: seg.startSec,
      end_sec: seg.endSec,
    }));

    try {
      const res = await fetch('/api/video/trim-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_path: backendVideoPath,
          ranges: rangesPayload,
          merge_all: mergeAll,
          export_quality: exportQuality,
          aspect_fit: aspectFit,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setTrimmedResults(data.clips || []);
        if (data.combined_url) setCombinedUrl(data.combined_url);
        showToast(`Successfully trimmed ${data.total_clips} clips in ${exportQuality.toUpperCase()} quality!`, 'success');
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

  return (
    <div className="p-8 space-y-6 max-w-[1600px] mx-auto select-none">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary flex items-center gap-2">
            <Scissors className="w-6 h-6 text-accent" /> Batch Video Trimmer & 2K/4K Splitter
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Import any video, paste or auto-detect timeline ranges, preview in <strong>📱 Mobile 9:16 Shorts Mode</strong>, and trim into numbered clips (#1, #2, #3...) with 2K/4K export!
          </p>
        </div>

        {/* Top Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowHowItWorks(!showHowItWorks)}
            className="px-3 py-2 rounded-badge text-xs font-semibold bg-surface border border-border text-text-secondary hover:text-text-primary transition-all flex items-center gap-1.5"
          >
            <HelpCircle className="w-3.5 h-3.5 text-accent" /> {showHowItWorks ? 'Hide Guide' : 'How It Works'}
          </button>
          <button
            onClick={handleDetectSpeech}
            disabled={isDetectingSpeech || !backendVideoPath}
            className="px-3.5 py-2 rounded-badge text-xs font-bold bg-accent/10 border border-accent/30 text-accent hover:bg-accent hover:text-white transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            {isDetectingSpeech ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Zap className="w-3.5 h-3.5" />
            )}
            Auto-Detect Speech Timelines
          </button>
          <button
            onClick={() => setRawText('0:0:1:45-0:0:2:45\n0:1:1:45-0:1:2:45\n0:2:10:00-0:2:30:00')}
            className="px-3.5 py-2 rounded-badge text-xs font-semibold bg-surface border border-border text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-all flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-accent" /> Demo Timelines
          </button>
        </div>
      </div>

      {/* How It Works Explanation Banner */}
      {showHowItWorks && (
        <div className="p-4 bg-surface rounded-card border-2 border-text-primary shadow-neo-sm grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div className="space-y-1">
            <span className="font-bold text-accent uppercase tracking-wider flex items-center gap-1.5">
              1. 📥 Import Video
            </span>
            <p className="text-text-secondary">Drag & drop or browse any MP4, MKV, MOV, WEBM video into the player.</p>
          </div>
          <div className="space-y-1">
            <span className="font-bold text-accent uppercase tracking-wider flex items-center gap-1.5">
              2. 📝 Paste Timelines
            </span>
            <p className="text-text-secondary">Paste ranges like <code className="font-mono text-accent">0:0:1:45-0:0:2:45</code> or click <em>Auto-Detect Speech</em>.</p>
          </div>
          <div className="space-y-1">
            <span className="font-bold text-accent uppercase tracking-wider flex items-center gap-1.5">
              3. 📱 Mobile 9:16 Preview
            </span>
            <p className="text-text-secondary">Preview each clip directly inside the realistic smartphone frame for Shorts/Reels.</p>
          </div>
          <div className="space-y-1">
            <span className="font-bold text-accent uppercase tracking-wider flex items-center gap-1.5">
              4. 🚀 2K/4K FFmpeg Trim
            </span>
            <p className="text-text-secondary">Generates numbered clips (#1, #2, #3...) + 1-click ZIP or merged reel export!</p>
          </div>
        </div>
      )}

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (Video Player & Realistic Smartphone Mockup Frame — 5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="card-neo p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider flex items-center gap-2">
                <FileVideo className="w-4 h-4 text-accent" /> Preview Frame Display
              </h2>

              {/* Preview Frame Mode Switcher */}
              <div className="flex items-center gap-1 bg-surface p-1 rounded-lg border border-border text-[11px]">
                <button
                  onClick={() => setPreviewFrame('mobile')}
                  className={`px-2.5 py-1 rounded flex items-center gap-1 transition-all ${
                    previewFrame === 'mobile' ? 'bg-accent text-white font-bold shadow-sm' : 'text-text-secondary hover:text-text-primary'
                  }`}
                  title="📱 Mobile 9:16 Vertical Smartphone View"
                >
                  <Smartphone className="w-3.5 h-3.5" /> Mobile 9:16
                </button>
                <button
                  onClick={() => setPreviewFrame('desktop')}
                  className={`px-2.5 py-1 rounded flex items-center gap-1 transition-all ${
                    previewFrame === 'desktop' ? 'bg-accent text-white font-bold shadow-sm' : 'text-text-secondary hover:text-text-primary'
                  }`}
                  title="🖥️ Desktop 16:9 Widescreen View"
                >
                  <Monitor className="w-3.5 h-3.5" /> 16:9 Desktop
                </button>
                <button
                  onClick={() => setPreviewFrame('square')}
                  className={`px-2.5 py-1 rounded flex items-center gap-1 transition-all ${
                    previewFrame === 'square' ? 'bg-accent text-white font-bold shadow-sm' : 'text-text-secondary hover:text-text-primary'
                  }`}
                  title="🔳 Square 1:1 Feed View"
                >
                  <Square className="w-3.5 h-3.5" /> 1:1 Square
                </button>
              </div>
            </div>

            {/* Drag & Drop Dropzone + Video Container */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`relative bg-black rounded-xl overflow-hidden border-2 transition-all flex items-center justify-center min-h-[460px] ${
                isDragging ? 'border-accent bg-accent/10' : 'border-border'
              }`}
            >
              {videoUrl ? (
                /* Dynamic Preview Frames */
                <div className="w-full flex items-center justify-center p-4">
                  {previewFrame === 'mobile' ? (
                    /* 📱 Realistic Smartphone Device Frame Mockup */
                    <div className="relative w-[270px] h-[510px] bg-neutral-950 border-[10px] border-neutral-800 rounded-[44px] shadow-2xl overflow-hidden flex flex-col justify-between items-center group ring-2 ring-white/10 relative">
                      {/* Left Side Buttons (Volume) */}
                      <span className="absolute -left-[12px] top-24 w-1 h-10 bg-neutral-700 rounded-l" />
                      <span className="absolute -left-[12px] top-38 w-1 h-10 bg-neutral-700 rounded-l" />
                      {/* Right Side Button (Power) */}
                      <span className="absolute -right-[12px] top-28 w-1 h-12 bg-neutral-700 rounded-r" />

                      {/* Top Dynamic Island / Notch */}
                      <div className="absolute top-2.5 z-30 w-28 h-4 bg-black rounded-full flex items-center justify-center gap-2.5 border border-white/10 shadow-sm">
                        <span className="w-2 h-2 rounded-full bg-neutral-800" />
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-900 animate-pulse" />
                      </div>

                      {/* Screen Video Viewport */}
                      <div className="w-full h-full bg-black flex items-center justify-center overflow-hidden relative">
                        <video
                          ref={videoRef}
                          src={videoUrl}
                          onTimeUpdate={handleTimeUpdate}
                          onLoadedMetadata={handleLoadedMetadata}
                          onEnded={() => setIsPlaying(false)}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      {/* Bottom Mobile Gesture Home Bar */}
                      <div className="absolute bottom-1.5 z-30 w-32 h-1 bg-white/40 rounded-full" />

                      {/* Mobile Overlay Badge */}
                      <div className="absolute bottom-5 z-30 px-3 py-1 bg-black/75 backdrop-blur-md rounded-full border border-white/20 text-[10px] font-mono text-white flex items-center gap-1.5 shadow-lg">
                        <Smartphone className="w-3 h-3 text-accent" /> 9:16 Shorts Preview
                      </div>
                    </div>
                  ) : previewFrame === 'square' ? (
                    /* 🔳 Square 1:1 Frame */
                    <div className="relative w-[340px] h-[340px] bg-black rounded-lg overflow-hidden border-2 border-border shadow-lg">
                      <video
                        ref={videoRef}
                        src={videoUrl}
                        onTimeUpdate={handleTimeUpdate}
                        onLoadedMetadata={handleLoadedMetadata}
                        onEnded={() => setIsPlaying(false)}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    /* 🖥️ Desktop 16:9 Widescreen Frame */
                    <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden border-2 border-border shadow-lg">
                      <video
                        ref={videoRef}
                        src={videoUrl}
                        onTimeUpdate={handleTimeUpdate}
                        onLoadedMetadata={handleLoadedMetadata}
                        onEnded={() => setIsPlaying(false)}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  )}
                </div>
              ) : (
                /* Import Dropzone */
                <div className="text-center p-8 space-y-4">
                  <div className="w-16 h-16 bg-accent/10 border-2 border-accent/30 rounded-2xl flex items-center justify-center mx-auto text-accent shadow-neo-sm">
                    <Upload className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-text-primary">Drag & Drop Video Here</h3>
                    <p className="text-xs text-text-secondary mt-1">Supports MP4, MKV, MOV, WEBM, AVI video files</p>
                  </div>
                  <label className="btn-neo-primary px-6 py-3 text-xs cursor-pointer inline-flex items-center gap-2 font-bold shadow-neo-sm">
                    <Video className="w-4 h-4" /> Browse Video File
                    <input
                      type="file"
                      accept="video/*"
                      onChange={handleFileInputChange}
                      className="hidden"
                    />
                  </label>
                </div>
              )}
            </div>

            {/* Video Controls Bar */}
            {videoUrl && (
              <div className="space-y-3">
                {/* Seekbar & Timecode */}
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

                {/* Transport Buttons & Speed Controls */}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={togglePlay}
                      className="p-2.5 rounded-lg bg-surface border-2 border-text-primary text-text-primary hover:text-accent hover:bg-surface-hover shadow-neo-sm transition-all"
                    >
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                    </button>
                    <label className="btn-neo-secondary px-3.5 py-2 text-xs cursor-pointer inline-flex items-center gap-1.5 font-bold">
                      <Upload className="w-3.5 h-3.5" /> Import New Video
                      <input
                        type="file"
                        accept="video/*"
                        onChange={handleFileInputChange}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* Playback Rate Selector */}
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

                {/* Interactive Timestamp Marker Buttons */}
                <div className="p-3.5 bg-surface rounded-card border-2 border-text-primary space-y-2 shadow-neo-sm">
                  <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                    Interactive Cursor Markers
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleSetStart}
                      className="btn-neo-secondary py-2 text-xs flex items-center justify-center gap-1.5 font-semibold"
                    >
                      <Clock className="w-3.5 h-3.5 text-accent" /> Set Start Marker
                    </button>
                    <button
                      onClick={handleSetEnd}
                      className="btn-neo-primary py-2 text-xs flex items-center justify-center gap-1.5 font-bold"
                    >
                      <Plus className="w-3.5 h-3.5" /> Set End & Add Clip
                    </button>
                  </div>
                  {markerStart !== null && (
                    <div className="text-[11px] text-accent font-mono flex items-center justify-between pt-1">
                      <span>Active Start Marker: {formatShortTimecode(markerStart)}</span>
                      <button
                        onClick={() => setMarkerStart(null)}
                        className="text-text-muted hover:text-danger underline"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column (Timelines Input & 2K/4K Quality Controls — 7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Export Quality & Aspect Fitting Settings Panel */}
          <div className="card-neo p-5 space-y-3">
            <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider flex items-center gap-2 border-b border-border pb-2">
              <Zap className="w-4 h-4 text-accent" /> 2K / 4K Export Quality & Mobile Fitting
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              {/* Resolution Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-primary">Export Resolution:</label>
                <select
                  value={exportQuality}
                  onChange={(e) => setExportQuality(e.target.value as ExportQualityMode)}
                  className="w-full p-2.5 bg-surface rounded-input border-2 border-text-primary text-xs text-text-primary focus:outline-none focus:border-accent font-bold shadow-neo-sm"
                >
                  <option value="original">⚡ Original (Stream Copy - Instant Lossless)</option>
                  <option value="1080p">📺 1080p Full HD (High Bitrate)</option>
                  <option value="2k">🚀 2K QHD (2560x1440 / 1440x2560 60fps)</option>
                  <option value="4k">🌟 4K UHD (3840x2160 / 2160x3840 Ultra-Sharp)</option>
                </select>
              </div>

              {/* Aspect Ratio Mode Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-primary">Mobile Aspect Fitting:</label>
                <select
                  value={aspectFit}
                  onChange={(e) => setAspectFit(e.target.value as AspectFitMode)}
                  className="w-full p-2.5 bg-surface rounded-input border-2 border-text-primary text-xs text-text-primary focus:outline-none focus:border-accent font-bold shadow-neo-sm"
                >
                  <option value="mobile_9_16">📱 9:16 Vertical Short (Fill & Center Crop)</option>
                  <option value="original">🖥️ Widescreen 16:9 Original</option>
                  <option value="square_1_1">🔳 Square 1:1 Feed Post</option>
                </select>
              </div>
            </div>
          </div>

          {/* Timeline Input Textarea */}
          <div className="card-neo p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-accent" /> Batch Timestamp Ranges (Paste Text)
              </h2>
              <span className="text-xs text-text-muted font-mono font-bold">
                {segments.length} clip(s) detected
              </span>
            </div>

            <textarea
              rows={4}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste timelines here (one range per line):\n0:0:1:45-0:0:2:45\n0:1:1:45-0:1:2:45\n00:02:10.500 - 00:02:35.000"
              className="w-full p-3 bg-surface rounded-input border-2 border-text-primary font-mono text-xs text-text-primary focus:outline-none focus:border-accent leading-relaxed shadow-neo-sm"
            />
            <p className="text-[11px] text-text-muted">
              Supported formats: <code className="text-accent font-mono">0:0:1:45-0:0:2:45</code> (H:M:S:MS), <code className="text-accent font-mono">00:01:15.500-00:01:30.000</code>, <code className="text-accent font-mono">1:15-2:00</code> (M:S).
            </p>
          </div>

          {/* Structured Numbered Sequence Clip Cards List (#1, #2, #3...) */}
          <div className="card-neo p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider flex items-center gap-2">
                <Film className="w-4 h-4 text-accent" /> Ordered Clip Sequence
              </h2>
              {segments.length > 0 && (
                <button
                  onClick={() => setRawText('')}
                  className="text-xs text-text-muted hover:text-danger flex items-center gap-1 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Clear All
                </button>
              )}
            </div>

            {segments.length === 0 ? (
              <div className="text-center py-8 text-text-muted space-y-2">
                <Scissors className="w-8 h-8 text-text-muted mx-auto opacity-50" />
                <p className="text-xs font-semibold">No valid timestamp ranges entered yet.</p>
                <p className="text-[11px]">Type or paste ranges in the text box above to generate numbered clips!</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                {segments.map((seg, idx) => (
                  <div
                    key={seg.id}
                    className="p-3 bg-surface rounded-lg border-2 border-border flex items-center justify-between gap-3 hover:border-accent transition-all shadow-neo-sm group"
                  >
                    {/* Number Badge & Clip Info */}
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
                        <div className="text-[11px] text-text-muted mt-0.5 flex items-center gap-2">
                          <span>Duration: <strong className="text-text-primary font-mono">{seg.formattedDuration}</strong></span>
                          <span className="text-border">|</span>
                          <span className="font-mono opacity-60">Raw: {seg.rawInput}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => previewSegment(seg)}
                        className="px-2.5 py-1.5 rounded-md bg-surface-hover border border-border text-xs font-bold text-text-primary hover:text-accent hover:border-accent flex items-center gap-1 transition-all"
                        title="Preview clip range in video player"
                      >
                        <Play className="w-3 h-3 fill-current text-accent" /> Preview
                      </button>
                      <button
                        onClick={() => moveSegment(idx, 'up')}
                        disabled={idx === 0}
                        className="p-1.5 rounded bg-surface border border-border text-text-muted hover:text-text-primary disabled:opacity-30"
                        title="Move Clip Up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => moveSegment(idx, 'down')}
                        disabled={idx === segments.length - 1}
                        className="p-1.5 rounded bg-surface border border-border text-text-muted hover:text-text-primary disabled:opacity-30"
                        title="Move Clip Down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteSegment(idx)}
                        className="p-1.5 rounded bg-surface border border-border text-text-muted hover:text-danger hover:border-danger/40 transition-all"
                        title="Delete Clip"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Trimming Options & Start Button */}
            <div className="pt-3 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-text-secondary select-none">
                <input
                  type="checkbox"
                  checked={mergeAll}
                  onChange={(e) => setMergeAll(e.target.checked)}
                  className="rounded border-border text-accent focus:ring-accent"
                />
                <span>Also merge all trimmed clips into 1 combined video reel</span>
              </label>

              <button
                onClick={handleStartTrimming}
                disabled={isTrimming || segments.length === 0 || !backendVideoPath}
                className="w-full sm:w-auto btn-neo-primary px-6 py-2.5 text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50 shadow-neo-sm"
              >
                {isTrimming ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Rendering in {exportQuality.toUpperCase()}...
                  </>
                ) : (
                  <>
                    <Scissors className="w-4 h-4" /> Start Trimming ({segments.length} Clips in {exportQuality.toUpperCase()})
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Generated Results Section & ZIP Export */}
          {trimmedResults.length > 0 && (
            <div className="card-neo p-5 space-y-4 bg-accent/5 border-accent/30">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
                <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-success" /> Generated Clips ({trimmedResults.length})
                </h2>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportZip}
                    disabled={isZipping}
                    className="btn-neo-primary px-3.5 py-1.5 text-xs flex items-center gap-1.5 font-bold shadow-neo-sm"
                  >
                    {isZipping ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />}
                    Download All as ZIP
                  </button>

                  {combinedUrl && (
                    <a
                      href={combinedUrl}
                      download
                      className="btn-neo-secondary px-3.5 py-1.5 text-xs flex items-center gap-1.5 text-accent font-bold"
                    >
                      <Download className="w-3.5 h-3.5" /> Download Merged Reel
                    </a>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto">
                {trimmedResults.map((clip) => (
                  <div
                    key={clip.clip_number}
                    className="p-3 bg-surface rounded-lg border-2 border-border space-y-2 shadow-neo-sm"
                  >
                    <div className="flex items-center justify-between">
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

                    {clip.download_url && (
                      <a
                        href={clip.download_url}
                        download
                        className="btn-neo-secondary w-full py-1.5 text-xs flex items-center justify-center gap-1.5 font-bold hover:text-accent"
                      >
                        <Download className="w-3.5 h-3.5" /> Download Clip #{clip.clip_number}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
