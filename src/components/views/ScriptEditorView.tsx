import React, { useState, useRef, useCallback } from 'react';
import { useStudioStore, Segment } from '@/store/useStudioStore';
import {
  FileText, Plus, Trash2, ZoomIn, ZoomOut, Search, FileCode,
  Wand2, Layers, Loader2, CheckCircle2, AlertCircle, Clock,
  ChevronRight, BookOpen, Sparkles, Play,
} from 'lucide-react';

// ─── Templates ────────────────────────────────────────────────────────────────

const TEMPLATES = [
  {
    label: 'YouTube Intro', category: 'Content',
    text: "What's going on everyone, welcome back to the channel! Today we're going to be diving deep into one of the most fascinating topics I've covered in a long time. Make sure you stick around until the end because I have something special for you.",
  },
  {
    label: 'Documentary Opener', category: 'Cinematic',
    text: "Our planet is home to wonders beyond imagination. From the deepest ocean trenches to the highest mountain peaks, life finds a way to flourish against all odds. Tonight, we journey to a place few humans have ever witnessed.",
  },
  {
    label: 'Podcast Episode Intro', category: 'Content',
    text: "Welcome back to the show. I'm your host, and today we have an extraordinary conversation lined up. Our guest has spent years studying this subject, and the insights they're about to share will completely change the way you think about it.",
  },
  {
    label: 'Audiobook Chapter Opening', category: 'Fiction',
    text: "Chapter One. The city never truly slept. Even at three in the morning, the distant hum of traffic formed a constant undertone beneath the silence of the empty streets. Detective Marlowe pulled her coat tighter and stepped into the rain.",
  },
  {
    label: 'Movie Trailer Voice', category: 'Cinematic',
    text: "In a world where nothing is as it seems, one man must choose between everything he loves and the truth that will change humanity forever. This summer, the line between hero and villain disappears.",
  },
  {
    label: 'Tutorial Walkthrough', category: 'Educational',
    text: "In this tutorial, we're going to walk through the entire process step by step. By the end, you'll have a complete understanding of how this works and be able to apply it immediately in your own projects. Let's get started.",
  },
  {
    label: 'News Broadcast Opener', category: 'Professional',
    text: "Good evening. I'm reporting live from the city center where extraordinary developments have unfolded in the past few hours. Officials have confirmed the news that has been circulating since early this morning. Here is what we know so far.",
  },
  {
    label: 'Meditation Guide', category: 'Wellness',
    text: "Find a comfortable position and gently close your eyes. Begin by taking three slow, deep breaths. With each exhale, allow the tension in your body to release completely. There is nowhere you need to be right now. This moment is yours.",
  },
];

// ─── Context Menu ─────────────────────────────────────────────────────────────

const ContextMenu: React.FC<{
  x: number; y: number; word: string;
  onAddToDictionary: () => void;
  onClose: () => void;
}> = ({ x, y, word, onAddToDictionary, onClose }) => (
  <div
    className="fixed z-50 bg-surface border-2 border-text-primary shadow-neo rounded-card py-1 min-w-[200px]"
    style={{ top: y, left: x }}
    onMouseLeave={onClose}
  >
    <div className="px-3 py-1.5 text-[11px] font-bold text-text-muted uppercase tracking-wider border-b border-border">
      "{word}"
    </div>
    <button
      onClick={onAddToDictionary}
      className="w-full text-left px-3 py-2 text-xs font-semibold text-text-primary hover:bg-bg-secondary flex items-center gap-2"
    >
      <BookOpen className="w-3.5 h-3.5 text-accent" /> Add to Pronunciation Dictionary
    </button>
    <button
      onClick={onClose}
      className="w-full text-left px-3 py-2 text-xs font-semibold text-text-secondary hover:bg-bg-secondary"
    >
      Dismiss
    </button>
  </div>
);

// ─── Segment Panel Item ────────────────────────────────────────────────────────

