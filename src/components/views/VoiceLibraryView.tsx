import React, { useEffect, useRef, useState } from 'react';
import { useStudioStore, Voice } from '@/store/useStudioStore';
import { Mic, Play, Check, Sparkles, Search, Globe, ShieldCheck, Zap, Languages } from 'lucide-react';

interface LanguageOption {
  code: string;
  flag: string;
  name: string;
  badge?: string;
}

const LANGUAGES: LanguageOption[] = [
  { code: 'All', flag: '🌍', name: 'All Languages' },
  { code: 'en-us', flag: '🇺🇸', name: 'English (US)' },
  { code: 'en-gb', flag: '🇬🇧', name: 'English (UK)' },
  { code: 'hi', flag: '🇮🇳', name: 'Hindi', badge: 'Devanagari + Hinglish Roman' },
  { code: 'ur', flag: '🇵🇰', name: 'Urdu' },
  { code: 'es', flag: '🇪🇸', name: 'Spanish' },
  { code: 'fr', flag: '🇫🇷', name: 'French' },
  { code: 'it', flag: '🇮🇹', name: 'Italian' },
  { code: 'ja', flag: '🇯🇵', name: 'Japanese' },
  { code: 'zh', flag: '🇨🇳', name: 'Mandarin' },
];

const FLAG_MAP: Record<string, string> = {
  'en-us': '🇺🇸',
  'en-gb': '🇬🇧',
  hi: '🇮🇳',
  ur: '🇵🇰',
  es: '🇪🇸',
  fr: '🇫🇷',
  it: '🇮🇹',
  ja: '🇯🇵',
  zh: '🇨🇳',
};

// Helper: Standardize voice language detection across catalog + raw ONNX vectors
const getVoiceLang = (voice: Voice): string => {
  if (voice.lang) {
    const l = voice.lang.toLowerCase();
    if (l === 'en-us' || l === 'en' || l === 'american') return 'en-us';
    if (l === 'en-gb' || l === 'british') return 'en-gb';
    if (l === 'hi' || l === 'hindi') return 'hi';
    if (l === 'ur' || l === 'urdu') return 'ur';
    if (l === 'es' || l === 'spanish') return 'es';
    if (l === 'fr' || l === 'french') return 'fr';
    if (l === 'it' || l === 'italian') return 'it';
    if (l === 'ja' || l === 'japanese') return 'ja';
    if (l === 'zh' || l === 'mandarin' || l === 'chinese') return 'zh';
  }

  // Fallback by voice ID prefix for Kokoro (af/am=US, bf/bm=UK, ef/em=ES, ff=FR, if=IT, jf/jm=JA, zf/zm=ZH, hf/hm=HI)
  // For indic_ur_* voices the lang field handles them above
  const prefix = (voice.id || '').slice(0, 2).toLowerCase();
  if (prefix === 'af' || prefix === 'am') return 'en-us';
  if (prefix === 'bf' || prefix === 'bm') return 'en-gb';
  if (prefix === 'ef' || prefix === 'em' || prefix === 'pf' || prefix === 'pm') return 'es';
  if (prefix === 'ff') return 'fr';
  if (prefix === 'if' || prefix === 'im') return 'it';
  if (prefix === 'jf' || prefix === 'jm') return 'ja';
  if (prefix === 'zf' || prefix === 'zm') return 'zh';
  if (prefix === 'hf' || prefix === 'hm') return 'hi';

  // Fallback by accent text string
  const accent = (voice.accent || '').toLowerCase();
  if (accent.includes('american') || accent.includes('us')) return 'en-us';
  if (accent.includes('british') || accent.includes('uk')) return 'en-gb';
  if (accent.includes('hindi') || accent.includes('hinglish')) return 'hi';
  if (accent.includes('urdu')) return 'ur';
  if (accent.includes('spanish')) return 'es';
  if (accent.includes('french')) return 'fr';
  if (accent.includes('italian')) return 'it';
  if (accent.includes('japanese')) return 'ja';
  if (accent.includes('mandarin') || accent.includes('chinese')) return 'zh';

  return 'en-us';
};

