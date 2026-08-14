import React, { useRef, useEffect, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { useStudioStore, TimelineTrack, TimelineClip } from '@/store/useStudioStore';
import {
  Plus, Trash2, Music, Mic, Layers, Radio,
  DownloadCloud, ZoomIn, ZoomOut, ChevronDown,
  Play, Pause, SkipBack, Volume2, Film,
  Info, Clock, FileAudio, ArrowRight, ListMusic,
  GripHorizontal, AlertCircle, Upload, Scissors,
  Copy, FastForward, ArrowUp, ArrowDown, MoveRight,
  FilePlus, Sparkles, Tag, Subtitles
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const HEADER_W    = 270;
const TRACK_H     = 88;
const MIN_PPS     = 20;
const MAX_PPS     = 200;
const DEFAULT_PPS = 60;
const SNAP_SEC    = 0.25;

const COLORS: Record<string, string> = {
  narration: '#6c47ff',
  music:     '#00c896',
  sfx:       '#f59e0b',
  video:     '#3b82f6',
  custom:    '#8b5cf6',
  captions:  '#ec4899',
};
const BG: Record<string, string> = {
  narration: 'rgba(108,71,255,0.14)',
  music:     'rgba(0,200,150,0.14)',
  sfx:       'rgba(245,158,11,0.14)',
  video:     'rgba(59,130,246,0.14)',
  custom:    'rgba(139,92,246,0.14)',
  captions:  'rgba(236,72,153,0.14)',
};
const ICONS: Record<string, React.ElementType> = {
  narration: Mic,
  music:     Music,
  sfx:       Radio,
  video:     Film,
  custom:    FileAudio,
  captions:  Subtitles,
};
const LABELS: Record<string, string> = {
  narration: 'Narration Track',
  music:     'Background Music',
  sfx:       'Sound Effects',
  video:     'Video Track',
  custom:    'Custom Audio',
  captions:  'Subtitles / Captions',
};

const fmt = (s: number) => {
  if (isNaN(s) || s < 0) s = 0;
  const m  = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.floor((s % 1) * 10);
  return `${m}:${String(sec).padStart(2, '0')}.${ms}`;
};

// ─── Add Track Portal Menu (CapCut Multi-Track System) ────────────────────────

const AddTrackMenu: React.FC<{ onAdd: (t: TimelineTrack['type']) => void }> = ({ onAdd }) => {
  const [open, setOpen] = useState(false);
  const [pos,  setPos]  = useState<{ top: number; right: number } | null>(null);
  const btnRef  = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const openMenu = () => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    const menuHeight = 320; // approximate max height of the menu
    if (spaceBelow < menuHeight) {
      // flip upward
      setPos({ top: r.top - menuHeight - 6, right: window.innerWidth - r.right });
    } else {
      setPos({ top: r.bottom + 6, right: window.innerWidth - r.right });
    }
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!btnRef.current?.contains(e.target as Node) && !menuRef.current?.contains(e.target as Node))
        setOpen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  const types: TimelineTrack['type'][] = ['narration', 'music', 'sfx', 'video', 'custom', 'captions'];

  return (
    <>
      <button
        ref={btnRef}
        onClick={open ? () => setOpen(false) : openMenu}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
          open ? 'bg-accent text-white border-accent shadow-sm'
               : 'bg-surface border-border text-text-secondary hover:text-text-primary hover:border-accent/50 hover:bg-surface-hover'
        }`}
      >
        <Plus className="w-3.5 h-3.5" />
        Add Track
        <ChevronDown className={`w-3 h-3 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && pos && ReactDOM.createPortal(
        <div
          ref={menuRef}
          className="fixed bg-surface border-2 border-border rounded-xl shadow-neo overflow-y-auto w-60"
          style={{ top: pos.top, right: pos.right, zIndex: 99999, maxHeight: '80vh' }}
        >
          <div className="px-3 py-2 border-b border-border text-[10px] font-bold text-text-muted uppercase tracking-widest flex items-center justify-between">
            <span>Select Track Type</span>
            <Sparkles className="w-3 h-3 text-amber-400" />
          </div>
          {types.map(type => {
            const Icon  = ICONS[type];
            const color = COLORS[type];
            return (
              <button
                key={type}
                onClick={() => { onAdd(type); setOpen(false); }}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors border-b border-border/40 last:border-0"
              >
                <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: `${color}20`, border: `1.5px solid ${color}60` }}>
                  <Icon className="w-4 h-4" style={{ color }} />
                </span>
                <div className="text-left">
                  <div className="text-xs font-semibold">{LABELS[type]}</div>
                  <div className="text-[10px] text-text-muted">
                    {type === 'narration' ? 'Voice / speech clips'
                   : type === 'music'     ? 'Background music layers'
                   : type === 'sfx'       ? 'Sound effects & hits'
                   : type === 'video'     ? 'Video audio & movie clips'
                   : type === 'custom'    ? 'External uploaded audio'
                   : 'Subtitles & caption timing'}
                  </div>
                </div>
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </>
  );
};

// ─── Track Header (left fixed column cell) ────────────────────────────────────

const TrackHeader: React.FC<{ track: TimelineTrack; index: number; totalTracks: number }> = ({ track, index, totalTracks }) => {
  const { updateTimelineTrack, removeTimelineTrack, reorderTracks } = useStudioStore();
  const [editing, setEditing] = useState(false);
  const [name,    setName]    = useState(track.name);
  const Icon  = ICONS[track.type] || Mic;
  const color = COLORS[track.type] || '#6c47ff';

  const commit = () => {
    updateTimelineTrack(track.id, { name: name.trim() || track.name });
    setEditing(false);
  };

  return (
    <div
      className="flex flex-col justify-center gap-1.5 px-3 border-b border-border bg-surface shrink-0"
      style={{ height: TRACK_H, width: HEADER_W }}
    >
      {/* Row 1: icon + name + re-order + delete */}
      <div className="flex items-center gap-1.5">
        <span className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `${color}20`, border: `1.5px solid ${color}60` }}>
          <Icon className="w-3.5 h-3.5" style={{ color }} />
        </span>
        {editing ? (
          <input
            autoFocus value={name}
            onChange={e => setName(e.target.value)}
            onBlur={commit}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setName(track.name); setEditing(false); } }}
            className="flex-1 min-w-0 text-xs font-semibold bg-bg-secondary border border-accent rounded px-1.5 py-0.5 text-text-primary focus:outline-none"
          />
        ) : (
          <span
            className="flex-1 min-w-0 text-xs font-semibold text-text-primary truncate cursor-text"
            onDoubleClick={() => setEditing(true)}
            title="Double-click to rename track"
          >
            {track.name}
          </span>
        )}

        {/* Move Track Up/Down */}
        <div className="flex items-center gap-0.5">
          <button
            disabled={index === 0}
            onClick={() => reorderTracks(index, index - 1)}
            className="p-0.5 rounded text-text-muted hover:text-text-primary disabled:opacity-20"
            title="Move track up"
          >
            <ArrowUp className="w-3 h-3" />
          </button>
          <button
            disabled={index === totalTracks - 1}
            onClick={() => reorderTracks(index, index + 1)}
            className="p-0.5 rounded text-text-muted hover:text-text-primary disabled:opacity-20"
            title="Move track down"
          >
            <ArrowDown className="w-3 h-3" />
          </button>
        </div>

        <button onClick={() => removeTimelineTrack(track.id)}
          className="w-5 h-5 flex items-center justify-center rounded text-text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors shrink-0"
          title="Delete track">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {/* Row 2: M + volume */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => updateTimelineTrack(track.id, { muted: !track.muted })}
          className={`px-1.5 h-5 rounded text-[10px] font-bold border transition-colors shrink-0 ${
            track.muted
              ? 'bg-yellow-400/20 border-yellow-400/60 text-yellow-300'
              : 'border-border/60 text-text-muted hover:text-yellow-300 hover:border-yellow-400/50'
          }`}
          title={track.muted ? 'Unmute track' : 'Mute track'}
        >M</button>
        <Volume2 className="w-3 h-3 text-text-muted shrink-0" />
        <input
          type="range" min={0} max={1} step={0.02}
          value={track.volume}
          onChange={e => updateTimelineTrack(track.id, { volume: +e.target.value })}
          className="flex-1 h-1 cursor-pointer"
          style={{ accentColor: color }}
          title={`Volume ${Math.round(track.volume * 100)}%`}
        />
        <span className="text-[10px] font-mono text-text-primary font-bold w-9 text-right shrink-0">
          {Math.round(track.volume * 100)}%
        </span>
      </div>
    </div>
  );
};

