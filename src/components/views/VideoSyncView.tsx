import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useStudioStore } from '@/store/useStudioStore';
import TimelineView from './TimelineView';
import {
  Upload, Video, Play, Pause, DownloadCloud, CheckCircle2,
  AlertCircle, Volume2, Clock, FilmIcon, Mic,
  Trash2, FastForward, Rewind, MoveHorizontal, Scissors,
  Repeat, Subtitles, Sparkles, XCircle, Copy, FilePlus, Tag, Layers,
  PanelRightClose, PanelRightOpen, SlidersHorizontal,
  Database, ChevronDown, ChevronUp, ArrowRight, Info
} from 'lucide-react';

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface NarrationMarker {
  id: string;
  label: string;
  audioUrl: string;
  audioFilename: string;
  startTimeSec: number;
  durationSec: number;
  volume: number;          // 0.0 - 2.0
  speed?: number;          // 0.5x - 2.0x
  color: string;
  crossfadeInSec?: number;   // blend-in duration (seconds)
  crossfadeOutSec?: number;  // blend-out duration (seconds)
}

const MARKER_COLORS = ['#6c47ff', '#00c896', '#f59e0b', '#3b82f6', '#ef4444', '#ec4899', '#8b5cf6', '#14b8a6'];

export const VideoSyncView: React.FC = () => {
  const {
    videoSyncSource, setVideoSyncSource,
    videoSyncMarkers, setVideoSyncMarkers,
    videoSyncLoopA, videoSyncLoopB, videoSyncIsLooping, setVideoSyncLoop,
    videoSyncSettings, setVideoSyncSettings,
    historyList, fetchHistory,
    showToast, currentAudioUrl, addExternalFileToTimeline,
    timelinePlayheadSec, setTimelinePlayhead,
    timelineTracks, addClipToTrack,
  } = useStudioStore();

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioNodesRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Local Media State
  const [localVideoUrl, setLocalVideoUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [waveformPeaks, setWaveformPeaks] = useState<number[]>([]);

  // Local Form Controls State
  const [selectedAudio, setSelectedAudio] = useState<string>('');
  const [selectedAudioFilename, setSelectedAudioFilename] = useState<string>('');
  const [markerStart, setMarkerStart] = useState(0);
  const [activeMarkerId, setActiveMarkerId] = useState<string | null>(null);

  // Export State
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<string>('');
  const [exportUrl, setExportUrl] = useState<string | null>(null);

  // Player Controls State
  const [videoDuration, setVideoDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mediaPoolOpen, setMediaPoolOpen] = useState(false);
  const [mediaPoolTargetId, setMediaPoolTargetId] = useState<string>('');

  // Timeline Dragging State (Marker or Loop Handles)
  const [draggingTarget, setDraggingTarget] = useState<{ type: 'marker' | 'loopA' | 'loopB'; id?: string } | null>(null);
  const timelineBarRef = useRef<HTMLDivElement>(null);

  const markers: NarrationMarker[] = videoSyncMarkers || [];
  const loopA = videoSyncLoopA;
  const loopB = videoSyncLoopB;
  const isLooping = videoSyncIsLooping;

  const { preserveOriginal, origVolume, autoDucking, burnSubtitles } = videoSyncSettings;
  const activeMarkerObj = markers.find(m => m.id === activeMarkerId);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // ── Fetch & Extract Waveform Data for Strip Visualization ──────────────────

  useEffect(() => {
    if (!videoSyncSource?.extractedAudioUrl) {
      setWaveformPeaks([]);
      return;
    }

    let isMounted = true;
    const loadWaveform = async () => {
      try {
        const response = await fetch(videoSyncSource.extractedAudioUrl!);
        const arrayBuffer = await response.arrayBuffer();
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        const rawData = audioBuffer.getChannelData(0);

        const samples = 140; // Number of bars to draw
        const blockSize = Math.floor(rawData.length / samples);
        const peaks: number[] = [];

        for (let i = 0; i < samples; i++) {
          const start = i * blockSize;
          let max = 0;
          for (let j = 0; j < blockSize; j += 10) {
            const val = Math.abs(rawData[start + j] || 0);
            if (val > max) max = val;
          }
          peaks.push(max);
        }

        if (isMounted) setWaveformPeaks(peaks);
        audioCtx.close();
      } catch (err) {
        console.warn('Waveform decoding error:', err);
      }
    };

    loadWaveform();
    return () => { isMounted = false; };
  }, [videoSyncSource?.extractedAudioUrl]);

  // Draw Waveform to Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || waveformPeaks.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const barWidth = width / waveformPeaks.length;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';

    waveformPeaks.forEach((peak, i) => {
      const barHeight = Math.max(3, peak * height * 0.85);
      const x = i * barWidth;
      const y = (height - barHeight) / 2;
      ctx.fillRect(x, y, barWidth - 1, barHeight);
    });
  }, [waveformPeaks]);

  // ── Sync Active Narration Audio Nodes & Auto-Ducking with Video Playback ───

  const stopAllAudios = useCallback(() => {
    audioNodesRef.current.forEach(aud => {
      aud.pause();
      aud.currentTime = 0;
    });
    audioNodesRef.current.clear();
  }, []);

  const syncNarrationAudios = useCallback((sec: number, playing: boolean) => {
    let narrationActive = false;

    markers.forEach(m => {
      const clipStart = m.startTimeSec;
      const clipEnd = m.startTimeSec + m.durationSec;

      if (sec >= clipStart && sec < clipEnd) {
        narrationActive = true;
        let aud = audioNodesRef.current.get(m.id);
        if (!aud) {
          aud = new Audio(m.audioUrl);
          audioNodesRef.current.set(m.id, aud);
        }
        aud.volume = m.volume;
        if (m.speed) aud.playbackRate = m.speed;

        const targetOffset = (sec - clipStart) * (m.speed || 1.0);
        if (Math.abs(aud.currentTime - targetOffset) > 0.15) {
          aud.currentTime = targetOffset;
        }
        if (playing && aud.paused) {
          aud.play().catch(() => { });
        } else if (!playing && !aud.paused) {
          aud.pause();
        }
      } else {
        const aud = audioNodesRef.current.get(m.id);
        if (aud) {
          aud.pause();
          aud.currentTime = 0;
          audioNodesRef.current.delete(m.id);
        }
      }
    });

    // Auto-Ducking Video Background Volume during Narration
    if (videoRef.current && preserveOriginal) {
      if (narrationActive && autoDucking) {
        videoRef.current.volume = Math.max(0.05, origVolume * 0.25);
      } else {
        videoRef.current.volume = origVolume;
      }
    }
  }, [markers, preserveOriginal, origVolume, autoDucking]);

  // Handle Video Time Updates & A-B Loop Region Jump
  const onTimeUpdate = () => {
    if (!videoRef.current) return;
    const t = videoRef.current.currentTime;
    setCurrentTime(t);
    setTimelinePlayhead(t);

    // A-B Loop Check
    if (isLooping && loopA !== null && loopB !== null && t >= loopB) {
      videoRef.current.currentTime = loopA;
      setCurrentTime(loopA);
      setTimelinePlayhead(loopA);
      syncNarrationAudios(loopA, !videoRef.current.paused);
      return;
    }

    syncNarrationAudios(t, !videoRef.current.paused);
  };

  // Sync timeline playhead seek (from clicking ruler or dragging playhead) back to video element
  useEffect(() => {
    if (videoRef.current && Math.abs(videoRef.current.currentTime - timelinePlayheadSec) > 0.15) {
      videoRef.current.currentTime = timelinePlayheadSec;
      setCurrentTime(timelinePlayheadSec);
    }
  }, [timelinePlayheadSec]);

  // ── Video Upload & Reliable Preview Loading ────────────────────────────────

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);

    const localUrl = URL.createObjectURL(file);
    setLocalVideoUrl(localUrl);

    if (videoRef.current) {
      videoRef.current.src = localUrl;
      videoRef.current.load();
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/video/extract', { method: 'POST', body: formData });
      if (res.ok) {
        const data = await res.json();
        setVideoSyncSource({
          videoPath: data.video_path,
          videoUrl: data.video_url || localUrl,
          fileName: file.name,
          extractedAudioUrl: data.audio_url,
        });
        showToast('Video loaded — reference audio & waveform extracted', 'success');

        // Automatically sync into TimelineView so video clip appears in Timeline Editor as well
        addExternalFileToTimeline(file);
      } else {
        showToast('Audio extraction failed — local preview ready', 'info');
        setVideoSyncSource({ videoPath: '', videoUrl: localUrl, fileName: file.name, extractedAudioUrl: null });
      }
    } catch {
      setVideoSyncSource({ videoPath: '', videoUrl: localUrl, fileName: file.name, extractedAudioUrl: null });
      showToast('Backend offline — local video preview active', 'info');
    } finally {
      setIsUploading(false);
    }
  };

  // ── Transport & Seek Controls ──────────────────────────────────────────────

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
      stopAllAudios();
    }
  };

  const seekTo = (sec: number) => {
    const clampedSec = Math.max(0, Math.min(videoDuration || 100, sec));
    if (videoRef.current) {
      videoRef.current.currentTime = clampedSec;
    }
    setCurrentTime(clampedSec);
    syncNarrationAudios(clampedSec, isPlaying);
  };

  // ── Keyboard Shortcuts (Space, Arrow keys, [, ], S, L, Ctrl+D) ─────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        seekTo(currentTime - 5);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        seekTo(currentTime + 5);
      } else if (e.code === 'BracketLeft') {
        e.preventDefault();
        const a = Math.round(currentTime * 10) / 10;
        setVideoSyncLoop(a, loopB !== null ? Math.max(a + 0.5, loopB) : a + 5, true);
        showToast(`Loop Point A set at ${a}s`, 'info');
      } else if (e.code === 'BracketRight') {
        e.preventDefault();
        const b = Math.round(currentTime * 10) / 10;
        const a = loopA !== null ? Math.min(loopA, b - 0.5) : Math.max(0, b - 5);
        setVideoSyncLoop(a, b, true);
        showToast(`Loop Point B set at ${b}s (Looping ON)`, 'info');
      } else if (e.code === 'KeyL') {
        e.preventDefault();
        setVideoSyncLoop(loopA, loopB, !isLooping);
      } else if (e.code === 'KeyS') {
        e.preventDefault();
        handleCapCutSplit();
      } else if (e.ctrlKey && e.code === 'KeyD' && activeMarkerId) {
        e.preventDefault();
        duplicateMarker(activeMarkerId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentTime, videoDuration, isPlaying, loopA, loopB, isLooping, activeMarkerId]);

  // ── Markers Management, Duplication & Splitting ────────────────────────────

  const addMarker = () => {
    if (!selectedAudio || !selectedAudioFilename) {
      showToast('Select a narration audio first', 'error');
      return;
    }
    const histItem = historyList.find(h => h.audio_url === selectedAudio);
    const color = MARKER_COLORS[markers.length % MARKER_COLORS.length];
    const newMarker: NarrationMarker = {
      id: `marker_${Date.now()}`,
      label: histItem?.text.slice(0, 36) || selectedAudioFilename,
      audioUrl: selectedAudio,
      audioFilename: selectedAudioFilename,
      startTimeSec: Math.round(markerStart * 10) / 10,
      durationSec: histItem?.duration || 5,
      volume: 1.0,
      speed: 1.0,
      color,
    };
    setVideoSyncMarkers(prev => [...prev, newMarker]);
    setActiveMarkerId(newMarker.id);
    showToast(`Marker added at ${Math.round(markerStart * 10) / 10}s`, 'success');
  };

  const removeMarker = (id: string) => {
    setVideoSyncMarkers(prev => prev.filter((m: NarrationMarker) => m.id !== id));
    if (activeMarkerId === id) setActiveMarkerId(null);
    const aud = audioNodesRef.current.get(id);
    if (aud) {
      aud.pause();
      audioNodesRef.current.delete(id);
    }
  };

  const updateMarker = (id: string, updates: Partial<NarrationMarker>) => {
    setVideoSyncMarkers(prev => prev.map((m: NarrationMarker) => m.id === id ? { ...m, ...updates } : m));
  };

  const duplicateMarker = (id: string) => {
    const target = markers.find(m => m.id === id);
    if (!target) return;
    const color = MARKER_COLORS[(markers.length + 1) % MARKER_COLORS.length];
    const dup: NarrationMarker = {
      ...target,
      id: `marker_${Date.now()}_dup`,
      label: `${target.label} (Copy)`,
      startTimeSec: Math.round((target.startTimeSec + target.durationSec + 0.5) * 10) / 10,
      color,
    };
    setVideoSyncMarkers(prev => [...prev, dup]);
    setActiveMarkerId(dup.id);
    showToast(`Duplicated ${target.label}`, 'success');
  };

  const splitActiveMarker = () => {
    const active = markers.find(m => currentTime >= m.startTimeSec && currentTime < (m.startTimeSec + m.durationSec))
      || (activeMarkerId ? markers.find(m => m.id === activeMarkerId) : null);

    if (!active) {
      showToast('Position playhead inside a marker to split it', 'info');
      return;
    }

    const clipStart = active.startTimeSec;
    const clipEnd = active.startTimeSec + active.durationSec;
    if (currentTime <= clipStart + 0.1 || currentTime >= clipEnd - 0.1) {
      showToast('Playhead must be inside the marker to split', 'info');
      return;
    }

    const firstDur = currentTime - clipStart;
    const secondDur = clipEnd - currentTime;

    // First part
    updateMarker(active.id, { durationSec: firstDur, label: `${active.label} (Pt 1)` });

    // Second part
    const newPart: NarrationMarker = {
      id: `marker_${Date.now()}`,
      label: `${active.label} (Pt 2)`,
      audioUrl: active.audioUrl,
      audioFilename: active.audioFilename,
      startTimeSec: currentTime,
      durationSec: secondDur,
      volume: active.volume,
      speed: active.speed,
      color: active.color,
      crossfadeInSec: active.crossfadeInSec,
      crossfadeOutSec: active.crossfadeOutSec,
    };
    setVideoSyncMarkers(prev => [...prev, newPart]);
    setActiveMarkerId(newPart.id);
    showToast(`Marker split at ${currentTime.toFixed(1)}s`, 'success');
  };

  // CapCut Universal Split Handler (Splits Video clip, Audio clip, or Marker under playhead)
  const handleCapCutSplit = () => {
    const { timelineTracks, splitClip } = useStudioStore.getState();

    // 1. Check if playhead is inside any Video or Audio timeline clip
    let targetTrack: any = null;
    let targetClip: any = null;

    for (const tr of timelineTracks) {
      const found = tr.clips.find((c: any) => currentTime > c.startTimeSec + 0.05 && currentTime < (c.startTimeSec + c.durationSec) - 0.05);
      if (found) {
        if (tr.type === 'video' || found.clipType === 'video' || !targetClip) {
          targetTrack = tr;
          targetClip = found;
        }
      }
    }

    if (targetTrack && targetClip) {
      splitClip(targetTrack.id, targetClip.id, currentTime);
      return;
    }

    // 2. Check if playhead is inside a Narration Marker
    const activeMarker = markers.find(m => currentTime > m.startTimeSec + 0.05 && currentTime < (m.startTimeSec + m.durationSec) - 0.05)
      || (activeMarkerId ? markers.find(m => m.id === activeMarkerId) : null);

    if (activeMarker) {
      splitActiveMarker();
      return;
    }

    showToast('Position playhead over a video clip or marker to split (S)', 'info');
  };

  // Direct External Audio/Video Upload inside Video Sync
  const handleExternalMediaImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append('file', file);

      try {
        showToast(`Uploading ${file.name}…`, 'info');
        const res = await fetch('/api/audio/upload', { method: 'POST', body: formData });
        if (res.ok) {
          const data = await res.json();
          const filename = data.audio_url.split('/').pop() || file.name;
          const color = MARKER_COLORS[markers.length % MARKER_COLORS.length];
          const newMarker: NarrationMarker = {
            id: `marker_${Date.now()}_${i}`,
            label: file.name,
            audioUrl: data.audio_url,
            audioFilename: filename,
            startTimeSec: Math.round(currentTime * 10) / 10,
            durationSec: data.duration || 5.0,
            volume: 1.0,
            speed: 1.0,
            color,
          };
          setVideoSyncMarkers(prev => [...prev, newMarker]);
          setActiveMarkerId(newMarker.id);
          showToast(`Imported ${file.name} to Video Sync at ${currentTime.toFixed(1)}s`, 'success');
        }
      } catch {
        showToast(`Failed to upload ${file.name}`, 'error');
      }
    }
  };

  // ── Dragging Markers & Loop A/B Handles on Timeline Bar ───────────────────

  const updateDragPosFromMouseEvent = useCallback((e: MouseEvent) => {
    if (!draggingTarget || !timelineBarRef.current || videoDuration <= 0) return;
    const rect = timelineBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));
    const newSec = Math.round(pct * videoDuration * 10) / 10;

    if (draggingTarget.type === 'marker' && draggingTarget.id) {
      updateMarker(draggingTarget.id, { startTimeSec: newSec });
    } else if (draggingTarget.type === 'loopA') {
      const b = loopB !== null ? Math.max(newSec + 0.5, loopB) : newSec + 5;
      setVideoSyncLoop(newSec, b, true);
    } else if (draggingTarget.type === 'loopB') {
      const a = loopA !== null ? Math.min(loopA, newSec - 0.5) : Math.max(0, newSec - 5);
      setVideoSyncLoop(a, newSec, true);
    }
  }, [draggingTarget, videoDuration, loopA, loopB]);

  useEffect(() => {
    if (!draggingTarget) return;

    const handleMouseMove = (e: MouseEvent) => {
      updateDragPosFromMouseEvent(e);
    };

    const handleMouseUp = () => {
      setDraggingTarget(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingTarget, updateDragPosFromMouseEvent]);

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (draggingTarget || !timelineBarRef.current || videoDuration <= 0) return;
    const rect = timelineBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));
    const sec = pct * videoDuration;
    seekTo(sec);
  };

  // ── Multi-Marker Export with Ducking & Subtitles ───────────────────────────

  const handleExport = async () => {
    if (!videoSyncSource || !videoSyncSource.videoPath) {
      showToast('Please import a video through backend first', 'error');
      return;
    }
    if (markers.length === 0) {
      showToast('Add at least 1 narration marker before exporting', 'error');
      return;
    }

    setIsExporting(true);
    setExportProgress('Preparing tracks & filter pipeline…');
    setExportUrl(null);

    const payload = {
      video_path: videoSyncSource.videoPath,
      markers: markers.map(m => ({
        audio_filename: m.audioFilename,
        start_time_sec: m.startTimeSec,
        duration_sec: m.durationSec,
        volume: m.volume,
        speed: m.speed || 1.0,
        label: m.label,
      })),
      preserve_original: preserveOriginal,
      original_volume: origVolume,
      auto_ducking: autoDucking,
      burn_subtitles: burnSubtitles,
    };

    try {
      setExportProgress(burnSubtitles ? 'Re-encoding video with burned subtitles…' : 'Rendering multi-marker audio mix…');
      const res = await fetch('/api/video/render-narration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        setExportUrl(data.download_url);
        showToast('Video exported successfully!', 'success');
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(`Export failed: ${err.detail || 'FFmpeg error'}`, 'error');
      }
    } catch {
      showToast('Backend offline or export failed', 'error');
    } finally {
      setIsExporting(false);
      setExportProgress('');
    }
  };

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    const tenths = Math.floor((s % 1) * 10);
    return `${mins}:${String(secs).padStart(2, '0')}.${tenths}`;
  };

  return (
    <div className="flex flex-col h-full bg-bg-primary overflow-hidden">

      {/* Header */}
      <div className="h-14 border-b border-border bg-surface flex items-center justify-between px-4 shrink-0 z-10">
        <div className="flex items-center gap-3">
          <FilmIcon className="w-5 h-5 text-accent" />
          <div>
            <h2 className="font-bold text-text-primary text-base leading-none flex items-center gap-2">
              Video Sync Studio <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            </h2>
            <p className="text-[11px] text-text-muted mt-0.5">Full DAW Feature Parity · Speed, Gain, Splitting, Duplication & Subtitle Burn-In</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {videoSyncSource && (
            <span className="text-xs text-accent font-mono bg-accent/10 border border-accent/30 px-2.5 py-1 rounded-lg hidden sm:inline-block">
              {videoSyncSource.fileName} ({formatTime(videoDuration)})
            </span>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="px-2.5 py-1.5 text-xs font-semibold rounded-button border border-border bg-bg-secondary text-text-primary hover:border-accent transition-all flex items-center gap-1.5 shadow-sm"
            title={sidebarCollapsed ? "Expand Inspector & Export Sidebar" : "Collapse Sidebar for Full-Width Timeline"}
          >
            {sidebarCollapsed ? <PanelRightOpen className="w-3.5 h-3.5 text-accent" /> : <PanelRightClose className="w-3.5 h-3.5 text-text-muted" />}
            <span className="hidden md:inline">{sidebarCollapsed ? "Show Panel" : "Hide Panel"}</span>
          </button>
          <label className="px-3 py-1.5 text-xs font-semibold rounded-button border border-border bg-bg-secondary text-text-primary hover:border-accent cursor-pointer transition-all flex items-center gap-1.5 shadow-sm">
            <Upload className="w-3.5 h-3.5 text-accent" />
            {videoSyncSource ? 'Change Video' : 'Import Video'}
            <input type="file" accept="video/*" className="hidden" onChange={handleVideoUpload} />
          </label>
        </div>
      </div>

      {/* Contextual Active Marker Inspector Bar (CapCut Feature) */}
      {activeMarkerObj && (
        <div className="shrink-0 border-b border-border bg-accent/5 px-4 py-2 flex items-center gap-4 flex-wrap text-xs z-15 animate-fadeIn">
          <div className="flex items-center gap-1.5 font-bold text-accent">
            <Tag className="w-3.5 h-3.5" />
            <span className="truncate max-w-[160px]">{activeMarkerObj.label}</span>
          </div>

          {/* Volume Control */}
          <div className="flex items-center gap-1.5 border-l border-border/60 pl-3">
            <Volume2 className="w-3.5 h-3.5 text-text-muted shrink-0" />
            <span className="text-text-muted text-[11px]">Gain:</span>
            <input
              type="range" min="0" max="2" step="0.05"
              value={activeMarkerObj.volume}
              onChange={e => updateMarker(activeMarkerObj.id, { volume: parseFloat(e.target.value) })}
              className="w-20 h-1 accent-[var(--color-accent)] cursor-pointer"
            />
            <span className="font-mono text-text-muted text-[11px] w-8">{Math.round(activeMarkerObj.volume * 100)}%</span>
          </div>

          {/* Speed Control */}
          <div className="flex items-center gap-1.5 border-l border-border/60 pl-3">
            <FastForward className="w-3.5 h-3.5 text-text-muted shrink-0" />
            <span className="text-text-muted text-[11px]">Speed:</span>
            <select
              value={activeMarkerObj.speed || 1.0}
              onChange={e => updateMarker(activeMarkerObj.id, { speed: parseFloat(e.target.value) })}
              className="px-1.5 py-0.5 rounded border border-border bg-surface text-text-primary text-[11px] font-mono"
            >
              <option value="0.5">0.5x</option>
              <option value="1.0">1.0x (Normal)</option>
              <option value="1.25">1.25x</option>
              <option value="1.5">1.5x</option>
              <option value="2.0">2.0x</option>
            </select>
          </div>

          {/* Crossfade Controls */}
          <div className="flex items-center gap-1.5 border-l border-border/60 pl-3">
            <span className="text-[11px] font-bold text-blue-400">⟺ CF</span>
            <span className="text-text-muted text-[11px]">In:</span>
            <input
              type="number" min="0" max="5" step="0.1"
              value={activeMarkerObj.crossfadeInSec || 0}
              onChange={e => updateMarker(activeMarkerObj.id, { crossfadeInSec: parseFloat(e.target.value) || 0 })}
              className="w-12 px-1 py-0.5 rounded border border-border bg-surface text-text-primary text-[11px] font-mono text-center"
            />
            <span className="text-text-muted text-[11px]">s Out:</span>
            <input
              type="number" min="0" max="5" step="0.1"
              value={activeMarkerObj.crossfadeOutSec || 0}
              onChange={e => updateMarker(activeMarkerObj.id, { crossfadeOutSec: parseFloat(e.target.value) || 0 })}
              className="w-12 px-1 py-0.5 rounded border border-border bg-surface text-text-primary text-[11px] font-mono text-center"
            />
            <span className="text-text-muted text-[11px]">s</span>
          </div>

          {/* Duplicate & Split Buttons */}
          <div className="flex items-center gap-1 border-l border-border/60 pl-3">
            <button
              onClick={() => duplicateMarker(activeMarkerObj.id)}
              className="px-2 py-0.5 rounded bg-surface border border-border hover:border-amber-400 text-text-primary hover:text-amber-400 text-[11px] font-semibold transition-colors flex items-center gap-1"
              title="Duplicate marker (Ctrl+D)"
            >
              <Copy className="w-3 h-3 text-amber-400" /> Duplicate
            </button>
            <button
              onClick={handleCapCutSplit}
              className="px-2 py-0.5 rounded bg-surface border border-border hover:border-accent text-text-primary hover:text-accent text-[11px] font-semibold transition-colors flex items-center gap-1"
              title="Split video clip or marker at playhead (S)"
            >
              <Scissors className="w-3 h-3 text-accent" /> Split
            </button>
          </div>

          <div className="flex-1" />

          <button
            onClick={() => setActiveMarkerId(null)}
            className="text-[11px] text-text-muted hover:text-text-primary underline"
          >
            Deselect
          </button>
        </div>
      )}

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">

        {/* Left Side: Video Preview + Multi-Track Timeline */}
        <div className="flex-1 flex flex-col p-2 sm:p-4 gap-3 sm:gap-4 overflow-y-auto min-w-0">

          {/* Player Box */}
          <div className="rounded-xl border-2 border-border bg-black overflow-hidden relative shadow-md flex flex-col justify-center items-center group min-h-[220px] sm:min-h-[280px] max-h-[340px] lg:max-h-[400px] shrink-0">
            {(localVideoUrl || videoSyncSource?.videoUrl || videoSyncSource?.videoPath) ? (
              <>
                <video
                  ref={videoRef}
                  src={localVideoUrl || videoSyncSource?.videoUrl || undefined}
                  className="w-full h-full max-h-[360px] object-contain"
                  onTimeUpdate={onTimeUpdate}
                  onLoadedMetadata={() => videoRef.current && setVideoDuration(videoRef.current.duration)}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => { setIsPlaying(false); stopAllAudios(); }}
                  preload="metadata"
                />
                {/* Floating Controls Bar */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3 flex flex-col gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={togglePlay}
                        className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
                        title="Play/Pause (Space)"
                      >
                        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                      </button>
                      <button
                        onClick={() => seekTo(currentTime - 5)}
                        className="p-1.5 text-white/80 hover:text-white transition-colors"
                        title="Rewind 5s (←)"
                      >
                        <Rewind className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => seekTo(currentTime + 5)}
                        className="p-1.5 text-white/80 hover:text-white transition-colors"
                        title="Fast-forward 5s (→)"
                      >
                        <FastForward className="w-4 h-4" />
                      </button>

                      {/* A-B Loop Controls */}
                      <div className="flex items-center gap-1 border-l border-white/20 pl-2 ml-1">
                        <button
                          onClick={() => {
                            const a = Math.round(currentTime * 10) / 10;
                            setVideoSyncLoop(a, loopB !== null ? Math.max(a + 0.5, loopB) : a + 5, true);
                            showToast('Loop A set', 'info');
                          }}
                          className={`px-2 py-0.5 text-[10px] font-bold rounded ${loopA !== null ? 'bg-amber-500 text-black' : 'bg-white/20 text-white'}`}
                          title="Set Loop Point A ([)"
                        >
                          A: {loopA !== null ? `${loopA}s` : 'Set'}
                        </button>
                        <button
                          onClick={() => {
                            const b = Math.round(currentTime * 10) / 10;
                            const a = loopA !== null ? Math.min(loopA, b - 0.5) : Math.max(0, b - 5);
                            setVideoSyncLoop(a, b, true);
                            showToast('Loop B set (ON)', 'info');
                          }}
                          className={`px-2 py-0.5 text-[10px] font-bold rounded ${loopB !== null ? 'bg-amber-500 text-black' : 'bg-white/20 text-white'}`}
                          title="Set Loop Point B (])"
                        >
                          B: {loopB !== null ? `${loopB}s` : 'Set'}
                        </button>
                        <button
                          onClick={() => setVideoSyncLoop(loopA, loopB, !isLooping)}
                          className={`p-1 rounded transition-colors ${isLooping ? 'bg-accent text-white' : 'text-white/60 hover:text-white'}`}
                          title="Toggle A-B Looping (L)"
                        >
                          <Repeat className="w-3.5 h-3.5" />
                        </button>
                        {(loopA !== null || loopB !== null) && (
                          <button
                            onClick={() => { setVideoSyncLoop(null, null, false); showToast('Loop cleared', 'info'); }}
                            className="p-1 rounded text-white/50 hover:text-red-400 transition-colors"
                            title="Clear / Disable Loop"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <span className="text-xs font-mono text-white/90 tabular-nums ml-2">
                        {formatTime(currentTime)} / {formatTime(videoDuration)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={splitActiveMarker}
                        className="px-2 py-1 rounded bg-white/20 hover:bg-accent text-white text-[11px] font-semibold transition-colors flex items-center gap-1"
                        title="Split marker at playhead (S)"
                      >
                        <Scissors className="w-3 h-3 text-amber-300" /> Split
                      </button>
                      <button
                        onClick={() => setMarkerStart(Math.round(currentTime * 10) / 10)}
                        className="px-2.5 py-1 rounded bg-white/20 hover:bg-accent text-white text-[11px] font-semibold transition-colors flex items-center gap-1"
                      >
                        <Clock className="w-3 h-3" /> Copy Time
                      </button>
                    </div>
                  </div>

                  {/* Scrubber Bar */}
                  <input
                    type="range"
                    min="0"
                    max={videoDuration || 100}
                    step="0.05"
                    value={currentTime}
                    onChange={(e) => seekTo(parseFloat(e.target.value))}
                    className="w-full h-1.5 accent-[var(--color-accent)] cursor-pointer"
                  />
                </div>
              </>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-64 cursor-pointer gap-3 text-text-muted hover:text-accent transition-colors">
                <Video className="w-14 h-14 opacity-30" />
                <div className="text-base font-bold text-text-primary">Click or drop video to begin</div>
                <div className="text-xs opacity-60">Supports MP4, WebM, MOV, MKV</div>
                <input type="file" accept="video/*" className="hidden" onChange={handleVideoUpload} />
              </label>
            )}

            {isUploading && (
              <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-3 text-white">
                <div className="w-9 h-9 border-3 border-white/30 border-t-accent rounded-full animate-spin" />
                <span className="text-sm font-semibold">Extracting reference audio & building waveform…</span>
              </div>
            )}
          </div>

          {/* Full Multi-Track CapCut DAW Timeline Editor */}
          <div className="flex-1 border-t border-border bg-bg-primary overflow-hidden flex flex-col min-h-[380px]">
            <div className="bg-surface px-4 py-1.5 border-b border-border flex items-center justify-between shrink-0">
              <span className="text-xs font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-accent" /> Multi-Track CapCut Timeline Engine
              </span>
              <span className="text-[11px] text-text-muted font-mono">
                Press <kbd className="px-1 bg-border/50 rounded text-[10px]">S</kbd> to split clip at playhead · <kbd className="px-1 bg-border/50 rounded text-[10px]">Ctrl+D</kbd> duplicate
              </span>
            </div>
            <div className="flex-1 overflow-hidden">
              <TimelineView showMediaPool={false} showToolbarAddTrack={false} />
            </div>
          </div>

          {/* ── Collapsible Media Pool Bar ─────────────────────────────────── */}
          <div className="shrink-0 border-t border-border">
            {/* Toggle Header */}
            <button
              onClick={() => setMediaPoolOpen(!mediaPoolOpen)}
              className="w-full flex items-center justify-between px-4 py-2 bg-bg-secondary hover:bg-surface-hover transition-colors group"
            >
              <span className="flex items-center gap-2 text-xs font-bold text-text-muted uppercase tracking-wider">
                <Database className="w-3.5 h-3.5 text-accent" />
                Media Pool
                <span className="text-[10px] font-normal normal-case text-text-muted/70">
                  ({historyList.length} clip{historyList.length !== 1 ? 's' : ''})
                </span>
              </span>
              <div className="flex items-center gap-2">
                <label
                  onClick={e => e.stopPropagation()}
                  className="px-2 py-0.5 text-[10px] font-bold rounded bg-accent/20 border border-accent/40 text-accent hover:bg-accent hover:text-white cursor-pointer transition-all flex items-center gap-1"
                  title="Import audio or video file into Media Pool"
                >
                  <FilePlus className="w-3 h-3" /> Import
                  <input
                    type="file"
                    accept="audio/*,video/*"
                    multiple
                    className="hidden"
                    onChange={handleExternalMediaImport}
                  />
                </label>
                {mediaPoolOpen
                  ? <ChevronDown className="w-3.5 h-3.5 text-text-muted group-hover:text-text-primary transition-colors" />
                  : <ChevronUp className="w-3.5 h-3.5 text-text-muted group-hover:text-text-primary transition-colors" />
                }
              </div>
            </button>

            {/* Pool Content */}
            {mediaPoolOpen && (
              <div className="bg-bg-primary border-t border-border max-h-[280px] overflow-y-auto flex flex-col">

                {/* Target Track Selector */}
                {timelineTracks.length > 0 && (
                  <div className="px-3 pt-2.5 pb-2 border-b border-border bg-bg-secondary/60 shrink-0">
                    <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider block mb-1.5">
                      Target Track:
                    </label>
                    <select
                      value={mediaPoolTargetId || timelineTracks[0]?.id || ''}
                      onChange={e => setMediaPoolTargetId(e.target.value)}
                      className="w-full px-2 py-1.5 rounded-lg border border-border bg-surface text-text-primary text-xs focus:outline-none focus:border-accent"
                    >
                      {timelineTracks.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Clip List */}
                {historyList.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 px-4 gap-2 text-center">
                    <Database className="w-8 h-8 text-text-muted opacity-25" />
                    <p className="text-xs font-semibold text-text-secondary">No audio clips yet</p>
                    <p className="text-[11px] text-text-muted">
                      Generate speech in <strong>Script Editor</strong> or import files above.
                    </p>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                    {historyList.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-surface hover:border-accent/50 hover:bg-surface-hover transition-all group/item"
                      >
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                          style={{ background: 'rgba(108,71,255,0.15)', border: '1.5px solid rgba(108,71,255,0.4)' }}>
                          <Mic className="w-3.5 h-3.5 text-accent" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-semibold text-text-primary truncate">
                            {item.text.slice(0, 45) || 'Audio clip'}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Clock className="w-2.5 h-2.5 text-text-muted shrink-0" />
                            <span className="text-[10px] text-accent font-mono font-bold">{item.duration?.toFixed(1)}s</span>
                            <span className="text-[10px] text-text-muted">· {item.voice}</span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 shrink-0">
                          {/* Place on Timeline button */}
                          <button
                            title="Place on selected timeline track at playhead"
                            onClick={() => {
                              const trackId = mediaPoolTargetId || timelineTracks[0]?.id;
                              if (!trackId) {
                                showToast('Add a track first via Add Track button', 'info');
                                return;
                              }
                              addClipToTrack(trackId, {
                                filePath: '',
                                audioUrl: item.audio_url,
                                label: item.text.slice(0, 40) || 'Audio clip',
                                startTimeSec: timelinePlayheadSec,
                                durationSec: item.duration || 5,
                                volume: 1.0,
                                clipType: 'audio',
                              });
                              showToast(`Placed "${item.text.slice(0, 25)}…" on timeline`, 'success');
                            }}
                            className="p-1.5 rounded-lg bg-accent text-white hover:opacity-90 transition-all"
                          >
                            <ArrowRight className="w-3 h-3" />
                          </button>
                          {/* Use as Narration Marker button */}
                          <button
                            title="Select as narration marker clip"
                            onClick={() => {
                              setSelectedAudio(item.audio_url);
                              setSelectedAudioFilename(item.audio_url.split('/').pop() || '');
                              showToast('Clip selected — set start time and click Add Marker', 'success');
                            }}
                            className="p-1.5 rounded-lg bg-surface border border-border hover:border-accent text-text-muted hover:text-accent transition-all"
                          >
                            <Mic className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="px-3 py-2 border-t border-border bg-bg-secondary flex items-start gap-1.5 shrink-0">
                  <Info className="w-3 h-3 mt-0.5 shrink-0 text-accent" />
                  <span className="text-[10px] text-text-muted leading-relaxed">
                    <strong className="text-accent">→</strong> Place on Timeline track · <strong className="text-accent">🎤</strong> Use as Narration Marker
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Narration Picker & Export Settings */}
        {!sidebarCollapsed && (
          <div className="w-full lg:w-80 shrink-0 border-t lg:border-t-0 lg:border-l border-border bg-surface flex flex-col overflow-y-auto max-h-[50vh] lg:max-h-none">


            {/* Export Panel */}
            <div className="p-4 border-b border-border space-y-3">
              <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                <DownloadCloud className="w-3.5 h-3.5 text-accent" /> Advanced Export Settings
              </h3>

              {/* Preserve Original Audio + Auto Ducking */}
              <div className="space-y-2.5 border border-border/60 rounded-lg p-3 bg-bg-secondary">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preserveOriginal}
                    onChange={(e) => setVideoSyncSettings({ preserveOriginal: e.target.checked })}
                    className="rounded accent-[var(--color-accent)]"
                  />
                  <span className="text-xs font-semibold text-text-primary">Keep original video audio</span>
                </label>

                {preserveOriginal && (
                  <>
                    <div className="flex items-center gap-2 pt-0.5">
                      <Volume2 className="w-3.5 h-3.5 text-text-muted shrink-0" />
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={origVolume}
                        onChange={(e) => setVideoSyncSettings({ origVolume: parseFloat(e.target.value) })}
                        className="flex-1 h-1 accent-[var(--color-accent)]"
                      />
                      <span className="text-xs font-mono text-text-muted w-8 text-right">
                        {Math.round(origVolume * 100)}%
                      </span>
                    </div>

                    {/* Auto-Ducking Switch */}
                    <label className="flex items-center gap-2 cursor-pointer pt-1 border-t border-border/40">
                      <input
                        type="checkbox"
                        checked={autoDucking}
                        onChange={(e) => setVideoSyncSettings({ autoDucking: e.target.checked })}
                        className="rounded accent-[var(--color-accent)]"
                      />
                      <span className="text-xs text-text-secondary">🤖 Auto-duck background audio during narration</span>
                    </label>
                  </>
                )}
              </div>

              {/* Burn-In Subtitles Switch */}
              <div className="border border-border/60 rounded-lg p-3 bg-bg-secondary">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={burnSubtitles}
                    onChange={(e) => setVideoSyncSettings({ burnSubtitles: e.target.checked })}
                    className="rounded accent-[var(--color-accent)]"
                  />
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-text-primary">
                    <Subtitles className="w-3.5 h-3.5 text-accent" /> Burn Subtitles into Video
                  </div>
                </label>
              </div>

              {!videoSyncSource && (
                <div className="flex items-center gap-1.5 text-xs text-yellow-400">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  Import a video file first
                </div>
              )}

              <button
                onClick={handleExport}
                disabled={isExporting || !videoSyncSource || markers.length === 0}
                className="w-full py-2.5 rounded-button text-xs font-bold border-2 border-text-primary bg-accent text-white shadow-neo-sm hover:translate-y-[-1px] active:translate-y-0 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {isExporting ? (
                  <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> {exportProgress || 'Rendering…'}</>
                ) : (
                  <><DownloadCloud className="w-4 h-4" /> Export MP4 ({markers.length} narrations)</>
                )}
              </button>

              {exportUrl && (
                <a
                  href={exportUrl}
                  download
                  className="flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded-button text-xs font-bold border-2 border-green-500 text-green-400 bg-green-500/10 hover:bg-green-500/20 transition-all shadow-sm"
                >
                  <CheckCircle2 className="w-4 h-4" /> Download Exported MP4
                </a>
              )}
            </div>

            {/* Quick Guide */}
            <div className="p-4 text-xs text-text-muted space-y-2">
              <div className="font-semibold text-text-secondary">Shortcuts & Features:</div>
              <ul className="space-y-1 text-[11px] opacity-80 list-disc list-inside">
                <li><kbd className="px-1 bg-border/50 rounded font-mono">S</kbd> Split selected marker at playhead</li>
                <li><kbd className="px-1 bg-border/50 rounded font-mono">Ctrl+D</kbd> Duplicate selected marker</li>
                <li><kbd className="px-1 bg-border/50 rounded font-mono">[</kbd> / <kbd className="px-1 bg-border/50 rounded font-mono">]</kbd> Set Loop A & B points</li>
                <li><kbd className="px-1 bg-border/50 rounded font-mono">L</kbd> Toggle A-B region looping</li>
                <li>Import external media directly into Video Sync</li>
                <li>Inspector bar for clip gain & speed controls</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoSyncView;
