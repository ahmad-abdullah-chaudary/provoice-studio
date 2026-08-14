import React, { useState, useEffect } from 'react';
import { Code2, Copy, CheckCheck, Globe, Webhook, Play, AlertCircle, Trash2, Plus } from 'lucide-react';

interface WebhookEntry {
  id: string; name: string; url: string; event: string;
  registered_at: number; enabled: boolean;
}

const CODE_EXAMPLES: Record<string, string> = {
  synthesize: `# POST /api/v1/tts/synthesize
curl -X POST http://localhost:8000/api/v1/tts/synthesize \\
  -H "Content-Type: application/json" \\
  -d '{
    "text": "Hello from the REST API!",
    "voice": "af_bella",
    "speed": 1.0,
    "lang": "en-us",
    "emotion": "normal"
  }'`,
  poll: `# GET /api/jobs/{job_id}
curl http://localhost:8000/api/jobs/{job_id}

# Response:
# { "status": "complete", "audio_url": "/api/audio/xxx.wav", "duration": 3.2 }`,
  voices: `# GET /api/v1/voices
curl http://localhost:8000/api/v1/voices`,
  webhook_register: `# POST /api/webhooks/register
curl -X POST http://localhost:8000/api/webhooks/register \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "http://localhost:9000/hook",
    "event": "generation.complete",
    "name": "My Automation Hook"
  }'`,
  python: `import requests, time

BASE = "http://localhost:8000/api"

# Start generation
r = requests.post(f"{BASE}/v1/tts/synthesize", json={
    "text": "Hello from Python automation!",
    "voice": "af_bella",
    "lang": "en-us",
    "emotion": "dramatic"
})
job_id = r.json()["job_id"]

# Poll until complete
while True:
    status = requests.get(f"{BASE}/jobs/{job_id}").json()
    if status["status"] == "complete":
        print("Audio URL:", status["audio_url"])
        break
    time.sleep(0.6)`,
};

