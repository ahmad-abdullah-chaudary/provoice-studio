import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Voice {
  id: string; name: string; gender: string; accent: string; lang?: string;
  category: string; quality: string; speed_rating: string;
  speaking_style: string; recommended_use: string; preview_text: string;
}

export interface Segment {
  id: string; name: string; script: string; voice: string;
  speed: number; sentenceGapMs: number; paragraphGapMs: number;
  dspSettings: Partial<DspSettings>;
  status: 'idle' | 'rendering' | 'done' | 'error';
  audioUrl: string | null; duration: number | null;
}

export interface DspSettings {
  // Existing processors
  silence_trim: boolean; noise_gate: boolean; equalizer: boolean;
  compressor: boolean; limiter: boolean; normalize: boolean; fade: boolean;
  eq_bass: number; eq_presence: number; eq_treble: number;
  noise_gate_threshold: number; compressor_threshold: number;
  compressor_ratio: number; normalize_peak: number;
  // NEW: Studio-grade enhancements
  de_esser: boolean;             // Sibilance control (4–9kHz)
  de_esser_threshold: number;    // dB threshold for de-esser trigger
  de_esser_ratio: number;        // Reduction ratio
  harmonic_exciter: boolean;     // Analog tube warmth via 2nd-order harmonics
  harmonic_exciter_amount: number; // 0.0 – 0.30 saturation amount
  lufs_normalize: boolean;       // EBU R128 broadcast loudness normalization
  lufs_target: number;           // Target LUFS (-14 YouTube, -16 Podcast, -23 Broadcast)
  micro_variation: boolean;      // ±4% speed/gap variation per sentence
  breathing_injection: boolean;  // Synthesised breath at paragraph breaks
  nlp_auto_emotion: boolean;     // Per-sentence NLP emotion auto-detection
}

export interface Project {
  id: string; title: string; script: string; voice: string;
  segments: Segment[]; settings: Record<string, any>;
  updated_at: number; created_at?: number;
}

export interface HistoryItem {
  id: string; timestamp: number; text: string; voice: string;
  duration: number; render_time: number; file_size: number;
  sample_rate: number; audio_url: string;
}

export interface VoicePreset {
  id: string; name: string; voice: string; speed: number;
  sentenceGapMs: number; paragraphGapMs: number;
  dspSettings: Partial<DspSettings>;
}

export interface GenerationJob {
  id: string | null; status: 'idle' | 'processing' | 'complete' | 'failed';
  progress: number; total_chunks: number; current_chunk_text: string;
  audio_url: string | null; duration: number | null; render_time: number | null;
}

type BackendStatus = 'connecting' | 'online' | 'offline';

export interface TimelineClip {
  id: string;
  trackId: string;
  filePath: string;        // resolved server path from a generated audio or external upload
  audioUrl: string;        // playback URL e.g. /api/audio/xxx.wav
  videoUrl?: string;       // original video object URL for inline preview (video clips only)
  label: string;
  startTimeSec: number;
  durationSec: number;
  volume: number;          // 0.0 - 2.0
  fadeInSec?: number;      // Fade in duration
  fadeOutSec?: number;     // Fade out duration
  speed?: number;          // Playback speed rate e.g. 0.5, 1.0, 1.25, 1.5, 2.0
  clipType?: 'audio' | 'video';
  crossfadeInSec?: number;   // Cross-fade blend in duration (seconds)
  crossfadeOutSec?: number;  // Cross-fade blend out duration (seconds)
}

export interface TimelineTrack {
  id: string;
  name: string;
  type: 'narration' | 'music' | 'sfx' | 'video' | 'custom' | 'captions';
  volume: number;
  muted: boolean;
  solo: boolean;
  color?: string;
  clips: TimelineClip[];
}

export interface EmotionPreset {
  speed?: number;
  sentence_gap_ms?: number;
  paragraph_gap_ms?: number;
  description?: string;
}
type ActiveTab = 'dashboard' | 'editor' | 'voices' | 'batch' | 'queue' | 'dictionary' | 'history' | 'settings' | 'timeline' | 'videosync' | 'trimmer' | 'api';

// ─── Default DSP Settings ─────────────────────────────────────────────────────

const DEFAULT_DSP: DspSettings = {
  // Existing
  silence_trim: true, noise_gate: false, equalizer: false,
  compressor: false, limiter: true, normalize: true, fade: true,
  eq_bass: 0, eq_presence: 0, eq_treble: 0,
  noise_gate_threshold: -50, compressor_threshold: -18,
  compressor_ratio: 3.0, normalize_peak: -1.0,
  // NEW studio-grade defaults (all sensible out-of-box)
  de_esser: true,              // On by default — all voices benefit
  de_esser_threshold: -22.0,
  de_esser_ratio: 5.0,
  harmonic_exciter: true,      // On by default — adds warmth
  harmonic_exciter_amount: 0.18,
  lufs_normalize: false,       // Off by default (user picks target platform)
  lufs_target: -14.0,
  micro_variation: true,       // On by default — instant human feel
  breathing_injection: true,   // On by default — paragraph naturalness
  nlp_auto_emotion: true,      // On by default — auto-detect emotion per sentence
};

