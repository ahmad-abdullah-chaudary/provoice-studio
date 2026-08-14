import React, { useRef, useState } from 'react';
import { useStudioStore } from '@/store/useStudioStore';
import { Sliders, Gauge, Volume2, ShieldAlert, Sparkles, Activity, Music2, Upload, Save, Star, Trash2, X, Wind, Flame, Radio, Mic2, Waves } from 'lucide-react';

export const AudioInspector: React.FC = () => {
  const { voiceParams, setVoiceParams, dspSettings, setDspSettings, inspectorCollapsed, toggleInspector } = useStudioStore();

  if (inspectorCollapsed) return null;

  return (
    <aside className="w-full sm:w-[360px] max-w-full bg-surface border-l border-border flex flex-col h-full shrink-0 select-none overflow-y-auto">
      {/* Inspector Header */}
      <div className="h-[56px] px-5 border-b border-border flex items-center justify-between shrink-0 bg-bg-secondary/50">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-accent stroke-[2.5]" />
          <h2 className="font-bold text-sm text-text-primary uppercase tracking-wider">
            Audio Inspector & DSP
          </h2>
        </div>
        <button
          onClick={toggleInspector}
          className="p-1 rounded text-text-muted hover:text-text-primary transition-all"
          title="Close Inspector"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-5 space-y-6 flex-1">
        {/* Section 1: Voice Generation Controls */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-text-primary uppercase tracking-wider">
            <Gauge className="w-3.5 h-3.5 text-accent" />
            <span>Voice Parameters</span>
          </div>

          {/* Speed Slider */}
          <div className="p-3.5 bg-bg-secondary rounded-input border border-border space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-text-secondary">
              <span>Speaking Speed</span>
              <span className="font-mono text-accent font-bold">{voiceParams.speed.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.05"
              value={voiceParams.speed}
              onChange={(e) => setVoiceParams({ speed: parseFloat(e.target.value) })}
              className="w-full accent-accent cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-text-muted font-medium">
              <span>0.5x Slow</span>
              <span>1.0x Normal</span>
              <span>2.0x Fast</span>
            </div>
          </div>

          {/* Sentence Gap */}
          <div className="p-3.5 bg-bg-secondary rounded-input border border-border space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-text-secondary">
              <span>Sentence Gap</span>
              <span className="font-mono text-text-primary font-bold">{voiceParams.sentenceGapMs} ms</span>
            </div>
            <input
              type="range"
              min="50"
              max="1000"
              step="25"
              value={voiceParams.sentenceGapMs}
              onChange={(e) => setVoiceParams({ sentenceGapMs: parseInt(e.target.value) })}
              className="w-full accent-accent cursor-pointer"
            />
          </div>

          {/* Paragraph Gap */}
          <div className="p-3.5 bg-bg-secondary rounded-input border border-border space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-text-secondary">
              <span>Paragraph Gap</span>
              <span className="font-mono text-text-primary font-bold">{voiceParams.paragraphGapMs} ms</span>
            </div>
            <input
              type="range"
              min="100"
              max="2000"
              step="50"
              value={voiceParams.paragraphGapMs}
              onChange={(e) => setVoiceParams({ paragraphGapMs: parseInt(e.target.value) })}
              className="w-full accent-accent cursor-pointer"
            />
          </div>
        </div>

        <hr className="border-border" />

        {/* Section 2: Studio DSP Processing Pipeline */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-text-primary uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-accent" />
              <span>DSP FX Pipeline</span>
            </div>
            <span className="text-[10px] font-semibold text-success bg-success/10 px-2 py-0.5 rounded-badge border border-success/20">
              Studio DSP
            </span>
          </div>

          {/* Silence Trim */}
          <div className="p-3.5 bg-surface rounded-input border border-border flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-text-primary">Silence Trimming</div>
              <div className="text-[11px] text-text-muted">Auto-trim leading/trailing silence</div>
            </div>
            <input
              type="checkbox"
              checked={dspSettings.silence_trim}
              onChange={(e) => setDspSettings({ silence_trim: e.target.checked })}
              className="w-4 h-4 accent-accent cursor-pointer"
            />
          </div>

          {/* 3-Band Equalizer */}
          <div className="p-3.5 bg-surface rounded-input border border-border space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-text-primary">3-Band Equalizer</div>
                <div className="text-[11px] text-text-muted">Bass, Presence & Treble</div>
              </div>
              <input
                type="checkbox"
                checked={dspSettings.equalizer}
                onChange={(e) => setDspSettings({ equalizer: e.target.checked })}
                className="w-4 h-4 accent-accent cursor-pointer"
              />
            </div>
            {dspSettings.equalizer && (
              <div className="pt-2 border-t border-border space-y-2.5">
                <div>
                  <div className="flex justify-between text-[11px] font-medium text-text-secondary">
                    <span>Bass Boost (200Hz)</span>
                    <span className="font-mono">{dspSettings.eq_bass > 0 ? `+${dspSettings.eq_bass}` : dspSettings.eq_bass} dB</span>
                  </div>
                  <input
                    type="range"
                    min="-6"
                    max="6"
                    step="0.5"
                    value={dspSettings.eq_bass}
                    onChange={(e) => setDspSettings({ eq_bass: parseFloat(e.target.value) })}
                    className="w-full accent-accent cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[11px] font-medium text-text-secondary">
                    <span>Presence / Mid (3kHz)</span>
                    <span className="font-mono">{dspSettings.eq_presence > 0 ? `+${dspSettings.eq_presence}` : dspSettings.eq_presence} dB</span>
                  </div>
                  <input
                    type="range"
                    min="-6"
                    max="6"
                    step="0.5"
                    value={dspSettings.eq_presence}
                    onChange={(e) => setDspSettings({ eq_presence: parseFloat(e.target.value) })}
                    className="w-full accent-accent cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[11px] font-medium text-text-secondary">
                    <span>Treble (7kHz)</span>
                    <span className="font-mono">{dspSettings.eq_treble > 0 ? `+${dspSettings.eq_treble}` : dspSettings.eq_treble} dB</span>
                  </div>
                  <input
                    type="range"
                    min="-6"
                    max="6"
                    step="0.5"
                    value={dspSettings.eq_treble}
                    onChange={(e) => setDspSettings({ eq_treble: parseFloat(e.target.value) })}
                    className="w-full accent-accent cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Compressor */}
          <div className="p-3.5 bg-surface rounded-input border border-border space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-text-primary">Dynamic Compressor</div>
                <div className="text-[11px] text-text-muted">Smooth vocal peaks</div>
              </div>
              <input
                type="checkbox"
                checked={dspSettings.compressor}
                onChange={(e) => setDspSettings({ compressor: e.target.checked })}
                className="w-4 h-4 accent-accent cursor-pointer"
              />
            </div>
            {dspSettings.compressor && (
              <div className="pt-2 border-t border-border space-y-2">
                <div className="flex justify-between text-[11px] font-medium text-text-secondary">
                  <span>Threshold</span>
                  <span className="font-mono">{dspSettings.compressor_threshold} dB</span>
                </div>
                <input
                  type="range"
                  min="-30"
                  max="-6"
                  step="1"
                  value={dspSettings.compressor_threshold}
                  onChange={(e) => setDspSettings({ compressor_threshold: parseFloat(e.target.value) })}
                  className="w-full accent-accent cursor-pointer"
                />
              </div>
            )}
          </div>

          {/* Peak Normalization & Limiter */}
          <div className="p-3.5 bg-surface rounded-input border border-border flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-text-primary">Peak Normalization</div>
              <div className="text-[11px] text-text-muted">Normalize to -1.0 dBFS</div>
            </div>
            <input
              type="checkbox"
              checked={dspSettings.normalize}
              onChange={(e) => setDspSettings({ normalize: e.target.checked })}
              className="w-4 h-4 accent-accent cursor-pointer"
            />
          </div>
        </div>

        <hr className="border-border" />

        {/* ── STUDIO REALISM SECTION ──────────────────────────────────── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-text-primary uppercase tracking-wider">
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              <span>Studio Realism FX</span>
            </div>
            <span className="text-[10px] font-semibold text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded-badge border border-orange-400/20">
              NEW
            </span>
          </div>

          {/* Micro-Variation Engine */}
          <div className="p-3.5 bg-surface rounded-input border border-border space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                  <Waves className="w-3 h-3 text-accent" />
                  Micro-Variation Engine
                </div>
                <div className="text-[11px] text-text-muted mt-0.5">±4% speed & gap variation per sentence — human feel</div>
              </div>
              <input
                type="checkbox"
                checked={dspSettings.micro_variation ?? true}
                onChange={(e) => setDspSettings({ micro_variation: e.target.checked })}
                className="w-4 h-4 accent-accent cursor-pointer"
              />
            </div>
          </div>

          {/* Breathing Injection */}
          <div className="p-3.5 bg-surface rounded-input border border-border space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                  <Wind className="w-3 h-3 text-sky-400" />
                  Breath Injection
                </div>
                <div className="text-[11px] text-text-muted mt-0.5">Natural inhale breath at paragraph breaks</div>
              </div>
              <input
                type="checkbox"
                checked={dspSettings.breathing_injection ?? true}
                onChange={(e) => setDspSettings({ breathing_injection: e.target.checked })}
                className="w-4 h-4 accent-accent cursor-pointer"
              />
            </div>
          </div>

          {/* NLP Auto-Emotion Detector */}
          <div className="p-3.5 bg-surface rounded-input border border-border space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-purple-400" />
                  NLP Auto-Emotion Engine
                </div>
                <div className="text-[11px] text-text-muted mt-0.5">Auto-detects dramatic, sad, or energetic sentences</div>
              </div>
              <input
                type="checkbox"
                checked={dspSettings.nlp_auto_emotion ?? true}
                onChange={(e) => setDspSettings({ nlp_auto_emotion: e.target.checked })}
                className="w-4 h-4 accent-accent cursor-pointer"
              />
            </div>
          </div>

          {/* De-Esser */}
          <div className="p-3.5 bg-surface rounded-input border border-border space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                  <Mic2 className="w-3 h-3 text-yellow-400" />
                  De-Esser
                </div>
                <div className="text-[11px] text-text-muted mt-0.5">Tame harsh sibilance (4–9kHz S/SH sounds)</div>
              </div>
              <input
                type="checkbox"
                checked={dspSettings.de_esser ?? true}
                onChange={(e) => setDspSettings({ de_esser: e.target.checked })}
                className="w-4 h-4 accent-accent cursor-pointer"
              />
            </div>
            {(dspSettings.de_esser ?? true) && (
              <div className="pt-2 border-t border-border space-y-2.5">
                <div>
                  <div className="flex justify-between text-[11px] font-medium text-text-secondary">
                    <span>Threshold</span>
                    <span className="font-mono">{dspSettings.de_esser_threshold ?? -22} dB</span>
                  </div>
                  <input type="range" min="-40" max="-8" step="1"
                    value={dspSettings.de_esser_threshold ?? -22}
                    onChange={(e) => setDspSettings({ de_esser_threshold: parseFloat(e.target.value) })}
                    className="w-full accent-accent cursor-pointer" />
                  <div className="flex justify-between text-[10px] text-text-muted font-medium">
                    <span>Gentle</span><span>Aggressive</span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[11px] font-medium text-text-secondary">
                    <span>Ratio</span>
                    <span className="font-mono">{(dspSettings.de_esser_ratio ?? 5).toFixed(1)}:1</span>
                  </div>
                  <input type="range" min="2" max="10" step="0.5"
                    value={dspSettings.de_esser_ratio ?? 5}
                    onChange={(e) => setDspSettings({ de_esser_ratio: parseFloat(e.target.value) })}
                    className="w-full accent-accent cursor-pointer" />
                </div>
              </div>
            )}
          </div>

          {/* Harmonic Exciter */}
          <div className="p-3.5 bg-surface rounded-input border border-border space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                  <Flame className="w-3 h-3 text-orange-400" />
                  Harmonic Exciter
                </div>
                <div className="text-[11px] text-text-muted mt-0.5">Analog tube warmth via soft saturation</div>
              </div>
              <input
                type="checkbox"
                checked={dspSettings.harmonic_exciter ?? true}
                onChange={(e) => setDspSettings({ harmonic_exciter: e.target.checked })}
                className="w-4 h-4 accent-accent cursor-pointer"
              />
            </div>
            {(dspSettings.harmonic_exciter ?? true) && (
              <div className="pt-2 border-t border-border">
                <div className="flex justify-between text-[11px] font-medium text-text-secondary">
                  <span>Warmth Amount</span>
                  <span className="font-mono">{Math.round((dspSettings.harmonic_exciter_amount ?? 0.18) * 100)}%</span>
                </div>
                <input type="range" min="0" max="0.30" step="0.01"
                  value={dspSettings.harmonic_exciter_amount ?? 0.18}
                  onChange={(e) => setDspSettings({ harmonic_exciter_amount: parseFloat(e.target.value) })}
                  className="w-full accent-accent cursor-pointer" />
                <div className="flex justify-between text-[10px] text-text-muted font-medium">
                  <span>Subtle</span><span>Vintage</span>
                </div>
              </div>
            )}
          </div>

          {/* LUFS Normalization */}
          <div className="p-3.5 bg-surface rounded-input border border-border space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                  <Radio className="w-3 h-3 text-green-400" />
                  LUFS Normalization
                </div>
                <div className="text-[11px] text-text-muted mt-0.5">EBU R128 broadcast loudness standard</div>
              </div>
              <input
                type="checkbox"
                checked={dspSettings.lufs_normalize ?? false}
                onChange={(e) => setDspSettings({ lufs_normalize: e.target.checked })}
                className="w-4 h-4 accent-accent cursor-pointer"
              />
            </div>
            {(dspSettings.lufs_normalize ?? false) && (
              <div className="pt-2 border-t border-border space-y-3">
                {/* Platform Presets */}
                <div className="grid grid-cols-2 gap-1.5">
                  {([
                    { label: '📺 YouTube', value: -14 },
                    { label: '🎙️ Podcast', value: -16 },
                    { label: '📡 Broadcast', value: -23 },
                    { label: '📱 Reels', value: -12 },
                  ] as const).map(({ label, value }) => (
                    <button
                      key={value}
                      onClick={() => setDspSettings({ lufs_target: value })}
                      className={`py-1.5 text-[10px] font-bold rounded-badge border transition-all ${
                        (dspSettings.lufs_target ?? -14) === value
                          ? 'bg-accent text-white border-accent'
                          : 'bg-bg-secondary text-text-muted border-border hover:border-accent hover:text-accent'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div>
                  <div className="flex justify-between text-[11px] font-medium text-text-secondary">
                    <span>Custom Target</span>
                    <span className="font-mono text-green-400 font-bold">{dspSettings.lufs_target ?? -14} LUFS</span>
                  </div>
                  <input type="range" min="-30" max="-9" step="1"
                    value={dspSettings.lufs_target ?? -14}
                    onChange={(e) => setDspSettings({ lufs_target: parseFloat(e.target.value) })}
                    className="w-full accent-accent cursor-pointer" />
                  <div className="flex justify-between text-[10px] text-text-muted font-medium">
                    <span>-30 Quiet</span><span>-9 Loud</span>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* ── Background Music Mixer ────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-text-primary uppercase tracking-wider">
            <Music2 className="w-3.5 h-3.5 text-accent" />
            <span>Background Music Mixer</span>
          </div>
          <MusicMixerPanel />
        </div>

        {/* ── Voice Presets ─────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-text-primary uppercase tracking-wider">
            <Star className="w-3.5 h-3.5 text-accent" />
            <span>Voice Presets</span>
          </div>
          <VoicePresetsPanel />
        </div>

      </div>
    </aside>
  );
};

// ── Music Mixer Panel ─────────────────────────────────────────────────────────

const MusicMixerPanel: React.FC = () => {
  const { musicMixer, setMusicMixer, currentAudioUrl, currentAudioMeta, showToast } = useStudioStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isMixing, setIsMixing] = useState(false);
  const [mixedUrl, setMixedUrl] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setMusicMixer({ musicFile: file, musicFileName: file.name, enabled: true });
  };

  const handleMix = async () => {
    if (!musicMixer.musicFile || !currentAudioUrl) return;
    const audioFilename = currentAudioUrl.split('/').pop() || '';
    if (!audioFilename) return;
    setIsMixing(true);
    try {
      const formData = new FormData();
      formData.append('voice_filename', audioFilename);
      formData.append('music_file', musicMixer.musicFile);
      formData.append('voice_volume', String(musicMixer.voiceVolume));
      formData.append('music_volume', String(musicMixer.musicVolume));
      formData.append('duck_under_speech', String(musicMixer.duckEnabled));
      const res = await fetch('/api/mix', { method: 'POST', body: formData });
      if (res.ok) {
        const data = await res.json();
        setMixedUrl(data.audio_url);
        showToast('Music mixed — listen or export below', 'success');
      } else {
        showToast('Mix failed', 'error');
      }
    } catch { showToast('Mix error', 'error'); }
    finally { setIsMixing(false); }
  };

  return (
    <div className="space-y-3">
      <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleFileSelect} />
      
      <div className="flex items-center gap-2">
        <button
          onClick={() => fileInputRef.current?.click()}
          title={musicMixer.musicFileName || 'Upload Background Music'}
          className="flex-1 py-2 px-3 text-xs font-semibold border-2 border-dashed border-border rounded-input text-text-muted hover:border-accent hover:text-accent transition-all flex items-center justify-center gap-2 min-w-0 overflow-hidden"
        >
          <Upload className="w-4 h-4 shrink-0 text-accent" />
          <span className="truncate min-w-0 font-medium">
            {musicMixer.musicFileName || 'Upload Background Music'}
          </span>
        </button>

        {musicMixer.musicFileName && (
          <button
            onClick={() => setMusicMixer({ musicFile: null, musicFileName: '', enabled: false })}
            className="p-2 rounded-input border border-border text-text-muted hover:text-danger hover:bg-danger/10 transition-all shrink-0"
            title="Remove uploaded music"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {musicMixer.musicFileName && (
        <div className="space-y-3">
          <div className="p-3 bg-bg-secondary rounded-input border border-border space-y-3">
            <SliderRow label="Voice Volume" value={musicMixer.voiceVolume} min={0} max={1} step={0.05}
              display={`${Math.round(musicMixer.voiceVolume * 100)}%`}
              onChange={v => setMusicMixer({ voiceVolume: v })} />
            <SliderRow label="Music Volume" value={musicMixer.musicVolume} min={0} max={1} step={0.01}
              display={`${Math.round(musicMixer.musicVolume * 100)}%`}
              onChange={v => setMusicMixer({ musicVolume: v })} />
            <div className="flex items-center justify-between text-xs font-semibold text-text-secondary">
              <span>Duck under speech</span>
              <input type="checkbox" checked={musicMixer.duckEnabled}
                onChange={e => setMusicMixer({ duckEnabled: e.target.checked })}
                className="w-4 h-4 accent-accent cursor-pointer" />
            </div>
          </div>

          <button onClick={handleMix} disabled={isMixing || !currentAudioUrl}
            className="btn-neo w-full py-2 text-xs flex items-center justify-center gap-2 disabled:opacity-50">
            <Music2 className="w-3.5 h-3.5 text-white" />
            {isMixing ? 'Mixing…' : 'Apply Mix'}
          </button>

          {mixedUrl && (
            <a href={mixedUrl} download className="w-full py-2 text-xs font-semibold text-success border border-success rounded-input flex items-center justify-center gap-2 hover:bg-success/10 transition-all">
              Download Mixed Audio
            </a>
          )}
        </div>
      )}
    </div>
  );
};

// ── Helper slider row ─────────────────────────────────────────────────────────

const SliderRow: React.FC<{ label: string; value: number; min: number; max: number; step: number; display: string; onChange: (v: number) => void }>
  = ({ label, value, min, max, step, display, onChange }) => (
  <div>
    <div className="flex items-center justify-between text-xs font-semibold text-text-secondary mb-1">
      <span>{label}</span><span className="font-mono text-accent">{display}</span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value}
      onChange={e => onChange(parseFloat(e.target.value))}
      className="w-full accent-accent cursor-pointer" />
  </div>
);

// ── Voice Presets Panel ───────────────────────────────────────────────────────

const VoicePresetsPanel: React.FC = () => {
  const { voicePresets, fetchVoicePresets, saveVoicePreset, applyVoicePreset } = useStudioStore();
  const [presetName, setPresetName] = useState('');
  const [showSave, setShowSave] = useState(false);

  React.useEffect(() => { fetchVoicePresets(); }, []);

  const handleSave = async () => {
    if (!presetName.trim()) return;
    await saveVoicePreset(presetName.trim());
    setPresetName('');
    setShowSave(false);
  };

  return (
    <div className="space-y-2">
      {voicePresets.length === 0 && (
        <p className="text-[11px] text-text-muted text-center py-2">No presets saved yet.</p>
      )}
      {voicePresets.map(p => (
        <div key={p.id} className="flex items-center justify-between p-2.5 bg-bg-secondary rounded-input border border-border gap-2 min-w-0">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-text-primary truncate" title={p.name}>{p.name}</div>
            <div className="text-[10px] text-text-muted truncate">{p.voice} · {p.speed}×</div>
          </div>
          <button onClick={() => applyVoicePreset(p)}
            className="px-2.5 py-1 text-[11px] font-bold bg-accent/10 text-accent rounded-badge hover:bg-accent hover:text-white transition-all shrink-0">
            Apply
          </button>
        </div>
      ))}
      {showSave ? (
        <div className="flex gap-2">
          <input value={presetName} onChange={e => setPresetName(e.target.value)}
            placeholder="Preset name…" autoFocus
            className="flex-1 px-2.5 py-1.5 text-xs bg-bg-secondary border border-border rounded-input focus:outline-none focus:border-accent text-text-primary" />
          <button onClick={handleSave} className="btn-neo px-3 py-1.5 text-xs">Save</button>
          <button onClick={() => setShowSave(false)} className="px-2 py-1 text-xs text-text-muted hover:text-danger">✕</button>
        </div>
      ) : (
        <button onClick={() => setShowSave(true)}
          className="w-full py-2 text-xs font-semibold border border-dashed border-border rounded-input text-text-muted hover:border-accent hover:text-accent transition-all flex items-center justify-center gap-2">
          <Save className="w-3.5 h-3.5" /> Save Current Voice as Preset
        </button>
      )}
    </div>
  );
};
