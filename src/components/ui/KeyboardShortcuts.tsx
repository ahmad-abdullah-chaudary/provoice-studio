import React, { useEffect, useCallback } from 'react';
import { useStudioStore } from '@/store/useStudioStore';

export const KeyboardShortcuts: React.FC = () => {
  const store = useStudioStore();

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement)?.tagName;
    const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

    // ─── Global shortcuts (work everywhere) ───
    // Ctrl+Enter → Generate speech
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      const { segments, activeSegmentId, startGeneration, generationJob } = store;
      if (generationJob.status !== 'processing') {
        const seg = segments.find(s => s.id === activeSegmentId);
        if (seg?.script.trim()) startGeneration(seg.script, seg.id);
      }
      return;
    }

    // Ctrl+S → Save project
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      store.saveCurrentProject();
      return;
    }

    // Skip other shortcuts when typing in an input
    if (isTyping) return;

    // Space → Play / Pause audio
    if (e.key === ' ') {
      e.preventDefault();
      const audio = document.querySelector<HTMLAudioElement>('audio');
      if (audio) {
        if (audio.paused) audio.play();
        else audio.pause();
        store.setIsPlaying(!audio.paused);
      }
      return;
    }

    // Ctrl+1-8 → Switch tabs
    if (e.ctrlKey) {
      const tabs = ['dashboard', 'editor', 'voices', 'batch', 'queue', 'dictionary', 'history', 'settings'] as const;
      const idx = parseInt(e.key) - 1;
      if (idx >= 0 && idx < tabs.length) {
        e.preventDefault();
        store.setActiveTab(tabs[idx]);
        return;
      }
    }

    // N → New segment (in editor)
    if (e.key === 'n' && store.activeTab === 'editor') {
      e.preventDefault();
      store.addSegment();
      return;
    }

    // Escape → Close modals
    if (e.key === 'Escape') {
      if (store.showExportModal) store.setShowExportModal(false);
      if (store.showTemplatesModal) store.setShowTemplatesModal(false);
      return;
    }

    // E → Open export modal
    if (e.key === 'e' && store.currentAudioUrl) {
      e.preventDefault();
      store.setShowExportModal(true);
      return;
    }

    // T → Open templates
    if (e.key === 't' && store.activeTab === 'editor') {
      e.preventDefault();
      store.setShowTemplatesModal(true);
      return;
    }
  }, [store]);

  useEffect(() => {
    // Request notification permission on mount
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return null; // This component is purely behavioral
};

// Shortcut Help Overlay Component
export const ShortcutHelp: React.FC = () => {
  const shortcuts = [
    { key: 'Ctrl + Enter', action: 'Generate narration' },
    { key: 'Ctrl + S', action: 'Save project' },
    { key: 'Space', action: 'Play / Pause audio' },
    { key: 'E', action: 'Open export dialog' },
    { key: 'T', action: 'Open script templates' },
    { key: 'N', action: 'Add new segment (in editor)' },
    { key: 'Esc', action: 'Close modals' },
    { key: 'Ctrl + 1–8', action: 'Switch between views' },
  ];

  return (
    <div className="p-4 space-y-2">
      <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider mb-3">Keyboard Shortcuts</h3>
      {shortcuts.map(s => (
        <div key={s.key} className="flex items-center justify-between text-xs">
          <kbd className="px-2 py-0.5 bg-bg-secondary border border-border rounded text-text-primary font-mono font-bold text-[10px]">
            {s.key}
          </kbd>
          <span className="text-text-secondary">{s.action}</span>
        </div>
      ))}
    </div>
  );
};