const DEFAULT_SEGMENT = (): Segment => ({
  id: `seg_${Date.now()}`, name: 'Scene 1',
  script: 'Write your narration script here...',
  voice: 'af_bella', speed: 1.0, sentenceGapMs: 200, paragraphGapMs: 400,
  dspSettings: {}, status: 'idle', audioUrl: null, duration: null,
});

// ─── Store Interface ──────────────────────────────────────────────────────────

interface StudioState {
  activeTab: ActiveTab; setActiveTab: (tab: ActiveTab) => void;
  backendStatus: BackendStatus; setBackendStatus: (s: BackendStatus) => void;

  // Voices
  voices: Voice[]; selectedVoiceId: string;
  setVoices: (v: Voice[]) => void; setSelectedVoiceId: (id: string) => void;
  fetchVoices: () => Promise<void>;

  // Voice Params (global, overridden per segment)
  voiceParams: { speed: number; sentenceGapMs: number; paragraphGapMs: number };
  setVoiceParams: (p: Partial<StudioState['voiceParams']>) => void;

  // DSP
  dspSettings: DspSettings;
  setDspSettings: (s: Partial<DspSettings>) => void;

  // Generation Job
  generationJob: GenerationJob;
  setGenerationJob: (j: Partial<GenerationJob>) => void;
  startGeneration: (text: string, segmentId?: string) => Promise<void>;
  pollJob: (jobId: string, segmentId?: string) => Promise<void>;

  // Multi-Segment Editor
  segments: Segment[];
  activeSegmentId: string;
  addSegment: () => void;
  removeSegment: (id: string) => void;
  updateSegment: (id: string, updates: Partial<Segment>) => void;
  setActiveSegmentId: (id: string) => void;
  renderAllSegments: () => Promise<void>;
  mergedAudioUrl: string | null;

  // Project
  currentProject: Project;
  projectList: Project[];
  updateProjectTitle: (t: string) => void;
  saveCurrentProject: (silent?: boolean) => Promise<void>;
  fetchProjects: () => Promise<void>;
  openProject: (p: Project) => void;
  createNewProject: () => void;
  deleteProject: (id: string) => Promise<void>;

  // Audio Player
  currentAudioUrl: string | null; currentAudioMeta: HistoryItem | null;
  isPlaying: boolean;
  setIsPlaying: (b: boolean) => void;
  setCurrentAudio: (url: string | null, meta?: HistoryItem | null, autoPlay?: boolean) => void;

  // System Stats
  systemStats: any; fetchSystemStats: () => Promise<void>;

  // History
  historyList: HistoryItem[]; fetchHistory: () => Promise<void>;

  // Voice Presets
  voicePresets: VoicePreset[]; fetchVoicePresets: () => Promise<void>;
  saveVoicePreset: (name: string) => Promise<void>;
  applyVoicePreset: (preset: VoicePreset) => void;

  // Background Music Mixer
  musicMixer: {
    enabled: boolean; musicFile: File | null; musicFileName: string;
    voiceVolume: number; musicVolume: number; duckEnabled: boolean;
  };
  setMusicMixer: (updates: Partial<StudioState['musicMixer']>) => void;

  // Language & Emotion
  selectedLang: string; setSelectedLang: (lang: string) => void;
  selectedEmotion: string; setSelectedEmotion: (emotion: string) => void;
  emotionPresets: Record<string, EmotionPreset>; fetchEmotionPresets: () => Promise<void>;

  // Timeline Editor
  timelineTracks: TimelineTrack[];
  timelinePlayheadSec: number;
  timelineDurationSec: number;
  setTimelinePlayhead: (sec: number) => void;
  addTimelineTrack: (type: TimelineTrack['type'], name?: string) => void;
  removeTimelineTrack: (id: string) => void;
  updateTimelineTrack: (id: string, updates: Partial<TimelineTrack>) => void;
  addClipToTrack: (trackId: string, clip: Omit<TimelineClip, 'id' | 'trackId'>) => void;
  removeClipFromTrack: (trackId: string, clipId: string) => void;
  updateClip: (trackId: string, clipId: string, updates: Partial<TimelineClip>) => void;
  duplicateClip: (trackId: string, clipId: string) => void;
  splitClip: (trackId: string, clipId: string, splitTimeSec?: number) => void;
  moveClipToTrack: (clipId: string, fromTrackId: string, toTrackId: string, newStartSec?: number) => void;
  reorderTracks: (startIndex: number, endIndex: number) => void;
  addExternalFileToTimeline: (file: File, trackId?: string, startSec?: number) => Promise<void>;
  renderTimeline: () => Promise<void>;

  // Video Sync
  videoSyncSource: { videoPath: string; videoUrl?: string; fileName: string; extractedAudioUrl: string | null } | null;
  setVideoSyncSource: (src: { videoPath: string; videoUrl?: string; fileName: string; extractedAudioUrl: string | null } | null) => void;
  exportVideoWithNarration: (audioFilename: string, preserveOriginal: boolean, originalVolume: number) => Promise<string | null>;
  videoSyncMarkers: any[];
  setVideoSyncMarkers: (markers: any[] | ((prev: any[]) => any[])) => void;
  videoSyncLoopA: number | null;
  videoSyncLoopB: number | null;
  videoSyncIsLooping: boolean;
  setVideoSyncLoop: (loopA: number | null, loopB: number | null, isLooping?: boolean) => void;
  videoSyncSettings: { preserveOriginal: boolean; origVolume: number; autoDucking: boolean; burnSubtitles: boolean };
  setVideoSyncSettings: (settings: Partial<StudioState['videoSyncSettings']>) => void;

