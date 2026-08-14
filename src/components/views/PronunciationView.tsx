import React, { useState, useEffect } from 'react';
import { BookOpen, Plus, Trash2, Sparkles, CheckCircle2 } from 'lucide-react';

export const PronunciationView: React.FC = () => {
  const [globalRules, setGlobalRules] = useState<any[]>([]);
  const [targetWord, setTargetWord] = useState('');
  const [replacePhonetic, setReplacePhonetic] = useState('');
  const [testInput, setTestInput] = useState('I love querying SQL databases with API endpoints in ProVoice Studio.');

  const fetchDictionary = async () => {
    try {
      const res = await fetch('/api/dictionary');
      if (res.ok) {
        const data = await res.json();
        setGlobalRules(data.global_rules || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchDictionary();
  }, []);

  const handleAddRule = async () => {
    if (!targetWord.trim() || !replacePhonetic.trim()) return;

    await fetch('/api/dictionary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        word: targetWord,
        replace: replacePhonetic,
        is_global: true,
      }),
    });

    setTargetWord('');
    setReplacePhonetic('');
    fetchDictionary();
  };

  // Compute live test transformation
  let testOutput = testInput;
  globalRules.forEach((rule) => {
    if (rule.word && rule.replace) {
      const regex = new RegExp(`\\b${rule.word}\\b`, 'gi');
      testOutput = testOutput.replace(regex, rule.replace);
    }
  });

  return (
    <div className="p-8 space-y-6 max-w-[1400px] mx-auto select-none">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-accent" /> Pronunciation Dictionary
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Configure global and project phonetic rules so acronyms, brand names, and complex words are pronounced correctly every time.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Rules Table (2 Cols) */}
        <div className="lg:col-span-2 card-neo p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-base text-text-primary">Phonetic Rules</h2>
            <span className="text-xs text-text-muted">{globalRules.length} Active Rules</span>
          </div>

          {/* Add Rule Form */}
          <div className="p-4 bg-bg-secondary rounded-input border border-border flex items-center gap-3">
            <input
              type="text"
              placeholder="Target Word (e.g. SQL)"
              value={targetWord}
              onChange={(e) => setTargetWord(e.target.value)}
              className="flex-1 px-3 py-2 bg-surface rounded-input border border-border text-xs text-text-primary focus:outline-none focus:border-accent"
            />
            <span className="text-xs text-text-muted font-bold">→</span>
            <input
              type="text"
              placeholder="Phonetic (e.g. Sequel)"
              value={replacePhonetic}
              onChange={(e) => setReplacePhonetic(e.target.value)}
              className="flex-1 px-3 py-2 bg-surface rounded-input border border-border text-xs text-text-primary focus:outline-none focus:border-accent"
            />
            <button
              onClick={handleAddRule}
              className="btn-neo px-4 py-2 text-xs flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Add Rule
            </button>
          </div>

          {/* List */}
          <div className="divide-y divide-border border border-border rounded-input overflow-hidden">
            <div className="bg-bg-secondary px-4 py-2.5 text-xs font-bold text-text-secondary flex justify-between">
              <span>Original Text</span>
              <span>Pronounced As</span>
            </div>
            {globalRules.map((rule, idx) => (
              <div key={idx} className="px-4 py-3 text-xs flex items-center justify-between">
                <span className="font-bold text-text-primary">{rule.word}</span>
                <span className="font-mono text-accent font-semibold">{rule.replace}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Live Rule Substitution Tester (1 Col) */}
        <div className="card-neo p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-accent" />
            <h2 className="font-bold text-base text-text-primary">Rule Tester</h2>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-text-secondary">Input Script Text</label>
            <textarea
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              rows={3}
              className="w-full p-3 bg-bg-secondary rounded-input border border-border text-xs text-text-primary focus:outline-none focus:border-accent resize-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-text-secondary">Transformed Speech Text</label>
            <div className="p-3 bg-accent/5 rounded-input border border-accent/20 text-xs font-mono text-text-primary leading-relaxed">
              {testOutput}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