const SegmentItem: React.FC<{
  segment: Segment; isActive: boolean;
  onClick: () => void; onRemove: () => void;
}> = ({ segment, isActive, onClick, onRemove }) => {
  const statusIcon = {
    idle: null,
    rendering: <Loader2 className="w-3.5 h-3.5 text-accent animate-spin" />,
    done: <CheckCircle2 className="w-3.5 h-3.5 text-success" />,
    error: <AlertCircle className="w-3.5 h-3.5 text-danger" />,
  }[segment.status];

  return (
    <div
      onClick={onClick}
      className={`group px-3 py-2.5 cursor-pointer rounded-input flex items-center justify-between gap-2 transition-all ${
        isActive
          ? 'bg-surface border-2 border-text-primary shadow-neo-sm'
          : 'hover:bg-surface-hover border border-transparent'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <ChevronRight className={`w-3.5 h-3.5 shrink-0 transition-colors ${isActive ? 'text-accent' : 'text-text-muted'}`} />
        <div className="min-w-0">
          <div className="text-xs font-bold text-text-primary truncate">{segment.name}</div>
          <div className="text-[10px] text-text-muted truncate">
            {segment.voice} · {segment.script.split(' ').length} words
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {statusIcon}
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-text-muted hover:text-danger transition-all"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};

// ─── Main Script Editor View ──────────────────────────────────────────────────

export const ScriptEditorView: React.FC = () => {
  const {
    segments, activeSegmentId, addSegment, removeSegment,
    updateSegment, setActiveSegmentId, renderAllSegments,
    selectedVoiceId, setSelectedVoiceId, voices, generationJob, startGeneration,
    showTemplatesModal, setShowTemplatesModal,
  } = useStudioStore();

  const activeSegment = segments.find(s => s.id === activeSegmentId) || segments[0];
  const [fontSize, setFontSize] = useState(16);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; word: string } | null>(null);
  const [pendingDictWord, setPendingDictWord] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const script = activeSegment?.script || '';
  const wordCount = script.trim().split(/\s+/).filter(Boolean).length;
  const charCount = script.length;
  const lineCount = script.split('\n').length;
  const estSec = Math.ceil((wordCount / 150) * 60);
  const estDisplay = estSec >= 60 ? `${Math.floor(estSec / 60)}m ${estSec % 60}s` : `${estSec}s`;

  const isRendering = generationJob.status === 'processing';
  const progressPct = generationJob.total_chunks > 0
    ? Math.round((generationJob.progress / generationJob.total_chunks) * 100)
    : 0;

  const handleReplaceAll = () => {
    if (!searchQuery || !activeSegment) return;
    const regex = new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    updateSegment(activeSegment.id, { script: script.replace(regex, replaceQuery) });
  };

  const insertTag = (prefix: string, suffix: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea || !activeSegment) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = script.slice(start, end);
    const replacement = `${prefix}${selected}${suffix}`;
    const newScript = script.slice(0, start) + replacement + script.slice(end);
    updateSegment(activeSegment.id, { script: newScript });
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    }, 50);
  };

  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = script.slice(start, end).trim().split(/\s+/)[0];
    const word = selected || script.slice(0, start).split(/\s+/).pop() || '';
    if (word) setContextMenu({ x: e.clientX, y: e.clientY, word });
  }, [script]);

  const handleAddToDictionary = async () => {
    if (!contextMenu?.word) return;
    const phonetic = window.prompt(`Phonetic pronunciation for "${contextMenu.word}":`, contextMenu.word);
    if (phonetic) {
      await fetch('/api/dictionary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: contextMenu.word, replace: phonetic, is_global: true }),
      });
      useStudioStore.getState().showToast(`"${contextMenu.word}" → "${phonetic}" added`, 'success');
    }
    setContextMenu(null);
  };

  const applyTemplate = (template: typeof TEMPLATES[0]) => {
    if (activeSegment) updateSegment(activeSegment.id, { script: template.text });
    setShowTemplatesModal(false);
  };

  const [showSegments, setShowSegments] = useState(true);

  return (
    <div className="flex h-full overflow-hidden bg-surface">
      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x} y={contextMenu.y} word={contextMenu.word}
          onAddToDictionary={handleAddToDictionary}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Templates Modal */}
      {showTemplatesModal && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={() => setShowTemplatesModal(false)}>
          <div className="bg-surface border-2 border-text-primary shadow-neo-lg rounded-dialog p-6 w-[600px] max-h-[70vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg text-text-primary">Script Templates</h2>
              <button onClick={() => setShowTemplatesModal(false)} className="text-text-muted hover:text-text-primary text-xl font-bold">×</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {TEMPLATES.map(t => (
                <button key={t.label} onClick={() => applyTemplate(t)}
                  className="p-4 text-left border border-border rounded-card hover:border-accent hover:shadow-neo-sm transition-all group">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-text-primary">{t.label}</span>
                    <span className="text-[10px] font-semibold text-accent bg-accent/10 px-2 py-0.5 rounded-badge">{t.category}</span>
                  </div>
                  <p className="text-[11px] text-text-muted line-clamp-2">{t.text}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* LEFT: Segment Panel */}
      {showSegments && (
        <div className="w-[200px] shrink-0 border-r border-border bg-bg-secondary flex flex-col">
          <div className="px-3 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-accent" />
              <span className="text-xs font-bold text-text-primary uppercase tracking-wider">Segments</span>
            </div>
            <button onClick={addSegment} className="p-1 hover:bg-accent/10 rounded text-accent transition-all" title="Add Segment">
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {segments.map(seg => (
              <SegmentItem
                key={seg.id} segment={seg}
                isActive={seg.id === activeSegmentId}
                onClick={() => setActiveSegmentId(seg.id)}
                onRemove={() => removeSegment(seg.id)}
              />
            ))}
          </div>

          {/* Segment voice selector */}
          {activeSegment && (
            <div className="p-3 border-t border-border space-y-2">
              <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Segment Voice</div>
              <select
                value={activeSegment.voice || selectedVoiceId}
                onChange={e => {
                  const newVoice = e.target.value;
                  setSelectedVoiceId(newVoice);
                }}
                className="w-full text-xs bg-surface border border-border rounded-input px-2 py-1.5 text-text-primary focus:outline-none focus:border-accent font-semibold text-accent"
              >
                {voices.map(v => <option key={v.id} value={v.id}>{v.name} ({v.accent})</option>)}
              </select>
              <div className="flex items-center justify-between text-[10px] font-semibold text-text-secondary">
                <span>Speed</span>
                <span className="font-mono text-accent">{activeSegment.speed.toFixed(2)}×</span>
              </div>
              <input type="range" min="0.5" max="2" step="0.05" value={activeSegment.speed}
                onChange={e => updateSegment(activeSegment.id, { speed: parseFloat(e.target.value) })}
                className="w-full accent-accent cursor-pointer" />
            </div>
          )}
        </div>
      )}

      {/* RIGHT: Editor Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="h-[48px] px-4 border-b border-border bg-bg-secondary flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSegments(s => !s)}
              className={`p-1.5 rounded-input border transition-all ${
                showSegments ? 'bg-accent/10 border-accent text-accent' : 'bg-surface border-border text-text-muted hover:text-text-primary'
              }`}
              title={showSegments ? "Hide Segments Panel" : "Show Segments Panel"}
            >
              <Layers className="w-4 h-4" />
            </button>

            {/* Editable segment name */}
            <input
              value={activeSegment?.name || ''}
              onChange={e => activeSegment && updateSegment(activeSegment.id, { name: e.target.value })}
              className="font-bold text-sm text-text-primary bg-transparent border-b border-transparent hover:border-border focus:border-accent outline-none px-1 py-0.5 max-w-[160px]"
            />

            <div className="flex items-center gap-1 bg-surface px-2 py-1 rounded-input border border-border">
              <button onClick={() => setFontSize(f => Math.max(12, f - 2))} className="text-text-muted hover:text-text-primary p-0.5">
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-mono font-bold text-text-primary px-1">{fontSize}px</span>
              <button onClick={() => setFontSize(f => Math.min(24, f + 2))} className="text-text-muted hover:text-text-primary p-0.5">
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>

            <button onClick={() => setShowSearch(s => !s)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-input border flex items-center gap-1.5 transition-all ${showSearch ? 'bg-accent text-white border-accent' : 'bg-surface text-text-secondary border-border hover:text-text-primary'}`}>
              <Search className="w-3.5 h-3.5" /> Find
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setShowTemplatesModal(true)}
              className="px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/10 rounded-input border border-accent/20 flex items-center gap-1.5 transition-all">
              <Sparkles className="w-3.5 h-3.5" /> Templates
            </button>
            <button onClick={() => activeSegment && updateSegment(activeSegment.id, { script: '' })}
              className="p-1.5 text-text-muted hover:text-danger hover:bg-danger/10 rounded-input transition-all">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Find & Replace */}
        {showSearch && (
          <div className="px-4 py-2.5 border-b border-border bg-surface flex items-center gap-3">
            <input type="text" placeholder="Find…" value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="px-3 py-1.5 bg-bg-secondary rounded-input border border-border text-xs text-text-primary focus:outline-none focus:border-accent w-52" />
            <input type="text" placeholder="Replace with…" value={replaceQuery}
              onChange={e => setReplaceQuery(e.target.value)}
              className="px-3 py-1.5 bg-bg-secondary rounded-input border border-border text-xs text-text-primary focus:outline-none focus:border-accent w-52" />
            <button onClick={handleReplaceAll} className="btn-neo-secondary px-3 py-1.5 text-xs">Replace All</button>
          </div>
        )}

        {/* SSML & Voice Tags Quick-Bar */}
        <div className="px-4 py-1.5 border-b border-border bg-bg-secondary/60 flex items-center gap-2 overflow-x-auto text-[11px] select-none">
          <span className="font-bold text-text-muted uppercase tracking-wider text-[10px] shrink-0">Tags:</span>
          
          <button
            onClick={() => insertTag('[pause:500]')}
            className="px-2 py-0.5 rounded border border-border bg-surface hover:border-accent hover:text-accent font-mono transition-all shrink-0 flex items-center gap-1 text-text-secondary"
            title="Insert 500ms pause"
          >
            ⏱️ [pause:500]
          </button>

          <button
            onClick={() => insertTag('[whisper]', '[/whisper]')}
            className="px-2 py-0.5 rounded border border-border bg-surface hover:border-purple-400 hover:text-purple-400 font-mono transition-all shrink-0 flex items-center gap-1 text-text-secondary"
            title="Wrap in whisper DSP"
          >
            🤫 [whisper]
          </button>

          <button
            onClick={() => insertTag('[em]', '[/em]')}
            className="px-2 py-0.5 rounded border border-border bg-surface hover:border-yellow-400 hover:text-yellow-400 font-mono transition-all shrink-0 flex items-center gap-1 text-text-secondary"
            title="Wrap in vocal emphasis"
          >
            💥 [em]
          </button>

          <button
            onClick={() => insertTag('[speed:0.85]', '[/speed]')}
            className="px-2 py-0.5 rounded border border-border bg-surface hover:border-blue-400 hover:text-blue-400 font-mono transition-all shrink-0 flex items-center gap-1 text-text-secondary"
            title="Override speaking speed"
          >
            🐢 [speed:0.85]
          </button>

          <button
            onClick={() => {
              const v = prompt('Voice ID to switch to (e.g. am_adam, af_bella, bm_george):', 'am_adam');
              if (v) insertTag(`[voice:${v.trim()}]`, '[/voice]');
            }}
            className="px-2 py-0.5 rounded border border-border bg-surface hover:border-green-400 hover:text-green-400 font-mono transition-all shrink-0 flex items-center gap-1 text-text-secondary"
            title="Switch voice for dialogue block"
          >
            🗣️ [voice:...]
          </button>

          <button
            onClick={() => insertTag('[sher]\n', '\n[/sher]')}
            className="px-2 py-0.5 rounded border border-border bg-surface hover:border-pink-400 hover:text-pink-400 font-mono transition-all shrink-0 flex items-center gap-1 text-text-secondary"
            title="Urdu Poetry Mode (misra splits + 600ms pauses)"
          >
            📜 [sher]
          </button>

          <button
            onClick={() => {
              const e = prompt('Emotion to force (dramatic, sad, energetic, whispering, news, sher, urdu_poetry, hindi_cinematic, qawwali_style):', 'dramatic');
              if (e) insertTag(`[emotion:${e.trim()}]`, '[/emotion]');
            }}
            className="px-2 py-0.5 rounded border border-border bg-surface hover:border-orange-400 hover:text-orange-400 font-mono transition-all shrink-0 flex items-center gap-1 text-text-secondary"
            title="Force specific emotion preset"
          >
            🎭 [emotion:...]
          </button>

          {/* Roman Urdu / Hindi Transliterate Quick Button */}
          {(() => {
            const lower = (script || '').toLowerCase();
            const isUrdu = ['mujhe', 'tumse', 'tere', 'bina', 'jeena', 'mushkil', 'aansu', 'tanha', 'dard', 'zindagi', 'shair', 'shayari', 'ghazal', 'mehboob'].some(w => lower.includes(w));
            const isHindi = ['namaste', 'batao', 'samajh', 'khatarnaak', 'aazadi', 'bhai', 'dost'].some(w => lower.includes(w));

            if (isUrdu) {
              return (
                <span className="ml-auto flex items-center gap-1.5 px-2 py-0.5 rounded bg-accent/10 border border-accent/30 text-accent font-bold text-[10px]">
                  🇵🇰 Roman Urdu Detected
                </span>
              );
            }
            if (isHindi) {
              return (
                <span className="ml-auto flex items-center gap-1.5 px-2 py-0.5 rounded bg-orange-500/10 border border-orange-500/30 text-orange-400 font-bold text-[10px]">
                  🇮🇳 Roman Hindi Detected
                </span>
              );
            }
            return null;
          })()}
        </div>

        {/* Editor with line numbers */}
        <div className="flex-1 flex overflow-hidden">
          <div className="w-10 bg-bg-secondary/40 border-r border-divider py-4 font-mono text-[11px] text-text-muted text-right pr-2 select-none shrink-0 overflow-hidden">
            {Array.from({ length: Math.max(lineCount, 20) }).map((_, i) => (
              <div key={i} style={{ height: `${fontSize * 1.5}px`, lineHeight: `${fontSize * 1.5}px` }}>{i + 1}</div>
            ))}
          </div>
          <textarea
            ref={textareaRef}
            value={script}
            onChange={e => activeSegment && updateSegment(activeSegment.id, { script: e.target.value })}
            onContextMenu={handleContextMenu}
            style={{ fontSize, lineHeight: `${fontSize * 1.5}px` }}
            className="flex-1 p-4 text-text-primary font-sans focus:outline-none resize-none bg-transparent border-none"
            placeholder="Write your narration script here, or pick a template…"
          />
        </div>

        {/* Generation Progress Bar */}
        {isRendering && (
          <div className="px-4 py-2 bg-accent/5 border-t border-accent/20 flex items-center gap-3">
            <Loader2 className="w-4 h-4 text-accent animate-spin shrink-0" />
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-accent">Synthesizing…</span>
                <span className="text-text-muted font-mono">{progressPct}%</span>
              </div>
              <div className="h-1.5 bg-border rounded-full overflow-hidden">
                <div className="h-full bg-accent transition-all duration-300 rounded-full" style={{ width: `${progressPct}%` }} />
              </div>
              {generationJob.current_chunk_text && (
                <div className="text-[11px] text-text-muted italic truncate">"{generationJob.current_chunk_text}…"</div>
              )}
            </div>
            <span className="text-xs font-mono text-text-muted">
              {generationJob.progress}/{generationJob.total_chunks}
            </span>
          </div>
        )}

        {/* Bottom stats bar */}
        <div className="h-[44px] px-4 border-t border-border bg-bg-secondary flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center gap-5 text-xs font-medium text-text-secondary">
            <span><strong className="text-text-primary">{charCount}</strong> chars</span>
            <span><strong className="text-text-primary">{wordCount}</strong> words</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-accent" />
              <strong className="text-text-primary">~{estDisplay}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            {segments.length > 1 && (
              <button onClick={renderAllSegments} disabled={isRendering}
                className="btn-neo-secondary px-3 py-1.5 text-xs flex items-center gap-1.5 disabled:opacity-50">
                <Layers className="w-3.5 h-3.5 text-accent" /> Render All ({segments.length})
              </button>
            )}
            <button
              onClick={() => activeSegment && startGeneration(script, activeSegment.id)}
              disabled={isRendering || !script.trim()}
              className="btn-neo px-4 py-1.5 text-xs flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed">
              {isRendering
                ? <><Loader2 className="w-3.5 h-3.5 text-white animate-spin" /> Rendering…</>
                : <><Wand2 className="w-3.5 h-3.5 text-white" /> Render Segment</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
