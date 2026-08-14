import React, { useState, useRef, useEffect } from 'react';
import { useStudioStore } from '@/store/useStudioStore';
import {
  Scissors, Upload, Play, Pause, Volume2, Download, Trash2,
  Plus, Clock, ArrowUp, ArrowDown, Film, CheckCircle2, AlertCircle,
  Sparkles, RefreshCw, FileVideo, Layers, Video
} from 'lucide-react';

interface ClipSegment {
  id: string;
  index: number; // 1, 2, 3...
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

  // Marker State
  const [markerStart, setMarkerStart] = useState<number | null>(null);

  // Text Timeline Input State
  const [rawText, setRawText] = useState<string>(
    '0:0:1:45-0:0:2:45\n0:1:1:45-0:1:2:45'
  );
  const [segments, setSegments] = useState<ClipSegment[]>([]);

  // Processing & Results State
  const [isTrimming, setIsTrimming] = useState<boolean>(false);
  const [mergeAll, setMergeAll] = useState<boolean>(false);
  const [trimmedResults, setTrimmedResults] = useState<TrimmedResult[]>([]);
  const [combinedUrl, setCombinedUrl] = useState<string | null>(null);

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

  // Helper: Parse any timestamp string into seconds
  const parseTimestamp = (str: string): number => {
    const clean = str ? str.trim().replace(',', '.') : '';
    if (!clean) return 0;

    const parts = clean.split(':');
    try {
      if (parts.length === 4) {
        // e.g. 0:0:1:45 -> H:M:S:MS (MS could be 2-digit frames/centiseconds or 3-digit ms)
        const h = parseFloat(parts[0]) || 0;
        const m = parseFloat(parts[1]) || 0;
        const s = parseFloat(parts[2]) || 0;
        const msPart = parseFloat(parts[3]) || 0;
        const ms = parts[3].length <= 2 ? msPart / 100 : msPart / 1000;
        return h * 3600 + m * 60 + s + ms;
      } else if (parts.length === 3) {
        // e.g. 01:23:45.500
        const h = parseFloat(parts[0]) || 0;
        const m = parseFloat(parts[1]) || 0;
        const s = parseFloat(parts[2]) || 0;
        return h * 3600 + m * 60 + s;
      } else if (parts.length === 2) {
        // e.g. 01:23.500 or 1:30
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

  // Parse multi-line rawText whenever it changes
  useEffect(() => {
    const lines = rawText.split('\n');
    const parsed: ClipSegment[] = [];
    let clipIndex = 1;

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) return;

      // Split by '-' or 'to' or '->'
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

  // Handle Video Upload
  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setVideoFile(file);
    const localBlobUrl = URL.createObjectURL(file);
    setVideoUrl(localBlobUrl);
    setIsUploading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setBackendVideoPath(data.video_url || data.audio_url);
        showToast(`Video "${file.name}" uploaded successfully!`, 'success');
      } else {
        showToast('Local preview active — backend upload failed', 'info');
      }
    } catch {
      showToast('Local preview active — server offline', 'info');
    } finally {
      setIsUploading(false);
    }
  };

  // Video Time update listener
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  // Video Metadata Loaded listener
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setVideoDuration(videoRef.current.duration);
    }
  };

  // Toggle Play / Pause
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

  // Set Playback Speed
  const changePlaybackRate = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  };

  // Interactive Marker: Set Start
  const handleSetStart = () => {
    setMarkerStart(currentTime);
    showToast(`Start marker set at ${formatShortTimecode(currentTime)}`, 'info');
  };

  // Interactive Marker: Set End & Add Segment
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

  // Seek Video to segment and play
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

  // Reorder Segment
  const moveSegment = (idx: number, direction: 'up' | 'down') => {
    const lines = rawText.split('\n').filter((l) => l.trim());
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= lines.length) return;

    const temp = lines[idx];
    lines[idx] = lines[targetIdx];
    lines[targetIdx] = temp;

    setRawText(lines.join('\n'));
  };

  // Delete Segment
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
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setTrimmedResults(data.clips || []);
        if (data.combined_url) {
          setCombinedUrl(data.combined_url);
        }
        showToast(`Successfully trimmed ${data.total_clips} clips!`, 'success');
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

  return (
    <div className="p-8 space-y-6 max-w-[1600px] mx-auto select-none">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary flex items-center gap-2">
            <Scissors className="w-6 h-6 text-accent" /> Batch Video Trimmer & Timeline Splitter
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Upload any video and paste a list of timestamp ranges (e.g. <code className="bg-surface px-1.5 py-0.5 rounded border border-border text-accent font-mono text-xs">0:0:1:45-0:0:2:45</code>). Automatically numbers and trims clips (#1, #2, #3, #4...) with one-click export!
          </p>
        </div>

        {/* Top Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setRawText('0:0:1:45-0:0:2:45\n0:1:1:45-0:1:2:45\n0:2:10:00-0:2:30:00')}
            className="px-3.5 py-2 rounded-badge text-xs font-semibold bg-surface border border-border text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-all flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-accent" /> Insert Demo Timelines
          </button>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (Video Player & Controls — 5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="card-neo p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider flex items-center gap-2">
                <FileVideo className="w-4 h-4 text-accent" /> Video Source & Player
              </h2>
              {isUploading && (
                <span className="text-xs text-accent animate-pulse font-medium">
                  Uploading to server...
                </span>
              )}
            </div>

            {/* Video Player Box */}
            <div className="relative aspect-video bg-black rounded-lg overflow-hidden border border-border flex items-center justify-center group">
              {videoUrl ? (
                <video
                  ref={videoRef}
                  src={videoUrl}
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  onEnded={() => setIsPlaying(false)}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-center p-6 space-y-3">
                  <Video className="w-12 h-12 text-text-muted mx-auto" />
                  <p className="text-xs text-text-secondary">No video loaded yet</p>
                  <label className="btn-neo-primary px-4 py-2 text-xs cursor-pointer inline-flex items-center gap-2">
                    <Upload className="w-4 h-4" /> Upload Video
                    <input
                      type="file"
                      accept="video/*"
                      onChange={handleVideoUpload}
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

                {/* Transport Buttons & Rate Selector */}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={togglePlay}
                      className="p-2 rounded-lg bg-surface border border-border text-text-primary hover:text-accent hover:bg-surface-hover transition-all"
                    >
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                    </button>
                    <label className="btn-neo-secondary px-3 py-1.5 text-xs cursor-pointer inline-flex items-center gap-1.5">
                      <Upload className="w-3.5 h-3.5" /> Replace
                      <input
                        type="file"
                        accept="video/*"
                        onChange={handleVideoUpload}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* Playback Rate Buttons */}
                  <div className="flex items-center gap-1 bg-surface p-1 rounded-lg border border-border text-[11px]">
                    {[0.5, 1.0, 1.5, 2.0].map((rate) => (
                      <button
                        key={rate}
                        onClick={() => changePlaybackRate(rate)}
                        className={`px-2 py-0.5 rounded font-mono transition-all ${
                          playbackRate === rate
                            ? 'bg-accent text-white font-bold'
                            : 'text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        {rate}x
                      </button>
                    ))}
                  </div>
                </div>

                {/* Interactive Timestamp Marker Buttons */}
                <div className="p-3 bg-surface rounded-lg border border-border space-y-2">
                  <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                    Quick Cursor Markers
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleSetStart}
                      className="btn-neo-secondary py-2 text-xs flex items-center justify-center gap-1.5"
                    >
                      <Clock className="w-3.5 h-3.5 text-accent" /> Set Start Marker
                    </button>
                    <button
                      onClick={handleSetEnd}
                      className="btn-neo-primary py-2 text-xs flex items-center justify-center gap-1.5"
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

        {/* Right Column (Timelines Input & Numbered Clip Cards — 7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Timeline Input Textarea */}
          <div className="card-neo p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-accent" /> Batch Timestamp Ranges (Paste Text)
              </h2>
              <span className="text-xs text-text-muted font-mono">
                {segments.length} clip(s) detected
              </span>
            </div>

            <textarea
              rows={4}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste timelines here (one range per line):\n0:0:1:45-0:0:2:45\n0:1:1:45-0:1:2:45\n00:02:10.500 - 00:02:35.000"
              className="w-full p-3 bg-surface rounded-input border border-border font-mono text-xs text-text-primary focus:outline-none focus:border-accent leading-relaxed"
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
                <p className="text-xs">No valid timestamp ranges entered yet.</p>
                <p className="text-[11px]">Type or paste ranges in the text box above to generate numbered clips!</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                {segments.map((seg, idx) => (
                  <div
                    key={seg.id}
                    className="p-3 bg-surface rounded-lg border border-border flex items-center justify-between gap-3 hover:border-accent/40 transition-all group"
                  >
                    {/* Number Badge & Clip Info */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center font-bold text-xs text-accent shrink-0">
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
                        className="px-2.5 py-1.5 rounded-md bg-surface-hover border border-border text-xs font-medium text-text-primary hover:text-accent hover:border-accent flex items-center gap-1 transition-all"
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
              <label className="flex items-center gap-2 cursor-pointer text-xs text-text-secondary select-none">
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
                className="w-full sm:w-auto btn-neo-primary px-6 py-2.5 text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isTrimming ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Trimming {segments.length} Clips...
                  </>
                ) : (
                  <>
                    <Scissors className="w-4 h-4" /> Start Trimming ({segments.length} Clips)
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Generated Results Section */}
          {trimmedResults.length > 0 && (
            <div className="card-neo p-5 space-y-4 bg-accent/5 border-accent/30">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-success" /> Generated Trimmed Clips ({trimmedResults.length})
                </h2>
                {combinedUrl && (
                  <a
                    href={combinedUrl}
                    download
                    className="btn-neo-secondary px-3 py-1.5 text-xs flex items-center gap-1.5 text-accent font-bold"
                  >
                    <Download className="w-3.5 h-3.5" /> Download Merged Reel
                  </a>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto">
                {trimmedResults.map((clip) => (
                  <div
                    key={clip.clip_number}
                    className="p-3 bg-surface rounded-lg border border-border space-y-2"
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
                        className="btn-neo-primary w-full py-1.5 text-xs flex items-center justify-center gap-1.5"
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