  // Settings & System Config
  appSettings: {
    cpu_threads: number;
    memory_limit_mb: number;
    default_export_folder: string;
    theme: string;
    audio_quality: string;
    sample_rate: number;
  };
  fetchAppSettings: () => Promise<void>;
  saveAppSettings: (newSettings: Partial<StudioState['appSettings']>) => Promise<void>;

  // UI Modals & Responsive Panels
  sidebarCollapsed: boolean; toggleSidebar: () => void;
  inspectorCollapsed: boolean; toggleInspector: () => void;
  showExportModal: boolean; setShowExportModal: (b: boolean) => void;
  exportBatchMode: boolean; setExportBatchMode: (b: boolean) => void;
  showTemplatesModal: boolean; setShowTemplatesModal: (b: boolean) => void;
  toast: { message: string; type: 'success' | 'error' | 'info' } | null;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function apiFetch(url: string, opts?: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function sendDesktopNotification(title: string, body: string) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body });
  }
}

// ─── Store ────────────────────────────────────────────────────────────────────

const initialSegment = DEFAULT_SEGMENT();

export const useStudioStore = create<StudioState>()(
  persist(
    (set, get) => ({
      activeTab: 'dashboard', setActiveTab: (tab) => set({ activeTab: tab }),
  backendStatus: 'connecting', setBackendStatus: (s) => set({ backendStatus: s }),

  // Voices
  voices: [], selectedVoiceId: 'af_bella',
  setVoices: (voices) => set({ voices }),
  setSelectedVoiceId: (id) => {
    const { segments, activeSegmentId, voices, showToast } = get();
    const voiceObj = voices.find(v => v.id === id);
    const voiceName = voiceObj ? voiceObj.name : id;

    // Update active segment or default segments to use the globally selected voice
    const updatedSegments = segments.map(s =>
      s.id === activeSegmentId || !s.voice || s.voice === 'af_bella'
        ? { ...s, voice: id }
        : s
    );

    set({
      selectedVoiceId: id,
      segments: updatedSegments.length > 0 ? updatedSegments : segments,
    });

    showToast(`Active voice set to "${voiceName}" across ProVoice Studio`, 'success');
  },
  fetchVoices: async () => {
    try {
      const res = await apiFetch('/api/voices');
      if (res.ok) {
        const d = await res.json();
        const availableVoices: Voice[] = d.voices || [];
        const availableIds = new Set(availableVoices.map((v) => v.id));
        const { selectedVoiceId, segments } = get();

        // Migrate selectedVoiceId if it refers to a removed/legacy voice
        let newSelectedVoiceId = selectedVoiceId;
        if (!availableIds.has(selectedVoiceId)) {
          if (selectedVoiceId.includes('omega') || selectedVoiceId.includes('madhur') || selectedVoiceId.includes('male') || selectedVoiceId.includes('rohan') || selectedVoiceId.includes('pratham')) {
            newSelectedVoiceId = 'hm_omega';
          } else if (selectedVoiceId.includes('hi') || selectedVoiceId.includes('swara') || selectedVoiceId.includes('priyamvada')) {
            newSelectedVoiceId = 'hf_alpha';
          } else {
            newSelectedVoiceId = 'af_bella';
          }
        }

        // Migrate any segments containing removed/legacy voices
        const cleanedSegments = (segments || []).map((s) => {
          if (s.voice && !availableIds.has(s.voice)) {
            const v = s.voice;
            const migratedVoice =
              v.includes('omega') || v.includes('madhur') || v.includes('male') || v.includes('rohan') || v.includes('pratham')
                ? 'hm_omega'
                : v.includes('hi') || v.includes('swara') || v.includes('priyamvada')
                  ? 'hf_alpha'
                  : 'af_bella';
            return { ...s, voice: migratedVoice };
          }
          return s;
        });

        set({
          voices: availableVoices,
          backendStatus: 'online',
          selectedVoiceId: newSelectedVoiceId,
          segments: cleanedSegments,
        });
      }
    } catch {
      set({ backendStatus: 'offline' });
    }
  },

  // Voice Params
  voiceParams: { speed: 1.0, sentenceGapMs: 200, paragraphGapMs: 400 },
  setVoiceParams: (p) => set((s) => ({ voiceParams: { ...s.voiceParams, ...p } })),

  // DSP
  dspSettings: DEFAULT_DSP,
  setDspSettings: (updates) => set((s) => ({ dspSettings: { ...s.dspSettings, ...updates } })),

  // Generation Job
  generationJob: { id: null, status: 'idle', progress: 0, total_chunks: 0, current_chunk_text: '', audio_url: null, duration: null, render_time: null },
  setGenerationJob: (j) => set((s) => ({ generationJob: { ...s.generationJob, ...j } })),

  startGeneration: async (text: string, segmentId?: string) => {
    const state = get();
    if (!text.trim()) return;

    // Determine voice & params (from active segment if segmentId provided)
    let voice = state.selectedVoiceId;
    let speed = state.voiceParams.speed;
    let sentenceGapMs = state.voiceParams.sentenceGapMs;
    let paragraphGapMs = state.voiceParams.paragraphGapMs;
    let dspSettings = state.dspSettings;

    if (segmentId) {
      const seg = state.segments.find(s => s.id === segmentId);
      if (seg) {
        voice = seg.voice;
        speed = seg.speed;
        sentenceGapMs = seg.sentenceGapMs;
        paragraphGapMs = seg.paragraphGapMs;
        dspSettings = { ...DEFAULT_DSP, ...seg.dspSettings };
        state.updateSegment(segmentId, { status: 'rendering' });
      }
    }

    set({ generationJob: { id: null, status: 'processing', progress: 0, total_chunks: 0, current_chunk_text: '', audio_url: null, duration: null, render_time: null } });

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice, speed, lang: 'en-us', sentence_gap_ms: sentenceGapMs, paragraph_gap_ms: paragraphGapMs, dsp: dspSettings }),
      });

      if (res.ok) {
        const { job_id } = await res.json();
        set((s) => ({ generationJob: { ...s.generationJob, id: job_id } }));
        await get().pollJob(job_id, segmentId);
      } else {
        set((s) => ({ generationJob: { ...s.generationJob, status: 'failed' } }));
        if (segmentId) get().updateSegment(segmentId, { status: 'error' });
      }
    } catch {
      set((s) => ({ generationJob: { ...s.generationJob, status: 'failed' } }));
      get().showToast('Backend offline — start the server first', 'error');
    }
  },

  pollJob: (jobId: string, segmentId?: string) => new Promise<void>((resolve) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        if (!res.ok) { clearInterval(interval); resolve(); return; }
        const job = await res.json();
        get().setGenerationJob({
          status: job.status, progress: job.progress || 0,
          total_chunks: job.total_chunks || 0,
          current_chunk_text: job.current_chunk_text || '',
          audio_url: job.audio_url, duration: job.duration, render_time: job.render_time,
        });

        if (job.status === 'complete') {
          clearInterval(interval);
          const meta = { id: jobId, timestamp: Date.now() / 1000, text: '', voice: '', duration: job.duration, render_time: job.render_time, file_size: job.file_size, sample_rate: job.sample_rate, audio_url: job.audio_url };
          set({ currentAudioUrl: job.audio_url, currentAudioMeta: meta, isPlaying: false });
          if (segmentId) {
            get().updateSegment(segmentId, { status: 'done', audioUrl: job.audio_url, duration: job.duration });
          }
          get().showToast(`✓ Audio ready — ${job.duration}s rendered in ${job.render_time}s`, 'success');
          sendDesktopNotification('ProVoice Studio', `Audio ready — ${job.duration}s rendered!`);
          get().fetchHistory();
          resolve();
        } else if (job.status === 'failed') {
          clearInterval(interval);
          if (segmentId) get().updateSegment(segmentId, { status: 'error' });
          get().showToast(`Generation failed: ${job.error || 'Unknown error'}`, 'error');
          resolve();
        }
      } catch { clearInterval(interval); resolve(); }
    }, 600);
  }),

  // Multi-Segment Editor
  segments: [initialSegment],
  activeSegmentId: initialSegment.id,
  mergedAudioUrl: null,

  addSegment: () => {
    const seg = DEFAULT_SEGMENT();
    seg.name = `Scene ${get().segments.length + 1}`;
    seg.voice = get().selectedVoiceId || 'af_bella';
    set((s) => ({ segments: [...s.segments, seg], activeSegmentId: seg.id }));
  },

  removeSegment: (id) => {
    const { segments, activeSegmentId } = get();
    if (segments.length === 1) return;
    const remaining = segments.filter(s => s.id !== id);
    set({ segments: remaining, activeSegmentId: activeSegmentId === id ? remaining[0].id : activeSegmentId });
  },

  updateSegment: (id, updates) =>
    set((s) => ({ segments: s.segments.map(seg => seg.id === id ? { ...seg, ...updates } : seg) })),

  setActiveSegmentId: (id) => set({ activeSegmentId: id }),

  renderAllSegments: async () => {
    const { segments, startGeneration } = get();
    for (const seg of segments) {
      if (seg.script.trim()) await startGeneration(seg.script, seg.id);
      // brief pause between segments
      await new Promise(r => setTimeout(r, 500));
    }
    sendDesktopNotification('ProVoice Studio', `All ${segments.length} segments rendered!`);
  },

  // Project State & Management
  currentProject: (() => {
    try {
      const saved = localStorage.getItem('provoice_current_project');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      id: `proj_${Date.now()}`,
      title: 'Untitled Project',
      script: '',
      voice: 'af_bella',
      segments: [initialSegment],
      settings: {},
      updated_at: Date.now(),
    };
  })(),

  projectList: (() => {
    try {
      const saved = localStorage.getItem('provoice_project_list');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  })(),

  updateProjectTitle: (title) => {
    set((s) => {
      const updated = { ...s.currentProject, title, updated_at: Date.now() };
      try { localStorage.setItem('provoice_current_project', JSON.stringify(updated)); } catch {}
      return { currentProject: updated };
    });
    // Auto save
    get().saveCurrentProject(true);
  },

  saveCurrentProject: async (silent = false) => {
    const { currentProject, segments, selectedVoiceId, voiceParams, dspSettings, projectList } = get();
    const script = segments.map((s) => s.script || '').join('\n\n');
    const project: Project = {
      ...currentProject,
      script,
      voice: selectedVoiceId,
      segments,
      settings: { voiceParams, dspSettings },
      updated_at: Date.now(),
    };

    // Immediate local persistence
    try {
      localStorage.setItem('provoice_current_project', JSON.stringify(project));
      const updatedList = [
        project,
        ...projectList.filter((p) => p.id !== project.id),
      ];
      localStorage.setItem('provoice_project_list', JSON.stringify(updatedList));
      set({ currentProject: project, projectList: updatedList });
    } catch {}

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(project),
      });
      if (res.ok) {
        const data = await res.json();
        const savedProj = data.project || project;
        set((s) => ({
          currentProject: savedProj,
          projectList: [
            savedProj,
            ...s.projectList.filter((p) => p.id !== savedProj.id),
          ],
        }));
        if (!silent) get().showToast('Project saved successfully', 'success');
      }
    } catch {
      if (!silent) get().showToast('Project saved locally', 'info');
    }
  },

  fetchProjects: async () => {
    try {
      const res = await apiFetch('/api/projects');
      if (res.ok) {
        const d = await res.json();
        if (d.projects && Array.isArray(d.projects)) {
          set({ projectList: d.projects });
          try { localStorage.setItem('provoice_project_list', JSON.stringify(d.projects)); } catch {}
        }
      }
    } catch {
      // Fallback to local storage
      try {
        const local = localStorage.getItem('provoice_project_list');
        if (local) set({ projectList: JSON.parse(local) });
      } catch {}
    }
  },

  openProject: (p: Project) => {
    const segments = p.segments?.length ? p.segments : [DEFAULT_SEGMENT()];
    set({
      currentProject: p,
      segments,
      activeSegmentId: segments[0].id,
      selectedVoiceId: p.voice || 'af_bella',
      voiceParams: p.settings?.voiceParams || { speed: 1.0, sentenceGapMs: 200, paragraphGapMs: 400 },
      dspSettings: { ...DEFAULT_DSP, ...(p.settings?.dspSettings || {}) },
      activeTab: 'editor',
    });
    try { localStorage.setItem('provoice_current_project', JSON.stringify(p)); } catch {}
  },

  createNewProject: () => {
    const currentVoice = get().selectedVoiceId || 'af_bella';
    const seg = DEFAULT_SEGMENT();
    seg.voice = currentVoice;
    const now = Date.now();
    const project: Project = {
      id: `proj_${now}`,
      title: `Project ${new Date(now).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
      script: '',
      voice: currentVoice,
      segments: [seg],
      settings: {},
      updated_at: now,
    };

    set((s) => ({
      currentProject: project,
      segments: [seg],
      activeSegmentId: seg.id,
      projectList: [project, ...s.projectList.filter((p) => p.id !== project.id)],
      activeTab: 'editor',
    }));

    try {
      localStorage.setItem('provoice_current_project', JSON.stringify(project));
      localStorage.setItem('provoice_project_list', JSON.stringify([project, ...get().projectList]));
    } catch {}

    // Persist to backend
    fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(project),
    }).catch(() => {});

    get().showToast(`Created new project: "${project.title}"`, 'success');
  },

  deleteProject: async (projectId: string) => {
    try {
      await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
    } catch {}

    set((s) => {
      const updatedList = s.projectList.filter((p) => p.id !== projectId);
      try { localStorage.setItem('provoice_project_list', JSON.stringify(updatedList)); } catch {}
      return { projectList: updatedList };
    });

    get().showToast('Project deleted', 'info');
  },

  // Audio Player
  currentAudioUrl: null, currentAudioMeta: null, isPlaying: false,
  setIsPlaying: (b) => set({ isPlaying: b }),
  setCurrentAudio: (url, meta = null, autoPlay = false) => set({ currentAudioUrl: url, currentAudioMeta: meta, isPlaying: autoPlay }),

  // System Stats
  systemStats: null,
  fetchSystemStats: async () => {
    try {
      const res = await apiFetch('/api/system/stats');
      if (res.ok) { set({ systemStats: await res.json(), backendStatus: 'online' }); }
    } catch { set({ backendStatus: 'offline' }); }
  },

  // History
  historyList: [],
  fetchHistory: async () => {
    try {
      const res = await apiFetch('/api/history');
      if (res.ok) { const d = await res.json(); set({ historyList: d.history || [] }); }
    } catch {}
  },

  // Voice Presets
  voicePresets: [],
  fetchVoicePresets: async () => {
    try {
      const res = await apiFetch('/api/voice-presets');
      if (res.ok) { const d = await res.json(); set({ voicePresets: d.presets || [] }); }
    } catch {}
  },
  saveVoicePreset: async (name) => {
    const { selectedVoiceId, voiceParams, dspSettings } = get();
    try {
      const res = await fetch('/api/voice-presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, voice: selectedVoiceId, speed: voiceParams.speed, sentenceGapMs: voiceParams.sentenceGapMs, paragraphGapMs: voiceParams.paragraphGapMs, dspSettings }),
      });
      if (res.ok) { get().fetchVoicePresets(); get().showToast(`Preset "${name}" saved`, 'success'); }
    } catch {}
  },
  applyVoicePreset: (preset) => {
    set({
      selectedVoiceId: preset.voice,
      voiceParams: { speed: preset.speed, sentenceGapMs: preset.sentenceGapMs, paragraphGapMs: preset.paragraphGapMs },
      dspSettings: { ...DEFAULT_DSP, ...preset.dspSettings },
    });
    get().showToast(`Preset "${preset.name}" applied`, 'success');
  },

  // Background Music Mixer
  musicMixer: { enabled: false, musicFile: null, musicFileName: '', voiceVolume: 1.0, musicVolume: 0.15, duckEnabled: true },
  setMusicMixer: (updates) => set((s) => ({ musicMixer: { ...s.musicMixer, ...updates } })),

  // Language & Emotion
  selectedLang: 'en-us',
  setSelectedLang: (lang) => set({ selectedLang: lang }),
  selectedEmotion: 'normal',
  setSelectedEmotion: (emotion) => set({ selectedEmotion: emotion }),
  emotionPresets: {},
  fetchEmotionPresets: async () => {
    try {
      const res = await apiFetch('/api/emotion-presets');
      if (res.ok) { const d = await res.json(); set({ emotionPresets: d.presets || {} }); }
    } catch {}
  },

  // Timeline Editor
  timelineTracks: [
    { id: 'track_narration', name: 'Narration', type: 'narration', volume: 1.0, muted: false, solo: false, clips: [] },
    { id: 'track_music', name: 'Background Music', type: 'music', volume: 0.3, muted: false, solo: false, clips: [] },
  ],
  timelinePlayheadSec: 0,
  timelineDurationSec: 60,
  setTimelinePlayhead: (sec) => set({ timelinePlayheadSec: sec }),

  addTimelineTrack: (type, name) => {
    const id = `track_${type}_${Date.now()}`;
    const names: Record<string, string> = {
      narration: 'Narration Track',
      music:     'Music Track',
      sfx:       'SFX Track',
      video:     'Video Track',
      custom:    'Custom Audio Track',
      captions:  'Subtitles / Captions',
    };
    const count = get().timelineTracks.filter(t => t.type === type).length + 1;
    const trackName = name || `${names[type] || type} ${count}`;
    set((s) => ({
      timelineTracks: [
        ...s.timelineTracks,
        { id, name: trackName, type, volume: 1.0, muted: false, solo: false, clips: [] }
      ]
    }));
  },

  removeTimelineTrack: (id) => set((s) => ({ timelineTracks: s.timelineTracks.filter(t => t.id !== id) })),

  updateTimelineTrack: (id, updates) =>
    set((s) => ({ timelineTracks: s.timelineTracks.map(t => t.id === id ? { ...t, ...updates } : t) })),

  addClipToTrack: (trackId, clip) => {
    const newClip: TimelineClip = { id: `clip_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`, trackId, ...clip };
    set((s) => ({
      timelineTracks: s.timelineTracks.map(t =>
        t.id === trackId ? { ...t, clips: [...t.clips, newClip] } : t
      ),
    }));
  },

  removeClipFromTrack: (trackId, clipId) =>
    set((s) => ({
      timelineTracks: s.timelineTracks.map(t =>
        t.id === trackId ? { ...t, clips: t.clips.filter(c => c.id !== clipId) } : t
      ),
    })),

  updateClip: (trackId, clipId, updates) =>
    set((s) => ({
      timelineTracks: s.timelineTracks.map(t =>
        t.id === trackId
          ? { ...t, clips: t.clips.map(c => c.id === clipId ? { ...c, ...updates } : c) }
          : t
      ),
    })),

  duplicateClip: (trackId, clipId) => {
    const { timelineTracks, addClipToTrack, showToast } = get();
    const track = timelineTracks.find(t => t.id === trackId);
    if (!track) return;
    const clip = track.clips.find(c => c.id === clipId);
    if (!clip) return;

    addClipToTrack(trackId, {
      filePath: clip.filePath,
      audioUrl: clip.audioUrl,
      videoUrl: clip.videoUrl,
      label: `${clip.label} (Copy)`,
      startTimeSec: clip.startTimeSec + clip.durationSec + 0.5,
      durationSec: clip.durationSec,
      volume: clip.volume,
      fadeInSec: clip.fadeInSec,
      fadeOutSec: clip.fadeOutSec,
      speed: clip.speed,
      clipType: clip.clipType,
      crossfadeInSec: clip.crossfadeInSec,
      crossfadeOutSec: clip.crossfadeOutSec,
    });
    showToast(`Duplicated ${clip.label}`, 'success');
  },

  splitClip: (trackId, clipId, splitTimeSec) => {
    const { timelineTracks, timelinePlayheadSec, showToast } = get();
    const track = timelineTracks.find(t => t.id === trackId);
    if (!track) return;
    const clip = track.clips.find(c => c.id === clipId);
    if (!clip) return;

    const clipStart = clip.startTimeSec;
    const clipEnd = clip.startTimeSec + clip.durationSec;
    const targetTime = splitTimeSec !== undefined ? splitTimeSec : timelinePlayheadSec;

    if (targetTime <= clipStart + 0.05 || targetTime >= clipEnd - 0.05) {
      showToast('Position playhead inside clip boundaries to split', 'info');
      return;
    }

    const firstDur = targetTime - clipStart;
    const secondDur = clipEnd - targetTime;

    const clip1: TimelineClip = {
      ...clip,
      durationSec: Math.round(firstDur * 100) / 100,
      label: clip.label.includes('(Pt') ? clip.label : `${clip.label} (Pt 1)`,
    };

    const clip2: TimelineClip = {
      ...clip,
      id: `clip_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      startTimeSec: Math.round(targetTime * 100) / 100,
      durationSec: Math.round(secondDur * 100) / 100,
      label: clip.label.includes('(Pt') ? clip.label.replace(/\(Pt \d+\)/, '(Pt 2)') : `${clip.label} (Pt 2)`,
    };

    set((s) => ({
      timelineTracks: s.timelineTracks.map(t =>
        t.id === trackId
          ? {
              ...t,
              clips: t.clips.flatMap(c => c.id === clipId ? [clip1, clip2] : [c]),
            }
          : t
      ),
    }));
    showToast(`Split ${clip.label} at ${targetTime.toFixed(1)}s`, 'success');
  },

  moveClipToTrack: (clipId, fromTrackId, toTrackId, newStartSec) => {
    const { timelineTracks } = get();
    const fromTrack = timelineTracks.find(t => t.id === fromTrackId);
    if (!fromTrack) return;
    const clip = fromTrack.clips.find(c => c.id === clipId);
    if (!clip) return;

    const targetStart = newStartSec !== undefined ? newStartSec : clip.startTimeSec;
    const movedClip: TimelineClip = { ...clip, trackId: toTrackId, startTimeSec: Math.max(0, targetStart) };

    set((s) => ({
      timelineTracks: s.timelineTracks.map(t => {
        if (t.id === fromTrackId && fromTrackId !== toTrackId) {
          return { ...t, clips: t.clips.filter(c => c.id !== clipId) };
        }
        if (t.id === toTrackId) {
          if (fromTrackId === toTrackId) {
            return { ...t, clips: t.clips.map(c => c.id === clipId ? movedClip : c) };
          }
          return { ...t, clips: [...t.clips, movedClip] };
        }
        return t;
      })
    }));
  },

  reorderTracks: (startIndex, endIndex) => {
    set((s) => {
      const result = Array.from(s.timelineTracks);
      const [removed] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, removed);
      return { timelineTracks: result };
    });
  },

  addExternalFileToTimeline: async (file, targetTrackId, startSec = 0) => {
    const { showToast, addTimelineTrack, addClipToTrack, timelineTracks } = get();
    const formData = new FormData();
    formData.append('file', file);

    try {
      showToast(`Uploading external file ${file.name}…`, 'info');
      const res = await fetch('/api/audio/upload', { method: 'POST', body: formData });
      if (res.ok) {
        const data = await res.json();
        // Backend tells us definitively if it's a video (audio extracted from it)
        const isVideo = data.is_video || file.type.startsWith('video/') || /\.(mp4|mov|mkv|webm|avi)$/i.test(file.name);
        const trackType: TimelineTrack['type'] = isVideo ? 'video' : 'music';

        let trackId = targetTrackId;
        if (!trackId) {
          const existing = timelineTracks.find(t => t.type === trackType);
          if (existing) {
            trackId = existing.id;
          } else {
            addTimelineTrack(trackType, isVideo ? file.name.replace(/\.[^.]+$/, '') : 'Music Track');
            const updated = get().timelineTracks;
            trackId = updated[updated.length - 1].id;
          }
        }

        const videoUrlToUse = data.video_url || undefined;

        addClipToTrack(trackId, {
          filePath: data.file_path || data.orig_path || '',
          audioUrl: data.audio_url,
          videoUrl: videoUrlToUse,
          label: file.name,
          startTimeSec: startSec,
          durationSec: data.duration || 5.0,
          volume: 1.0,
          clipType: isVideo ? 'video' : 'audio',
          crossfadeInSec: 0,
          crossfadeOutSec: 0,
        });

        // If it's a video, also sync to videoSyncSource so VideoSyncView is ready
        if (isVideo) {
          get().setVideoSyncSource({
            videoPath: data.file_path || data.orig_path || '',
            videoUrl: videoUrlToUse,
            fileName: file.name,
            extractedAudioUrl: data.audio_url,
          });
        }

        showToast(`Imported ${file.name} (${(data.duration || 5).toFixed(1)}s) to Timeline`, 'success');
      } else {
        showToast('External file upload failed', 'error');
      }
    } catch {
      showToast('Backend offline — cannot upload external file', 'error');
    }
  },

  renderTimeline: async () => {
    const { timelineTracks, showToast, setCurrentAudio } = get();
    const tracks = timelineTracks.map(t => ({
      id: t.id, name: t.name, volume: t.volume, muted: t.muted,
      clips: t.clips.map(c => ({
        file_path:      c.filePath  || '',
        audio_url:      c.audioUrl  || '',   // ← critical: backend resolves this to the actual file
        start_time_sec: c.startTimeSec,
        duration_sec:   c.durationSec,
        volume:         c.volume,
        label:          c.label,
      })),
    }));
    try {
      const res = await fetch('/api/timeline/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracks }),
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentAudio(data.audio_url, null);
        showToast(`Timeline rendered — ${data.duration.toFixed(1)}s`, 'success');
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(`Timeline render failed: ${err.detail || res.statusText}`, 'error');
      }
    } catch { showToast('Backend offline — cannot render timeline', 'error'); }
  },

  // Video Sync
  videoSyncSource: null,
  setVideoSyncSource: (src) => set({ videoSyncSource: src }),

  videoSyncMarkers: [],
  setVideoSyncMarkers: (updater) => set((s) => ({
    videoSyncMarkers: typeof updater === 'function' ? updater(s.videoSyncMarkers) : updater
  })),

  videoSyncLoopA: null,
  videoSyncLoopB: null,
  videoSyncIsLooping: false,
  setVideoSyncLoop: (loopA, loopB, isLooping) => set((s) => ({
    videoSyncLoopA: loopA,
    videoSyncLoopB: loopB,
    videoSyncIsLooping: isLooping !== undefined ? isLooping : s.videoSyncIsLooping,
  })),

  videoSyncSettings: { preserveOriginal: true, origVolume: 0.3, autoDucking: true, burnSubtitles: false },
  setVideoSyncSettings: (updates) => set((s) => ({
    videoSyncSettings: { ...s.videoSyncSettings, ...updates }
  })),

  exportVideoWithNarration: async (audioFilename, preserveOriginal, originalVolume) => {
    const { videoSyncSource, showToast } = get();
    if (!videoSyncSource) { showToast('No video loaded', 'error'); return null; }
    try {
      const res = await fetch('/api/video/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_path: videoSyncSource.videoPath,
          audio_filename: audioFilename,
          preserve_original: preserveOriginal,
          original_volume: originalVolume,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        showToast('Video exported successfully!', 'success');
        return data.download_url as string;
      } else {
        showToast('Video export failed — is FFmpeg installed?', 'error');
        return null;
      }
    } catch { showToast('Backend offline', 'error'); return null; }
  },

  // Settings & System Config
  appSettings: {
    cpu_threads: 4,
    memory_limit_mb: 4096,
    default_export_folder: 'c:\\Users\\AHMAD CH\\Videos\\ProVoice Studio\\data\\exports',
    theme: 'light',
    audio_quality: 'Studio',
    sample_rate: 24000,
  },
  fetchAppSettings: async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        set((s) => ({ appSettings: { ...s.appSettings, ...data } }));
      }
    } catch {}
  },
  saveAppSettings: async (newSettings) => {
    const updated = { ...get().appSettings, ...newSettings };
    set({ appSettings: updated });
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      if (res.ok) {
        get().showToast('Settings saved successfully', 'success');
      } else {
        get().showToast('Failed to save settings to server', 'error');
      }
    } catch {
      get().showToast('Settings saved locally (offline mode)', 'info');
    }
  },

  // UI & Panels
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  inspectorCollapsed: true,
  toggleInspector: () => set((s) => ({ inspectorCollapsed: !s.inspectorCollapsed })),
  showExportModal: false, setShowExportModal: (b) => set({ showExportModal: b }),
  exportBatchMode: false, setExportBatchMode: (b) => set({ exportBatchMode: b }),
  showTemplatesModal: false, setShowTemplatesModal: (b) => set({ showTemplatesModal: b }),
  toast: null,
  showToast: (message, type = 'info') => {
    set({ toast: { message, type } });
    setTimeout(() => set({ toast: null }), 4500);
  },
}),
{
  name: 'provoice-studio-storage-v1',
  storage: createJSONStorage(() => localStorage),
  partialize: (state) => ({
    activeTab: state.activeTab,
    selectedVoiceId: state.selectedVoiceId,
    voiceParams: state.voiceParams,
    dspSettings: state.dspSettings,
    segments: state.segments,
    activeSegmentId: state.activeSegmentId,
    currentProject: state.currentProject,
    timelineTracks: state.timelineTracks,
    timelinePlayheadSec: state.timelinePlayheadSec,
    videoSyncSource: state.videoSyncSource,
    videoSyncMarkers: state.videoSyncMarkers,
    videoSyncLoopA: state.videoSyncLoopA,
    videoSyncLoopB: state.videoSyncLoopB,
    videoSyncIsLooping: state.videoSyncIsLooping,
    videoSyncSettings: state.videoSyncSettings,
    appSettings: state.appSettings,
  }),
}
));