// ─── Track Lane (clip canvas with Video & Audio clip rendering) ───────────────

const TrackLane: React.FC<{
  track: TimelineTrack;
  pps: number;
  totalSec: number;
  selectedClip: string | null;
  playheadSec: number;
  isPlaying: boolean;
  onSelectClip: (id: string) => void;
  onDblClick: (sec: number) => void;
}> = ({ track, pps, totalSec, selectedClip, playheadSec, isPlaying, onSelectClip, onDblClick }) => {
  const { removeClipFromTrack, updateClip } = useStudioStore();
  const color = COLORS[track.type] || '#6c47ff';

  return (
    <div
      className="relative border-b border-border overflow-visible"
      style={{
        height:   TRACK_H,
        width:    totalSec * pps,
        minWidth: totalSec * pps,
        background: track.muted ? 'rgba(0,0,0,0.18)' : undefined,
        cursor:   'crosshair',
      }}
      onDoubleClick={e => {
        const x = e.clientX - (e.currentTarget as HTMLDivElement).getBoundingClientRect().left;
        onDblClick(Math.max(0, Math.round((x / pps) / SNAP_SEC) * SNAP_SEC));
      }}
    >
      {/* 5s grid lines */}
      {Array.from({ length: Math.ceil(totalSec / 5) + 1 }, (_, i) => i * 5).map(s => (
        <div key={s} className="absolute top-0 bottom-0 border-l pointer-events-none"
          style={{ left: s * pps, borderColor: s % 30 === 0 ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)' }} />
      ))}

      {/* Clips */}
      {track.clips.map(clip => {
        const cwidth = Math.max(8, clip.durationSec * pps);
        const cleft  = clip.startTimeSec * pps;
        const bars   = Math.max(6, Math.floor(cwidth / 6));
        const isClipActive = isPlaying && !track.muted && playheadSec >= clip.startTimeSec && playheadSec <= (clip.startTimeSec + clip.durationSec);
        const dragRef = { current: null as { sx: number; orig: number } | null };
        const isVideoClip = clip.clipType === 'video' || track.type === 'video';

        const onMouseDown = (e: React.MouseEvent) => {
          if (e.button !== 0) return;
          e.preventDefault(); e.stopPropagation();
          onSelectClip(clip.id);
          dragRef.current = { sx: e.clientX, orig: clip.startTimeSec };

          const move = (ev: MouseEvent) => {
            if (!dragRef.current) return;
            const raw  = dragRef.current.orig + (ev.clientX - dragRef.current.sx) / pps;
            const snap = Math.round(Math.max(0, raw) / SNAP_SEC) * SNAP_SEC;
            updateClip(track.id, clip.id, { startTimeSec: Math.round(snap * 100) / 100 });
          };
          const up = () => {
            dragRef.current = null;
            window.removeEventListener('mousemove', move);
            window.removeEventListener('mouseup', up);
          };
          window.addEventListener('mousemove', move);
          window.addEventListener('mouseup', up);
        };

        const cfIn  = clip.crossfadeInSec  || 0;
        const cfOut = clip.crossfadeOutSec || 0;

        return (
          <div
            key={clip.id}
            onMouseDown={onMouseDown}
            className={`absolute top-2 bottom-2 rounded-lg overflow-hidden flex flex-col select-none group cursor-grab active:cursor-grabbing hover:shadow-lg transition-all ${
              selectedClip === clip.id ? 'ring-2 ring-white/80 ring-offset-1 z-20 shadow-md' : 'z-10'
            } ${isClipActive ? 'ring-2 ring-emerald-400 animate-pulse' : ''}`}
            style={{
              left:   cleft,
              width:  cwidth,
              background: isVideoClip
                ? `repeating-linear-gradient(45deg, ${BG[track.type]}, ${BG[track.type]} 6px, rgba(0,0,0,0.12) 6px, rgba(0,0,0,0.12) 12px)`
                : BG[track.type],
              borderLeft:   `3px solid ${color}`,
              border:       `1px solid ${color}50`,
              borderLeftWidth: '3px',
              borderLeftColor: color,
            }}
            title={`${clip.label}\n${fmt(clip.startTimeSec)} → ${fmt(clip.startTimeSec + clip.durationSec)}${isVideoClip ? ' [VIDEO]' : ''}`}
          >
            {/* Crossfade-In gradient overlay (left edge) */}
            {cfIn > 0 && cwidth > 20 && (
              <div
                className="absolute top-0 bottom-0 left-0 pointer-events-none z-10"
                style={{
                  width: Math.min(cfIn * pps, cwidth * 0.5),
                  background: `linear-gradient(to right, ${color}88, transparent)`,
                }}
              />
            )}
            {/* Crossfade-Out gradient overlay (right edge) */}
            {cfOut > 0 && cwidth > 20 && (
              <div
                className="absolute top-0 bottom-0 right-0 pointer-events-none z-10"
                style={{
                  width: Math.min(cfOut * pps, cwidth * 0.5),
                  background: `linear-gradient(to left, ${color}88, transparent)`,
                }}
              />
            )}

            {/* Label strip */}
            <div className="px-2 py-0.5 text-[10px] font-bold truncate shrink-0 flex items-center justify-between"
              style={{ background: `${color}30`, color }}>
              <div className="flex items-center gap-1 truncate">
                <GripHorizontal className="w-2.5 h-2.5 opacity-60 shrink-0" />
                {isVideoClip && <Film className="w-2.5 h-2.5 shrink-0 text-blue-400" />}
                <span className="truncate">{clip.label}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {(cfIn > 0 || cfOut > 0) && (
                  <span className="text-[9px] font-mono bg-black/40 px-1 rounded" title="Crossfade active">⟺</span>
                )}
                {clip.speed && clip.speed !== 1.0 && (
                  <span className="text-[9px] font-mono bg-black/30 px-1 rounded">{clip.speed}x</span>
                )}
              </div>
            </div>

            {/* Video clip: checkerboard film strip frames OR audio waveform bars */}
            <div className="flex-1 flex items-end gap-px px-1 pb-1 overflow-hidden relative">
              {isVideoClip ? (
                // Film strip visual for video clips
                <div className="absolute inset-0 flex items-center">
                  {clip.videoUrl ? (
                    <video
                      src={clip.videoUrl}
                      className="w-full h-full object-cover opacity-50 pointer-events-none"
                      muted
                      preload="metadata"
                    />
                  ) : (
                    // Film-strip checkerboard pattern when no src available
                    <div className="w-full h-full flex items-center justify-center">
                      <Film className="w-4 h-4 opacity-50" style={{ color }} />
                      <div className="absolute inset-0 flex">
                        {Array.from({ length: Math.max(2, Math.floor(cwidth / 20)) }).map((_, fi) => (
                          <div key={fi} className="flex-1 border-r border-black/20 flex items-center justify-center">
                            <div className="w-2 h-3 rounded-sm opacity-20" style={{ background: color }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                // Audio waveform bars
                Array.from({ length: bars }).map((_, i) => (
                  <div key={i} className="flex-1 min-w-0 rounded-sm"
                    style={{ background: color, opacity: isClipActive ? 0.8 : 0.4,
                      height: `${25 + Math.abs(Math.sin(i * 0.9 + clip.id.charCodeAt(0) * 0.3)) * 60}%` }} />
                ))
              )}
            </div>

            {/* Duration chip */}
            {cwidth > 52 && (
              <div className="absolute bottom-1 right-1.5 text-[9px] font-mono opacity-70 pointer-events-none" style={{ color }}>
                {clip.durationSec.toFixed(1)}s
              </div>
            )}

            {/* Delete button */}
            <button
              onMouseDown={e => { e.stopPropagation(); removeClipFromTrack(track.id, clip.id); }}
              className="absolute top-0.5 right-0.5 w-4 h-4 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/60 text-white/80 hover:text-red-400 transition-opacity"
              title="Delete clip"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
};


// ─── Time Ruler ───────────────────────────────────────────────────────────────

const Ruler: React.FC<{
  pps: number;
  totalSec: number;
  maxContentEnd: number;
  playheadSec: number;
  onClick: (sec: number) => void;
}> = ({ pps, totalSec, maxContentEnd, playheadSec, onClick }) => {
  const stepSec = pps < 35 ? 10 : pps < 80 ? 5 : 1;

  return (
    <div
      className="relative h-8 border-b-2 border-border bg-bg-secondary select-none cursor-pointer overflow-hidden"
      style={{ width: totalSec * pps }}
      onClick={e => {
        const x = e.clientX - (e.currentTarget as HTMLDivElement).getBoundingClientRect().left;
        onClick(Math.max(0, x / pps));
      }}
    >
      {Array.from({ length: Math.floor(totalSec / stepSec) + 1 }).map((_, i) => {
        const sec = i * stepSec;
        const isMajor = sec % 10 === 0;
        return (
          <div key={sec} className="absolute bottom-0 border-l border-text-muted/30"
            style={{ left: sec * pps, height: isMajor ? 12 : 6 }}>
            {isMajor && (
              <span className="absolute bottom-3 left-1 text-[9px] font-mono text-text-muted pointer-events-none">
                {fmt(sec)}
              </span>
            )}
          </div>
        );
      })}

      {/* Content bounds marker */}
      {maxContentEnd > 0 && (
        <div className="absolute top-0 bottom-0 border-l border-amber-400/60 z-10 pointer-events-none"
          style={{ left: maxContentEnd * pps }}>
          <span className="text-[9px] font-mono text-amber-400 bg-amber-400/10 px-1 rounded absolute top-0.5 right-0.5">
            END {fmt(maxContentEnd)}
          </span>
        </div>
      )}

      {/* Seek handle on ruler */}
      <div className="absolute top-0 bottom-0 w-0.5 bg-accent z-20 pointer-events-none"
        style={{ left: playheadSec * pps }}>
        <div className="w-2.5 h-2.5 bg-accent rounded-full -ml-[4px] -mt-1 shadow" />
      </div>
    </div>
  );
};

// ─── Media Pool Panel (with External File Import & Drag-Drop) ──────────────────

const MediaPool: React.FC<{
  tracks: TimelineTrack[];
  playheadSec: number;
  onPlace: (trackId: string, startSec: number, audioUrl: string, label: string, dur: number) => void;
}> = ({ tracks, playheadSec, onPlace }) => {
  const { historyList, fetchHistory, addTimelineTrack, addExternalFileToTimeline } = useStudioStore();
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [targetId,    setTargetId]    = useState<string>('');

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  useEffect(() => {
    if (tracks.length > 0 && !targetId) {
      setTargetId(tracks[0].id);
    }
  }, [tracks, targetId]);

  const place = (idx: number) => {
    const item = historyList[idx];
    if (!item) return;
    const track = tracks.find(t => t.id === targetId) || tracks[0];
    if (!track) return;
    onPlace(track.id, playheadSec, item.audio_url, item.text.slice(0, 40) || 'Audio clip', item.duration || 5);
  };

  const handleExternalFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    for (let i = 0; i < files.length; i++) {
      await addExternalFileToTimeline(files[i], targetId || undefined, playheadSec);
    }
  };

  return (
    <div className="w-72 border-l border-border bg-surface flex flex-col shrink-0 overflow-hidden">
      <div className="p-3 border-b border-border flex items-center justify-between bg-bg-secondary">
        <div className="flex items-center gap-2">
          <FileAudio className="w-4 h-4 text-accent" />
          <span className="font-bold text-xs text-text-primary">Media Pool</span>
        </div>
        <label className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-accent text-white hover:opacity-90 transition-opacity cursor-pointer flex items-center gap-1 shadow-sm">
          <FilePlus className="w-3 h-3" /> Import File
          <input type="file" accept="audio/*,video/*" multiple className="hidden" onChange={handleExternalFileUpload} />
        </label>
      </div>

      {tracks.length > 0 && (
        <div className="p-2 border-b border-border bg-bg-secondary/50">
          <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider block mb-1">
            Target Track:
          </label>
          <select
            value={targetId}
            onChange={e => setTargetId(e.target.value)}
            className="w-full px-2 py-1.5 rounded-lg border border-border bg-surface text-text-primary text-xs focus:outline-none focus:border-accent"
          >
            {tracks.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Clip list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {historyList.length === 0 ? (
          <div className="text-center py-10 px-3">
            <FileAudio className="w-8 h-8 mx-auto mb-2 text-text-muted opacity-25" />
            <p className="text-xs font-semibold text-text-secondary">No audio clips available</p>
            <p className="text-[11px] text-text-muted mt-1 leading-tight mb-3">
              Generate speech in <strong>Script Editor</strong> or import external files above.
            </p>
            <label className="px-3 py-1.5 text-xs font-bold rounded-lg border border-accent text-accent hover:bg-accent/10 cursor-pointer inline-flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5" /> Import Audio/Video
              <input type="file" accept="audio/*,video/*" multiple className="hidden" onChange={handleExternalFileUpload} />
            </label>
          </div>
        ) : (
          historyList.map((item, idx) => (
            <div
              key={item.id}
              onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
              className={`rounded-xl border p-2.5 cursor-pointer transition-all ${
                expandedIdx === idx
                  ? 'border-accent/60 bg-accent/10'
                  : 'border-border bg-bg-secondary hover:border-accent/40 hover:bg-surface'
              }`}
            >
              <div className="flex items-start gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: '#6c47ff20', border: '1.5px solid #6c47ff50' }}>
                  <Mic className="w-4 h-4 text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-text-primary leading-tight line-clamp-2">
                    {item.text.slice(0, 50) || 'Audio clip'}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <Clock className="w-2.5 h-2.5 text-text-muted shrink-0" />
                    <span className="text-[10px] text-accent font-mono font-bold">{item.duration?.toFixed(1)}s</span>
                    <span className="text-[10px] text-text-muted">· {item.voice}</span>
                  </div>
                </div>
              </div>

              {expandedIdx === idx && (
                <div className="mt-2 pt-2 border-t border-border/50">
                  {tracks.length === 0 ? (
                    <button
                      onClick={e => { e.stopPropagation(); addTimelineTrack('narration'); }}
                      className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-accent text-white text-[11px] font-bold hover:opacity-90 transition-opacity"
                    >
                      <Plus className="w-3 h-3" /> Create Track & Add
                    </button>
                  ) : (
                    <button
                      onClick={e => { e.stopPropagation(); place(idx); }}
                      className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-accent text-white text-[11px] font-bold hover:opacity-90 transition-opacity"
                    >
                      <ArrowRight className="w-3 h-3" /> Place on Timeline
                    </button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Tip */}
      <div className="px-3 py-2.5 border-t border-border bg-bg-secondary shrink-0">
        <div className="flex items-start gap-1.5 text-[10px] text-text-muted">
          <Info className="w-3 h-3 mt-0.5 shrink-0 text-accent" />
          <span className="leading-relaxed">
            Click clip → <strong className="text-text-secondary">Place on Timeline</strong> or use <strong className="text-text-secondary">Import File</strong>.
          </span>
        </div>
      </div>
    </div>
  );
};

// ─── Empty / How-To Guide ─────────────────────────────────────────────────────

const HowToGuide: React.FC<{ onAdd: (t: TimelineTrack['type']) => void }> = ({ onAdd }) => (
  <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center">
    <div className="max-w-xl w-full my-auto py-2">
      <div className="text-center mb-3">
        <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/30 flex items-center justify-center mx-auto mb-2">
          <Layers className="w-5 h-5 text-accent" />
        </div>
        <h3 className="text-sm font-bold text-text-primary">CapCut-Style Multi-Track DAW Timeline</h3>
        <p className="text-xs text-text-muted mt-0.5">
          Layer narration, background music, video audio, SFX, and external files.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
        {[
          { n: '1', icon: Mic,          color: '#6c47ff', title: 'Generate speech or import media', desc: 'Synthesize voice clips or import external MP3/MP4 files.' },
          { n: '2', icon: Plus,         color: '#00c896', title: 'Add tracks',       desc: 'Click "Add Track" above → choose Narration, Music, Video, or Custom.' },
          { n: '3', icon: Scissors,     color: '#f59e0b', title: 'Split & Edit clips', desc: 'Select clip → press "S" to split. Duplicate with Ctrl+D.' },
          { n: '4', icon: DownloadCloud,color: '#3b82f6', title: 'Render master mix',desc: 'Render multi-track timeline audio into a WAV master file.' },
        ].map(({ n, color, title, desc }) => (
          <div key={n} className="flex gap-2.5 p-2.5 rounded-lg border border-border bg-surface">
            <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 text-xs font-bold"
              style={{ background: `${color}18`, color, border: `1.5px solid ${color}55` }}>
              {n}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-text-primary truncate">{title}</p>
              <p className="text-[11px] text-text-muted mt-0.5 leading-tight">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-center text-text-muted mb-2 font-medium">Click to create your first track:</p>
      <div className="flex justify-center gap-1.5 flex-wrap">
        {(['narration', 'music', 'video', 'sfx'] as const).map(type => {
          const Icon  = ICONS[type];
          const color = COLORS[type];
          return (
            <button key={type} onClick={() => onAdd(type)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface hover:border-accent/60 hover:bg-surface-hover transition-all text-xs font-semibold text-text-secondary hover:text-text-primary">
              <span className="w-5 h-5 rounded flex items-center justify-center shrink-0"
                style={{ background: `${color}20`, border: `1px solid ${color}60` }}>
                <Icon className="w-3 h-3" style={{ color }} />
              </span>
              {LABELS[type]}
            </button>
          );
        })}
      </div>
    </div>
  </div>
);

// ─── Main TimelineView ────────────────────────────────────────────────────────

interface TimelineViewProps {
  showMediaPool?: boolean;
  showToolbarAddTrack?: boolean;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  showMediaPool = true,
  showToolbarAddTrack = true,
}) => {
  const {
    timelineTracks, timelinePlayheadSec, setTimelinePlayhead,
    addTimelineTrack, addClipToTrack, duplicateClip, updateClip, moveClipToTrack,
    addExternalFileToTimeline, renderTimeline, showToast,
    historyList
  } = useStudioStore();

  const [pps,          setPps]          = useState(DEFAULT_PPS);
  const [selectedClip, setSelectedClip] = useState<string | null>(null);
  const [isRendering,  setIsRendering]  = useState(false);
  const [isPlaying,    setIsPlaying]    = useState(false);
  const [timelineLengthSec, setTimelineLengthSec] = useState(300); // 5 minute default canvas workspace

  const headersRef  = useRef<HTMLDivElement>(null);
  const lanesRef    = useRef<HTMLDivElement>(null);
  const rafRef      = useRef<number | null>(null);
  const playStart   = useRef<{ wall: number; playheadStart: number } | null>(null);
  const audioNodes  = useRef<Map<string, HTMLAudioElement>>(new Map());
  const timerIdsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Find active clip object if any selected
  const selectedClipObj = timelineTracks.flatMap(t => t.clips).find(c => c.id === selectedClip);
  const selectedClipTrack = timelineTracks.find(t => t.clips.some(c => c.id === selectedClip));

  // Calculate actual content bounds from unmuted clips
  const allClips = timelineTracks.flatMap(t => t.clips);
  const activeClips = timelineTracks.filter(t => !t.muted).flatMap(t => t.clips);
  const maxContentEnd = activeClips.length > 0
    ? Math.max(...activeClips.map(c => c.startTimeSec + c.durationSec))
    : allClips.length > 0
    ? Math.max(...allClips.map(c => c.startTimeSec + c.durationSec))
    : 0;

  const totalSec = Math.max(timelineLengthSec, maxContentEnd + 60);
  const totalClips = allClips.length;

  const handleLanesScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (headersRef.current) {
      headersRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  const stopAllAudioNodes = useCallback(() => {
    timerIdsRef.current.forEach(t => clearTimeout(t));
    timerIdsRef.current = [];
    audioNodes.current.forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });
    audioNodes.current.clear();
  }, []);

  const stopPlay = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    playStart.current = null;
    stopAllAudioNodes();
    setIsPlaying(false);
  }, [stopAllAudioNodes]);

  const startPlay = useCallback(() => {
    if (totalClips === 0) {
      showToast('Add audio or video clips to timeline before playing', 'info');
      return;
    }

    if (maxContentEnd <= 0) {
      showToast('No audio content to play', 'info');
      return;
    }

    let startAtSec = timelinePlayheadSec;
    if (startAtSec >= maxContentEnd) {
      startAtSec = 0;
      setTimelinePlayhead(0);
    }

    stopAllAudioNodes();

    const activeTracksMap = new Map(timelineTracks.map(t => [t.id, t]));

    allClips.forEach(clip => {
      const track = activeTracksMap.get(clip.trackId);
      if (!track || track.muted) return;
      if (!clip.audioUrl) return;

      const clipStart = clip.startTimeSec;
      const clipEnd   = clipStart + clip.durationSec;

      if (clipEnd > startAtSec) {
        const audio = new Audio(clip.audioUrl);
        audio.volume = Math.max(0, Math.min(1, (clip.volume ?? 1.0) * track.volume));
        if (clip.speed) audio.playbackRate = clip.speed;

        const offsetInPlaybackSec = Math.max(0, clipStart - startAtSec);
        const offsetInClipSec     = Math.max(0, startAtSec - clipStart);

        if (offsetInPlaybackSec === 0) {
          audio.currentTime = offsetInClipSec;
          audio.play().catch(() => {});
        } else {
          const timerId = setTimeout(() => {
            if (playStart.current) {
              audio.currentTime = 0;
              audio.play().catch(() => {});
            }
          }, offsetInPlaybackSec * 1000);
          timerIdsRef.current.push(timerId);
        }

        audioNodes.current.set(clip.id, audio);
      }
    });

    playStart.current = { wall: performance.now(), playheadStart: startAtSec };
    setIsPlaying(true);

    const tick = () => {
      if (!playStart.current) return;
      const elapsed = (performance.now() - playStart.current.wall) / 1000;
      const currentPos = playStart.current.playheadStart + elapsed;

      if (currentPos >= maxContentEnd) {
        stopPlay();
        setTimelinePlayhead(0);
        return;
      }

      setTimelinePlayhead(currentPos);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [totalClips, maxContentEnd, timelinePlayheadSec, timelineTracks, allClips, setTimelinePlayhead, stopPlay, stopAllAudioNodes, showToast]);

  const splitSelectedClip = useCallback(() => {
    const { splitClip, timelineTracks } = useStudioStore.getState();

    // 1. If a clip is explicitly selected, split it
    if (selectedClip && selectedClipTrack) {
      splitClip(selectedClipTrack.id, selectedClip, timelinePlayheadSec);
      return;
    }

    // 2. Otherwise auto-detect whichever clip (video or audio) is under playhead
    let targetTrack: TimelineTrack | null = null;
    let targetClip: TimelineClip | null = null;

    for (const tr of timelineTracks) {
      const found = tr.clips.find(c => timelinePlayheadSec > c.startTimeSec + 0.05 && timelinePlayheadSec < (c.startTimeSec + c.durationSec) - 0.05);
      if (found) {
        if (tr.type === 'video' || found.clipType === 'video' || !targetClip) {
          targetTrack = tr;
          targetClip = found;
        }
      }
    }

    if (targetTrack && targetClip) {
      splitClip(targetTrack.id, targetClip.id, timelinePlayheadSec);
      setSelectedClip(targetClip.id);
      return;
    }

    showToast('Position playhead over a clip to split (S)', 'info');
  }, [selectedClip, selectedClipTrack, timelinePlayheadSec, showToast]);

  // Keyboard Shortcuts (Space = play/pause, Delete = remove, S = split, Ctrl+D = duplicate)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (isPlaying) stopPlay();
        else startPlay();
      }

      if (e.code === 'KeyS') {
        e.preventDefault();
        splitSelectedClip();
      }

      if (e.ctrlKey && e.code === 'KeyD' && selectedClip && selectedClipTrack) {
        e.preventDefault();
        duplicateClip(selectedClipTrack.id, selectedClip);
      }

      if ((e.code === 'Delete' || e.code === 'Backspace') && selectedClip) {
        const ownerTrack = timelineTracks.find(t => t.clips.some(c => c.id === selectedClip));
        if (ownerTrack) {
          useStudioStore.getState().removeClipFromTrack(ownerTrack.id, selectedClip);
          setSelectedClip(null);
          showToast('Clip removed', 'info');
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, startPlay, stopPlay, selectedClip, timelineTracks, showToast, splitSelectedClip, duplicateClip, selectedClipTrack]);

  useEffect(() => () => {
    stopPlay();
  }, [stopPlay]);

  const placeClip = (trackId: string, startSec: number, audioUrl: string, label: string, dur: number) => {
    addClipToTrack(trackId, { filePath: '', audioUrl, label, startTimeSec: startSec, durationSec: dur, volume: 1.0 });
  };

  const handleLaneDoubleClick = (trackId: string, sec: number) => {
    if (historyList.length > 0) {
      const item = historyList[0];
      placeClip(trackId, sec, item.audio_url, item.text.slice(0, 40) || 'Audio Clip', item.duration || 5);
      showToast(`Placed clip at ${fmt(sec)}`, 'success');
    } else {
      showToast('Generate speech in Script Editor or import external file first', 'info');
    }
  };

  const handleExternalImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    for (let i = 0; i < files.length; i++) {
      await addExternalFileToTimeline(files[i], selectedClipTrack?.id || undefined, timelinePlayheadSec);
    }
  };

  const handleRender = async () => {
    if (totalClips === 0) {
      showToast('Add clips to timeline before rendering mix', 'error');
      return;
    }
    stopPlay();
    setIsRendering(true);
    await renderTimeline();
    setIsRendering(false);
  };

  return (
    <div className="flex flex-col h-full bg-bg-primary overflow-hidden">

      {/* ── Toolbar ───────────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-border bg-surface flex flex-wrap items-center gap-2 px-4 py-2.5 z-10">
        <div className="flex items-center gap-2">
          <ListMusic className="w-5 h-5 text-accent" />
          <span className="font-bold text-text-primary text-sm whitespace-nowrap">CapCut DAW Studio</span>
        </div>

        {/* Transport & Tools */}
        <div className="flex items-center gap-1 bg-bg-secondary border border-border rounded-lg px-1.5 py-1">
          <button
            onClick={() => { stopPlay(); setTimelinePlayhead(0); }}
            className="w-6 h-6 flex items-center justify-center rounded text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
            title="Return playhead to 0:00"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={isPlaying ? stopPlay : startPlay}
            className={`w-7 h-7 flex items-center justify-center rounded-md transition-all ${
              isPlaying ? 'bg-accent text-white shadow-sm' : 'text-text-primary hover:bg-surface hover:text-accent'
            }`}
            title={isPlaying ? 'Pause timeline playback' : 'Play timeline audio'}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
          </button>

          <div className="w-px h-3.5 bg-border mx-0.5" />

          {/* Split Clip Button */}
          <button
            onClick={splitSelectedClip}
            disabled={!selectedClip}
            className="px-2 py-1 flex items-center gap-1 rounded text-xs font-semibold text-text-primary hover:bg-surface hover:text-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Split selected clip at playhead (S)"
          >
            <Scissors className="w-3.5 h-3.5 text-accent" />
            <span className="hidden sm:inline">Split</span>
          </button>

          {/* Duplicate Clip Button */}
          <button
            onClick={() => selectedClip && selectedClipTrack && duplicateClip(selectedClipTrack.id, selectedClip)}
            disabled={!selectedClip}
            className="px-2 py-1 flex items-center gap-1 rounded text-xs font-semibold text-text-primary hover:bg-surface hover:text-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Duplicate selected clip (Ctrl+D)"
          >
            <Copy className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Duplicate</span>
          </button>
        </div>

        <span className="text-xs font-mono text-accent bg-bg-secondary border border-border px-2.5 py-1 rounded-lg tabular-nums">
          {fmt(timelinePlayheadSec)}
        </span>

        {/* Zoom & Canvas Extension */}
        <div className="flex items-center gap-1 bg-bg-secondary border border-border rounded-lg px-1.5 py-1">
          <button
            onClick={() => setPps(p => Math.max(MIN_PPS, p / 1.35))}
            disabled={pps <= MIN_PPS}
            className="w-6 h-6 flex items-center justify-center rounded text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors disabled:opacity-30"
            title="Zoom out timeline"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] font-mono text-text-muted w-12 text-center select-none">{Math.round(pps)}px/s</span>
          <button
            onClick={() => setPps(p => Math.min(MAX_PPS, p * 1.35))}
            disabled={pps >= MAX_PPS}
            className="w-6 h-6 flex items-center justify-center rounded text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors disabled:opacity-30"
            title="Zoom in timeline"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-3 bg-border mx-0.5" />
          <button
            onClick={() => {
              setTimelineLengthSec(prev => prev + 300);
              showToast('Timeline expanded by +5 minutes', 'success');
            }}
            className="px-2 py-0.5 text-[10px] font-bold text-accent hover:bg-accent/10 rounded transition-colors"
            title="Add 5 minutes of empty workspace to timeline"
          >
            + 5 Min
          </button>
        </div>

        {/* Import Media Button */}
        <label className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-border bg-bg-secondary text-text-primary hover:border-accent cursor-pointer transition-all flex items-center gap-1.5 shadow-sm">
          <Upload className="w-3.5 h-3.5 text-accent" />
          Import File
          <input type="file" accept="audio/*,video/*" multiple className="hidden" onChange={handleExternalImport} />
        </label>

        <span className="text-[11px] text-text-muted font-mono bg-bg-secondary border border-border px-2.5 py-1 rounded-lg hidden lg:block">
          {timelineTracks.length} tracks · {totalClips} clips · End: {fmt(maxContentEnd)}
        </span>

        <div className="flex-1" />

        {showToolbarAddTrack && <AddTrackMenu onAdd={addTimelineTrack} />}

        <button
          onClick={handleRender}
          disabled={isRendering || totalClips === 0}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-accent text-white border-2 border-text-primary shadow-sm hover:-translate-y-px active:translate-y-0 transition-all disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {isRendering
            ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Mixing…</>
            : <><DownloadCloud className="w-3.5 h-3.5" /> Render Mix</>}
        </button>
      </div>

      {/* ── Contextual Clip Inspector Bar (When clip selected) ──────────────── */}
      {selectedClipObj && selectedClipTrack && (
        <div className="shrink-0 border-b border-border bg-accent/5 px-4 py-2 flex items-center gap-3 flex-wrap text-xs z-15 animate-fadeIn">
          <div className="flex items-center gap-1.5 font-bold text-accent">
            <Tag className="w-3.5 h-3.5" />
            <span className="truncate max-w-[160px]">{selectedClipObj.label}</span>
          </div>

          {/* Volume Control */}
          <div className="flex items-center gap-1.5 border-l border-border/60 pl-3">
            <Volume2 className="w-3.5 h-3.5 text-text-muted shrink-0" />
            <span className="text-text-muted text-[11px]">Vol:</span>
            <input
              type="range" min="0" max="2" step="0.05"
              value={selectedClipObj.volume}
              onChange={e => updateClip(selectedClipTrack.id, selectedClipObj.id, { volume: parseFloat(e.target.value) })}
              className="w-20 h-1 accent-[var(--color-accent)] cursor-pointer"
            />
            <span className="font-mono text-text-muted text-[11px] w-8">{Math.round(selectedClipObj.volume * 100)}%</span>
          </div>

          {/* Speed Control */}
          <div className="flex items-center gap-1.5 border-l border-border/60 pl-3">
            <FastForward className="w-3.5 h-3.5 text-text-muted shrink-0" />
            <span className="text-text-muted text-[11px]">Speed:</span>
            <select
              value={selectedClipObj.speed || 1.0}
              onChange={e => updateClip(selectedClipTrack.id, selectedClipObj.id, { speed: parseFloat(e.target.value) })}
              className="px-1.5 py-0.5 rounded border border-border bg-surface text-text-primary text-[11px] font-mono"
            >
              <option value="0.5">0.5x</option>
              <option value="1.0">1.0x (Normal)</option>
              <option value="1.25">1.25x</option>
              <option value="1.5">1.5x</option>
              <option value="2.0">2.0x</option>
            </select>
          </div>

          {/* Crossfade Controls (shown for all clips, especially useful for video) */}
          <div className="flex items-center gap-1.5 border-l border-border/60 pl-3">
            <span className="text-[11px] font-bold text-blue-400 flex items-center gap-1">⟺ Crossfade</span>
            <span className="text-text-muted text-[11px]">In:</span>
            <input
              type="number" min="0" max="5" step="0.1"
              value={selectedClipObj.crossfadeInSec || 0}
              onChange={e => updateClip(selectedClipTrack.id, selectedClipObj.id, { crossfadeInSec: parseFloat(e.target.value) || 0 })}
              className="w-12 px-1 py-0.5 rounded border border-border bg-surface text-text-primary text-[11px] font-mono text-center"
            />
            <span className="text-text-muted text-[11px]">s  Out:</span>
            <input
              type="number" min="0" max="5" step="0.1"
              value={selectedClipObj.crossfadeOutSec || 0}
              onChange={e => updateClip(selectedClipTrack.id, selectedClipObj.id, { crossfadeOutSec: parseFloat(e.target.value) || 0 })}
              className="w-12 px-1 py-0.5 rounded border border-border bg-surface text-text-primary text-[11px] font-mono text-center"
            />
            <span className="text-text-muted text-[11px]">s</span>
          </div>

          {/* Move to Track */}
          <div className="flex items-center gap-1.5 border-l border-border/60 pl-3">
            <MoveRight className="w-3.5 h-3.5 text-text-muted shrink-0" />
            <span className="text-text-muted text-[11px]">Track:</span>
            <select
              value={selectedClipTrack.id}
              onChange={e => moveClipToTrack(selectedClipObj.id, selectedClipTrack.id, e.target.value)}
              className="px-1.5 py-0.5 rounded border border-border bg-surface text-text-primary text-[11px]"
            >
              {timelineTracks.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div className="flex-1" />

          <button
            onClick={() => setSelectedClip(null)}
            className="text-[11px] text-text-muted hover:text-text-primary underline"
          >
            Deselect
          </button>
        </div>
      )}

      {/* ── Body ─────────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">

        {/* Left: timeline (tracks + lanes) */}
        <div className="flex-1 flex overflow-hidden">
          {timelineTracks.length === 0 ? (
            <HowToGuide onAdd={addTimelineTrack} />
          ) : (
            <>
              {/* Fixed track headers column */}
              <div
                className="shrink-0 flex flex-col border-r border-border bg-surface z-10"
                style={{ width: HEADER_W }}
              >
                {/* Corner cell */}
                <div
                  className="shrink-0 border-b-2 border-border flex items-center justify-between px-3 bg-bg-secondary"
                  style={{ height: 32 }}
                >
                  <span className="text-[9px] font-bold text-text-muted uppercase tracking-widest">Tracks ({timelineTracks.length})</span>
                  <AddTrackMenu onAdd={addTimelineTrack} />
                </div>

                {/* Headers list (scrollTop synchronized with lanes) */}
                <div ref={headersRef} className="flex-1 overflow-hidden no-scrollbar">
                  {timelineTracks.map((track, idx) => (
                    <TrackHeader key={track.id} track={track} index={idx} totalTracks={timelineTracks.length} />
                  ))}
                </div>
              </div>

              {/* Scrollable lanes column */}
              <div
                ref={lanesRef}
                className="flex-1 overflow-auto"
                onScroll={handleLanesScroll}
              >
                <div style={{ minWidth: totalSec * pps }}>
                  {/* Sticky time ruler */}
                  <div className="sticky top-0 z-20 bg-bg-secondary">
                    <Ruler
                      pps={pps}
                      totalSec={totalSec}
                      maxContentEnd={maxContentEnd}
                      playheadSec={timelinePlayheadSec}
                      onClick={s => { stopPlay(); setTimelinePlayhead(s); }}
                    />
                  </div>

                  {/* Lanes canvas */}
                  <div className="relative">
                    {/* Vertical playhead line */}
                    <div
                      className="absolute top-0 w-0.5 bg-accent pointer-events-none z-20"
                      style={{ left: timelinePlayheadSec * pps, height: timelineTracks.length * TRACK_H }}
                    />

                    {timelineTracks.map(track => (
                      <TrackLane
                        key={track.id}
                        track={track}
                        pps={pps}
                        totalSec={totalSec}
                        selectedClip={selectedClip}
                        playheadSec={timelinePlayheadSec}
                        isPlaying={isPlaying}
                        onSelectClip={setSelectedClip}
                        onDblClick={sec => handleLaneDoubleClick(track.id, sec)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right: Media Pool */}
        {showMediaPool && (
          <MediaPool
            tracks={timelineTracks}
            playheadSec={timelinePlayheadSec}
            onPlace={placeClip}
          />
        )}
      </div>

      {/* ── Footer hints ── */}
      {timelineTracks.length > 0 && (
        <div className="shrink-0 border-t border-border bg-bg-secondary px-4 py-1.5 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-[10px] text-text-muted select-none">
          <span><kbd className="px-1 bg-border/50 rounded font-mono text-[9px]">S</kbd> split clip</span>
          <span><kbd className="px-1 bg-border/50 rounded font-mono text-[9px]">Ctrl+D</kbd> duplicate</span>
          <span><kbd className="px-1 bg-border/50 rounded font-mono text-[9px]">Space</kbd> play / pause</span>
          <span><kbd className="px-1 bg-border/50 rounded font-mono text-[9px]">Click</kbd> ruler → seek</span>
          <span><kbd className="px-1 bg-border/50 rounded font-mono text-[9px]">Drag</kbd> clip → move</span>
          <span><kbd className="px-1 bg-border/50 rounded font-mono text-[9px]">Dbl-click</kbd> lane → place clip</span>
          <span><kbd className="px-1 bg-border/50 rounded font-mono text-[9px]">Del</kbd> remove clip</span>
          <span className="hidden sm:block">Snaps to {SNAP_SEC}s grid</span>
        </div>
      )}
    </div>
  );
};

export default TimelineView;