export const VoiceLibraryView: React.FC = () => {
  const { voices, selectedVoiceId, setSelectedVoiceId } = useStudioStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('All');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedGender, setSelectedGender] = useState<string>('All');

  const categories = [
    'All',
    'Storyteller',
    'Documentary',
    'Deep Narrator',
    'Movie Explainer',
    'News Voice',
    'Anime / Explainer',
    'Conversational',
    'Epic Voice',
  ];

  const filteredVoices = voices.filter((voice) => {
    const matchesSearch =
      voice.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      voice.speaking_style.toLowerCase().includes(searchQuery.toLowerCase()) ||
      voice.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      voice.accent.toLowerCase().includes(searchQuery.toLowerCase());

    const voiceLang = getVoiceLang(voice);
    const matchesLanguage = selectedLanguage === 'All' || voiceLang === selectedLanguage;
    const matchesCategory = selectedCategory === 'All' || voice.category === selectedCategory;
    const matchesGender = selectedGender === 'All' || voice.gender === selectedGender;

    return matchesSearch && matchesLanguage && matchesCategory && matchesGender;
  });

  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const previewPollRef = useRef<number | null>(null);

  const stopPreviewPolling = () => {
    if (previewPollRef.current !== null) {
      clearInterval(previewPollRef.current);
      previewPollRef.current = null;
    }
  };

  useEffect(() => () => stopPreviewPolling(), []);

  const handlePreviewAudio = async (voice: Voice) => {
    if (previewingVoiceId === voice.id) return; // already loading
    setPreviewingVoiceId(voice.id);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: voice.preview_text,
          voice: voice.id,          // use THIS voice's id, NOT the store's selectedVoiceId
          speed: 1.0,
          lang: 'en-us',
          sentence_gap_ms: 300,
          paragraph_gap_ms: 600,
          dsp: { normalize: true, compressor: false, eq_bass: 0, eq_presence: 0, eq_treble: 0 },
        }),
      });
      if (res.ok) {
        const { job_id } = await res.json();
        // Poll until audio is ready, then play directly without touching the store's selected voice
        previewPollRef.current = window.setInterval(async () => {
          try {
            const jr = await fetch(`/api/jobs/${job_id}`);
            if (!jr.ok) { stopPreviewPolling(); setPreviewingVoiceId(null); return; }
            const job = await jr.json();
            if (job.status === 'complete' && job.audio_url) {
              stopPreviewPolling();
              setPreviewingVoiceId(null);
              const audio = new Audio(job.audio_url);
              audio.play().catch(() => {});
            } else if (job.status === 'failed') {
              stopPreviewPolling();
              setPreviewingVoiceId(null);
            }
          } catch { stopPreviewPolling(); setPreviewingVoiceId(null); }
        }, 400);
      } else {
        setPreviewingVoiceId(null);
      }
    } catch {
      stopPreviewPolling();
      setPreviewingVoiceId(null);
      useStudioStore.getState().showToast('Backend offline — start the server first', 'error');
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-[1600px] mx-auto select-none">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary flex items-center gap-2">
            <Mic className="w-6 h-6 text-accent" /> Voice Library & Multi-Language Models
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Browse 50+ studio-quality CPU-optimized offline voice models across English, Hindi (Devanagari + Roman Hinglish), Spanish, French, Italian, Japanese, & Mandarin.
          </p>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-text-muted absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search by voice name, language, style..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-surface rounded-input border border-border text-xs text-text-primary focus:outline-none focus:border-accent"
          />
        </div>
      </div>

      {/* ── Language Filter Tab Bar ── */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-text-muted uppercase tracking-wider">
          <Globe className="w-3.5 h-3.5 text-accent" /> Filter by Language / Country Pack
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full no-scrollbar">
          {LANGUAGES.map((lang) => {
            const isSelected = selectedLanguage === lang.code;
            const count = lang.code === 'All'
              ? voices.length
              : voices.filter(v => getVoiceLang(v) === lang.code).length;

            return (
              <button
                key={lang.code}
                onClick={() => setSelectedLanguage(lang.code)}
                className={`px-3.5 py-2 rounded-badge text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 border ${
                  isSelected
                    ? 'bg-accent text-white border-accent shadow-neo-sm'
                    : 'bg-surface text-text-secondary border-border hover:border-accent/50 hover:text-text-primary'
                }`}
              >
                <span className="text-sm">{lang.flag}</span>
                <span>{lang.name}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-bg-secondary text-text-muted'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Category & Gender Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-surface p-3 rounded-card border border-border">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full no-scrollbar">
          <span className="text-xs font-semibold text-text-muted flex items-center gap-1 pl-1">
            <Languages className="w-3.5 h-3.5" /> Style:
          </span>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-badge text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-accent text-white font-bold shadow-neo-sm border border-accent'
                  : 'bg-bg-secondary text-text-secondary hover:text-text-primary border border-transparent'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Gender Filter Toggle */}
        <div className="flex items-center gap-1 bg-bg-secondary p-1 rounded-badge border border-border shrink-0">
          {['All', 'Female', 'Male'].map((g) => (
            <button
              key={g}
              onClick={() => setSelectedGender(g)}
              className={`px-3 py-1 rounded-badge text-xs font-semibold transition-all ${
                selectedGender === g ? 'bg-accent text-white font-bold shadow-neo-sm' : 'text-text-muted hover:text-text-primary'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Voice Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredVoices.map((voice) => {
          const isSelected = selectedVoiceId === voice.id;
          const langCode = getVoiceLang(voice);
          const flag = FLAG_MAP[langCode] || '🌐';
          const isHindi = langCode === 'hi';

          return (
            <div
              key={voice.id}
              className={`p-5 md:p-6 bg-surface rounded-card transition-all flex flex-col justify-between space-y-4 min-w-0 ${
                isSelected
                  ? 'border-2 border-accent shadow-neo'
                  : 'border border-border hover:border-accent/40 shadow-card'
              }`}
            >
              {/* Card Header */}
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="w-9 h-9 rounded-badge bg-accent/10 text-accent font-bold text-xs flex items-center justify-center shrink-0">
                      {voice.gender === 'Female' ? 'F' : 'M'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-bold text-base text-text-primary truncate">{voice.name}</h3>
                        <span className="text-sm shrink-0" title={voice.accent}>{flag}</span>
                      </div>
                      <div className="text-[11px] text-text-muted truncate">
                        {voice.accent} • {voice.gender}
                      </div>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 bg-bg-secondary text-text-secondary text-[11px] font-semibold rounded-badge border border-border shrink-0">
                    {voice.category}
                  </span>
                </div>

                <p className="text-xs text-text-secondary leading-relaxed pt-1 line-clamp-2">
                  "{voice.speaking_style}"
                </p>

                {/* Hindi Roman Transliteration Badge */}
                {isHindi && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 text-amber-500 rounded-badge border border-amber-500/20 text-[11px] font-semibold">
                    <Sparkles className="w-3 h-3 shrink-0" /> Devanagari + Roman Hinglish Auto-Transliteration
                  </div>
                )}
              </div>

              {/* Specs Badges */}
              <div className="pt-2 border-t border-border flex items-center justify-between text-[11px] text-text-muted gap-2">
                <span className="flex items-center gap-1 shrink-0">
                  <ShieldCheck className="w-3.5 h-3.5 text-success shrink-0" /> {voice.quality}
                </span>
                <span className="flex items-center gap-1 shrink-0">
                  <Zap className="w-3.5 h-3.5 text-accent shrink-0" /> {voice.speed_rating}
                </span>
                <span className="truncate font-medium text-text-secondary text-right">
                  {voice.recommended_use.split(',')[0]}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center gap-2.5">
                <button
                  onClick={() => handlePreviewAudio(voice)}
                  disabled={previewingVoiceId === voice.id}
                  className="flex-1 btn-neo-secondary py-2 px-3 text-xs flex items-center justify-center gap-1.5 min-w-0 disabled:opacity-60 disabled:cursor-wait"
                >
                  {previewingVoiceId === voice.id ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-accent border-t-transparent rounded-full animate-spin shrink-0" />
                      <span className="truncate">Loading...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 text-accent fill-accent shrink-0" />
                      <span className="truncate">Preview</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => setSelectedVoiceId(voice.id)}
                  className={`px-4 py-2 text-xs font-bold rounded-button border-2 flex items-center justify-center gap-1.5 transition-all shrink-0 ${
                    isSelected
                      ? 'bg-success text-white border-text-primary shadow-neo-sm'
                      : 'bg-surface text-text-primary border-text-primary hover:bg-surface-hover'
                  }`}
                >
                  {isSelected ? (
                    <>
                      <Check className="w-3.5 h-3.5 stroke-[3]" /> Active
                    </>
                  ) : (
                    'Select'
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