const EndpointBadge: React.FC<{ method: string }> = ({ method }) => {
  const colors: Record<string, string> = {
    GET: 'text-green-400 bg-green-400/10 border-green-400/30',
    POST: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
    DELETE: 'text-red-400 bg-red-400/10 border-red-400/30',
  };
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border font-mono ${colors[method] || ''}`}>
      {method}
    </span>
  );
};

const CodeBlock: React.FC<{ code: string; lang?: string }> = ({ code, lang = 'bash' }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative rounded-lg border border-border bg-black/60 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/50 bg-black/40">
        <span className="text-[10px] font-mono text-text-muted">{lang}</span>
        <button onClick={copy}
          className="flex items-center gap-1 text-[10px] text-text-muted hover:text-accent transition-colors">
          {copied ? <CheckCheck className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="p-3 text-xs text-green-300 overflow-x-auto font-mono leading-relaxed whitespace-pre">
        {code}
      </pre>
    </div>
  );
};

export const ApiView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'endpoints' | 'webhooks' | 'examples'>('endpoints');
  const [webhooks, setWebhooks] = useState<WebhookEntry[]>([]);
  const [newHookUrl, setNewHookUrl] = useState('');
  const [newHookEvent, setNewHookEvent] = useState('generation.complete');
  const [newHookName, setNewHookName] = useState('');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testLoading, setTestLoading] = useState(false);

  const fetchWebhooks = async () => {
    try {
      const res = await fetch('/api/webhooks');
      if (res.ok) { const d = await res.json(); setWebhooks(d.webhooks || []); }
    } catch {}
  };

  useEffect(() => { fetchWebhooks(); }, []);

  const registerWebhook = async () => {
    if (!newHookUrl) return;
    try {
      const res = await fetch('/api/webhooks/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newHookUrl, event: newHookEvent, name: newHookName }),
      });
      if (res.ok) { fetchWebhooks(); setNewHookUrl(''); setNewHookName(''); }
    } catch {}
  };

  const deleteWebhook = async (id: string) => {
    try {
      await fetch(`/api/webhooks/${id}`, { method: 'DELETE' });
      fetchWebhooks();
    } catch {}
  };

  const testEndpoint = async () => {
    setTestLoading(true); setTestResult(null);
    try {
      const res = await fetch('/api/v1/voices');
      const data = await res.json();
      setTestResult(JSON.stringify({ status: res.status, voices_count: data.voices?.length || 0, api_version: data.api_version }, null, 2));
    } catch (e: any) {
      setTestResult(`Error: ${e.message}`);
    } finally {
      setTestLoading(false);
    }
  };

  const ENDPOINTS = [
    { method: 'POST', path: '/api/v1/tts/synthesize', desc: 'Start TTS generation job. Returns job_id.' },
    { method: 'GET', path: '/api/v1/voices', desc: 'List all available voices.' },
    { method: 'GET', path: '/api/jobs/{job_id}', desc: 'Poll job status, progress, and audio_url.' },
    { method: 'GET', path: '/api/audio/{filename}', desc: 'Stream or download generated audio file.' },
    { method: 'GET', path: '/api/emotion-presets', desc: 'List emotion/style presets (dramatic, whispering, etc.).' },
    { method: 'POST', path: '/api/timeline/render', desc: 'Mix multi-track timeline into a WAV file.' },
    { method: 'POST', path: '/api/video/extract', desc: 'Extract audio from uploaded video file.' },
    { method: 'POST', path: '/api/video/export', desc: 'Mux narration audio into video via FFmpeg.' },
    { method: 'GET', path: '/api/webhooks', desc: 'List all registered webhook subscribers.' },
    { method: 'POST', path: '/api/webhooks/register', desc: 'Register a new webhook endpoint.' },
    { method: 'DELETE', path: '/api/webhooks/{id}', desc: 'Remove a webhook subscriber.' },
    { method: 'POST', path: '/api/generate', desc: 'Legacy generation endpoint (same as v1/synthesize).' },
    { method: 'GET', path: '/api/voices', desc: 'Legacy voices list endpoint.' },
  ];

  const tabs = [
    { id: 'endpoints' as const, label: 'Endpoints', icon: Globe },
    { id: 'webhooks' as const, label: 'Webhooks', icon: Webhook },
    { id: 'examples' as const, label: 'Code Examples', icon: Code2 },
  ];

  return (
    <div className="flex flex-col h-full bg-bg-primary overflow-hidden">
      {/* Header */}
      <div className="h-14 border-b border-border bg-surface flex items-center px-4 gap-3 shrink-0">
        <Code2 className="w-5 h-5 text-accent" />
        <h2 className="font-bold text-text-primary text-base">REST API</h2>
        <span className="text-xs text-text-muted bg-green-500/10 border border-green-500/30 text-green-400 px-2 py-0.5 rounded-full font-mono">
          v1 · localhost:8000
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={testEndpoint}
            disabled={testLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-button text-xs font-semibold border border-border text-text-secondary hover:text-text-primary hover:border-accent/50 transition-all"
          >
            {testLoading
              ? <div className="w-3.5 h-3.5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
              : <Play className="w-3.5 h-3.5" />
            }
            Test API
          </button>
        </div>
      </div>

      {/* Test result banner */}
      {testResult && (
        <div className="px-4 py-2 bg-green-500/10 border-b border-green-500/20 text-xs font-mono text-green-300 flex items-start gap-2">
          <CheckCheck className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <pre className="truncate">{testResult}</pre>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border bg-surface shrink-0">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === t.id
                  ? 'border-accent text-text-primary'
                  : 'border-transparent text-text-muted hover:text-text-secondary'
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {/* Endpoints Tab */}
        {activeTab === 'endpoints' && (
          <div className="space-y-2 max-w-3xl">
            <div className="text-xs text-text-muted mb-3">
              All endpoints available at <code className="bg-black/40 px-1.5 py-0.5 rounded text-green-300 font-mono">http://localhost:8000</code>
            </div>
            {ENDPOINTS.map((ep, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-surface hover:border-accent/30 transition-colors">
                <EndpointBadge method={ep.method} />
                <code className="text-xs text-text-primary font-mono flex-1 truncate">{ep.path}</code>
                <span className="text-xs text-text-muted hidden sm:block text-right">{ep.desc}</span>
              </div>
            ))}
          </div>
        )}

        {/* Webhooks Tab */}
        {activeTab === 'webhooks' && (
          <div className="space-y-4 max-w-2xl">
            {/* Register form */}
            <div className="p-4 rounded-xl border border-border bg-surface space-y-3">
              <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                <Plus className="w-4 h-4 text-accent" /> Register Webhook
              </h3>
              <input
                value={newHookName}
                onChange={(e) => setNewHookName(e.target.value)}
                placeholder="Hook name (optional)"
                className="w-full px-3 py-2 rounded-input border border-border bg-bg-secondary text-text-primary text-sm"
              />
              <input
                value={newHookUrl}
                onChange={(e) => setNewHookUrl(e.target.value)}
                placeholder="http://localhost:9000/webhook"
                className="w-full px-3 py-2 rounded-input border border-border bg-bg-secondary text-text-primary text-sm font-mono"
              />
              <div className="flex gap-2">
                <select
                  value={newHookEvent}
                  onChange={(e) => setNewHookEvent(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-input border border-border bg-bg-secondary text-text-primary text-sm"
                >
                  <option value="*">* (all events)</option>
                  <option value="generation.complete">generation.complete</option>
                  <option value="generation.failed">generation.failed</option>
                  <option value="queue.job.done">queue.job.done</option>
                </select>
                <button
                  onClick={registerWebhook}
                  disabled={!newHookUrl}
                  className="px-4 py-2 rounded-button text-sm font-bold bg-accent text-white border-2 border-text-primary shadow-neo-sm hover:translate-y-[-1px] active:translate-y-0 transition-all disabled:opacity-50"
                >
                  Register
                </button>
              </div>
            </div>

            {/* List */}
            {webhooks.length === 0 ? (
              <div className="text-center py-10 text-text-muted text-sm">
                <Webhook className="w-8 h-8 mx-auto mb-2 opacity-30" />
                No webhooks registered yet
              </div>
            ) : (
              <div className="space-y-2">
                {webhooks.map((h) => (
                  <div key={h.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-surface">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${h.enabled ? 'bg-green-400' : 'bg-border'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-text-primary truncate">{h.name || h.url}</div>
                      <div className="text-[11px] text-text-muted font-mono truncate">{h.url}</div>
                    </div>
                    <span className="text-[10px] font-mono border border-border px-1.5 py-0.5 rounded text-text-muted">{h.event}</span>
                    <button onClick={() => deleteWebhook(h.id)}
                      className="w-6 h-6 flex items-center justify-center rounded text-text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Code Examples Tab */}
        {activeTab === 'examples' && (
          <div className="space-y-6 max-w-3xl">
            <div>
              <h3 className="text-sm font-bold text-text-primary mb-2">1. Synthesize Speech (cURL)</h3>
              <CodeBlock code={CODE_EXAMPLES.synthesize} lang="bash" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-text-primary mb-2">2. Poll Job Status</h3>
              <CodeBlock code={CODE_EXAMPLES.poll} lang="bash" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-text-primary mb-2">3. List Voices</h3>
              <CodeBlock code={CODE_EXAMPLES.voices} lang="bash" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-text-primary mb-2">4. Register Webhook</h3>
              <CodeBlock code={CODE_EXAMPLES.webhook_register} lang="bash" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-text-primary mb-2">5. Python Automation Example</h3>
              <CodeBlock code={CODE_EXAMPLES.python} lang="python" />
            </div>
            <div className="p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 text-xs text-yellow-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              All endpoints are local-only (localhost:8000). No API key needed. Zero cloud dependencies.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ApiView;
