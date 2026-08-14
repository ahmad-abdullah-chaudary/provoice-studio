import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useStudioStore } from '@/store/useStudioStore';
import { Play, Pause, Download, Mic, SkipBack, Volume2, X } from 'lucide-react';

// ─── Waveform Canvas ─────────────────────────────────────────────────────────

const WaveformCanvas: React.FC<{
  audioUrl: string;
  currentTime: number;
  duration: number;
  onSeek: (t: number) => void;
}> = ({ audioUrl, currentTime, duration, onSeek }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [waveData, setWaveData] = useState<Float32Array | null>(null);

  // Decode audio → extract PCM waveform data
  useEffect(() => {
    if (!audioUrl) return;
    setWaveData(null);
    let ctx: AudioContext | null = null;
    fetch(audioUrl)
      .then(r => r.arrayBuffer())
      .then(buf => {
        ctx = new AudioContext();
        return ctx.decodeAudioData(buf);
      })
      .then(decoded => {
        setWaveData(decoded.getChannelData(0));
        ctx?.close();
      })
      .catch(() => {});
    return () => { ctx?.close(); };
  }, [audioUrl]);

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx2d = canvas.getContext('2d')!;
    ctx2d.scale(dpr, dpr);
    const W = rect.width;
    const H = rect.height;
    ctx2d.clearRect(0, 0, W, H);

    if (!waveData) {
      // Loading placeholder bars
      ctx2d.fillStyle = '#E5E5E5';
      const barW = 2, gap = 1;
      for (let x = 0; x < W; x += barW + gap) {
        const h = Math.random() * H * 0.6 + H * 0.1;
        ctx2d.fillRect(x, (H - h) / 2, barW, h);
      }
      return;
    }

    const playedFraction = duration > 0 ? currentTime / duration : 0;
    const playedPixel = playedFraction * W;
    const step = Math.ceil(waveData.length / W);

    for (let i = 0; i < W; i++) {
      let max = 0;
      for (let j = 0; j < step; j++) {
        const sample = Math.abs(waveData[i * step + j] || 0);
        if (sample > max) max = sample;
      }
      const barH = Math.max(2, max * H * 0.72);
      const y = (H - barH) / 2;
      ctx2d.fillStyle = i < playedPixel ? '#2563EB' : '#CCCCCC';
      ctx2d.fillRect(i, y, 1, barH);
    }

    // Playhead
    if (duration > 0) {
      ctx2d.strokeStyle = '#111111';
      ctx2d.lineWidth = 1.5;
      ctx2d.beginPath();
      ctx2d.moveTo(playedPixel, 0);
      ctx2d.lineTo(playedPixel, H);
      ctx2d.stroke();
    }
  }, [waveData, currentTime, duration]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    onSeek(ratio * duration);
  };

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      className="w-full h-11 cursor-pointer rounded-sm"
      style={{ display: 'block' }}
    />
  );
};

// ─── Main Audio Player ────────────────────────────────────────────────────────

export const AudioPlayer: React.FC = () => {
  const { currentAudioUrl, currentAudioMeta, isPlaying, setIsPlaying, setCurrentAudio, setShowExportModal } = useStudioStore();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1.0);
  const [playbackRate, setPlaybackRate] = useState(1.0);

  useEffect(() => {
    if (!audioRef.current || !currentAudioUrl) return;
    audioRef.current.src = currentAudioUrl;
    audioRef.current.load();
    audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
  }, [currentAudioUrl]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) { audioRef.current.pause(); setIsPlaying(false); }
    else { audioRef.current.play(); setIsPlaying(true); }
  };

  const skipBack = () => {
    if (audioRef.current) { audioRef.current.currentTime = 0; setCurrentTime(0); }
  };

  const handleSeek = (t: number) => {
    if (audioRef.current) { audioRef.current.currentTime = t; setCurrentTime(t); }
  };

  const cycleSpeed = () => {
    const speeds = [0.75, 1.0, 1.25, 1.5, 2.0];
    const next = speeds[(speeds.indexOf(playbackRate) + 1) % speeds.length];
    setPlaybackRate(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  const fmt = (s: number) => isNaN(s) ? '0:00' : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  if (!currentAudioUrl) return null;

  const audioFilename = currentAudioUrl.split('/').pop() || 'audio.wav';

  return (
    <div className="h-[104px] bg-surface border-t-2 border-text-primary flex items-center px-4 md:px-6 gap-4 md:gap-6 shrink-0 select-none shadow-[0_-4px_12px_rgba(0,0,0,.08)] min-w-0 py-2.5">
      <audio
        ref={audioRef}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onEnded={() => setIsPlaying(false)}
      />

      {/* Voice chip */}
      <div className="hidden sm:flex items-center gap-3 min-w-[140px] md:min-w-[180px] shrink-0">
        <div className="w-9 h-9 rounded-badge bg-accent border-2 border-text-primary shadow-neo-sm flex items-center justify-center shrink-0">
          <Mic className="w-4 h-4 text-white" />
        </div>
        <div className="min-w-0">
          <div className="text-xs font-bold text-text-primary truncate max-w-[100px] md:max-w-[140px]">
            {currentAudioMeta?.voice?.replace('_', ' ') || 'Generated Audio'}
          </div>
          <div className="text-[11px] text-text-muted font-mono">
            {fmt(currentTime)} / {fmt(duration)}
          </div>
        </div>
      </div>

      {/* Waveform + controls */}
      <div className="flex-1 flex flex-col gap-1.5 min-w-0">
        <WaveformCanvas
          audioUrl={currentAudioUrl}
          currentTime={currentTime}
          duration={duration}
          onSeek={handleSeek}
        />
        <div className="flex items-center justify-center gap-3 md:gap-4">
          <button onClick={skipBack} className="p-1 text-text-muted hover:text-text-primary transition-colors">
            <SkipBack className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={togglePlay}
            className="w-8 h-8 rounded-badge bg-accent text-white border-2 border-text-primary shadow-neo-sm flex items-center justify-center hover:scale-105 transition-all"
          >
            {isPlaying
              ? <Pause className="w-4 h-4 fill-white" />
              : <Play className="w-4 h-4 fill-white ml-0.5" />}
          </button>
          <button
            onClick={cycleSpeed}
            className="px-2 py-0.5 bg-bg-secondary rounded-badge border border-border text-[11px] font-bold font-mono text-text-secondary hover:text-text-primary"
          >
            {playbackRate}×
          </button>
        </div>
      </div>

      {/* Volume */}
      <div className="hidden lg:flex items-center gap-2 min-w-[90px] shrink-0">
        <Volume2 className="w-3.5 h-3.5 text-text-muted shrink-0" />
        <input type="range" min="0" max="1" step="0.05" value={volume}
          onChange={e => setVolume(parseFloat(e.target.value))}
          className="w-16 md:w-20 accent-accent cursor-pointer" />
      </div>

      {/* Export button */}
      <button
        onClick={() => setShowExportModal(true)}
        className="btn-neo px-3 md:px-4 py-2 text-xs flex items-center gap-1.5 shrink-0"
      >
        <Download className="w-4 h-4 text-white" /> <span className="hidden sm:inline">Export</span>
      </button>

      {/* Dismiss / Close player bar button */}
      <button
        onClick={() => setCurrentAudio(null)}
        className="w-8 h-8 rounded-badge bg-surface hover:bg-surface-hover border border-border text-text-muted hover:text-text-primary flex items-center justify-center shrink-0 transition-colors"
        title="Hide Audio Player"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
