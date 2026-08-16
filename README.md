<div align="center">

<img src="https://img.shields.io/badge/ProVoice_Studio-v1.0-blueviolet?style=for-the-badge&logo=soundcloud&logoColor=white" alt="version"/>
<img src="https://img.shields.io/badge/Offline_First-100%25-success?style=for-the-badge&logo=wifi-off&logoColor=white" alt="offline"/>
<img src="https://img.shields.io/badge/62_Voices-Multi_Lingual-orange?style=for-the-badge&logo=translate&logoColor=white" alt="voices"/>
<img src="https://img.shields.io/badge/Studio_Grade_DSP-LUFS_EQ_Exciter-red?style=for-the-badge&logo=audacity&logoColor=white" alt="dsp"/>
<img src="https://img.shields.io/badge/FastAPI_+_React-Full_Stack-cyan?style=for-the-badge&logo=fastapi&logoColor=white" alt="stack"/>

# 🎙️ ProVoice Studio

### *Studio-Grade Offline AI Voice Production & Multi-Lingual Dubbing Suite*

> The most powerful offline AI voice studio ever built — 62 voices across 10 languages, real-time DSP, SSML scripting, NLP auto-emotion, Hinglish transliteration, batch ZIP rendering, and broadcast-ready audio processing. All running **100% locally** on your machine.

[**🚀 Quick Start**](#-quick-start) · [**🌍 Voice Library**](#-voice-library) · [**🎭 SSML Tags**](#-ssml-script-tags--nlp-auto-emotion) · [**🔥 DSP Pipeline**](#-studio-grade-dsp-fx-pipeline) · [**📦 Batch Export**](#-batch-rendering--zip-export) · [**📖 API Reference**](#-api-reference)

---

</div>

## 📋 Table of Contents

- [Why ProVoice Studio?](#-why-provoice-studio)
- [Feature Highlights](#-feature-highlights)
- [Voice Library](#-voice-library)
- [Quick Start](#-quick-start)
- [Model File Downloads](#-model-file-downloads)
- [Script Editor & Workflow Controls](#-script-editor--workflow-controls)
- [Batch Rendering & ZIP Export](#-batch-rendering--zip-export)
- [SSML Script Tags & NLP Auto-Emotion](#-ssml-script-tags--nlp-auto-emotion)
- [Studio-Grade DSP FX Pipeline](#-studio-grade-dsp-fx-pipeline)
- [Architecture](#-architecture)
- [API Reference](#-api-reference)
- [Network Access](#-network-access)
- [Contributing](#-contributing)

---

## 🌟 Why ProVoice Studio?

Most TTS tools are either cloud-locked, have a tiny voice library, or produce robotic monotone audio. **ProVoice Studio** is different:

| Feature | ProVoice Studio | Cloud TTS | Basic TTS |
|---|:---:|:---:|:---:|
| 100% Offline (Zero API Costs) | ✅ | ❌ | ⚠️ |
| Dual-Engine (Kokoro ONNX + Silero v4_indic) | ✅ | ❌ | ❌ |
| 62 Voices / 10 Languages | ✅ | ⚠️ | ❌ |
| Batch Multi-Segment ZIP Export | ✅ | ❌ | ❌ |
| Broadcast LUFS Normalization | ✅ | ❌ | ❌ |
| SSML Inline Tags & Poetry Mode | ✅ | ⚠️ | ❌ |
| NLP Auto-Emotion Engine | ✅ | ❌ | ❌ |
| Hinglish & Roman Urdu Auto-Transliteration | ✅ | ❌ | ❌ |
| Harmonic Exciter, De-Esser & 3-Band EQ | ✅ | ❌ | ❌ |
| Micro-Variation (anti-robotic cadence) | ✅ | ❌ | ❌ |
| Multi-Track Timeline & Video Sync | ✅ | ❌ | ❌ |
| Network LAN Access | ✅ | ✅ | ❌ |

---

## ✨ Feature Highlights

### 🎙️ Multi-Engine TTS Architecture
- **Kokoro ONNX** — Ultra-fast CPU-accelerated neural TTS engine (8-thread optimized) for English, Hindi, Japanese, French, Spanish, Italian, Portuguese, and Mandarin.
- **Silero PyTorch Indic (`v4_indic`)** — Offline Indic neural engine for authentic Hindi voices (Kabir & Swara) running native 48kHz synthesis with polyphase anti-aliasing and studio broadcast mastering (warm speaker bass foundation, clean throat anti-boxiness, and direct mouth projection).
- **Edge Neural TTS** — Microsoft Azure Neural voices for Indian, Urdu, and multilingual support.

### ⚡ Smart Script Editor & Workflow Automation
- **No Unwanted Auto-Play**: Generated segments load in the background in a paused state — trigger playback anytime with <kbd>Space</kbd> or the Play button.
- **One-Click Batch Adjustments**:
  - **Adjust to All (Speed)**: Set speed on any segment and sync it across all segments instantly.
  - **Select for All (Voice)**: Change voice on one segment and apply it across all segments with a single click.
- **Multi-Segment Studio**: Break large scripts into scenes/segments with custom voices, speed multipliers, and independent render status tracking.

### 📦 Batch Rendering & Multi-Format ZIP Export
- **Render All**: Sequential synthesis of all script segments with real-time progress indicators.
- **Download All (ZIP)**: Export 20, 30, or 100+ rendered audio segments in a single organized ZIP archive (`01_Scene_1.mp3`, `02_Scene_2.mp3`, ...).
- **Format & Quality Presets**:
  - **Formats**: `WAV`, `MP3`, `FLAC`, `OGG`
  - **Bitrates**: Draft (`128 kbps`), Standard (`192 kbps`), Studio (`320 kbps`), Lossless (`320 kbps / FLAC`)

### 🇵🇰 Roman Urdu & 🇮🇳 Hinglish Auto-Transliteration
Write Roman Urdu (*"mujhe tumse pyar hai..."*) or Roman Hindi (*"Ek raat ne sab kuch badal diya..."*) and ProVoice Studio automatically converts Roman Urdu to Nastaliq Urdu script (*"مجھے تم سے پیار ہے..."*) and Roman Hindi to Devanagari (*"एक रात ने..."*) before synthesis — zero manual typing effort!

### 🎭 SSML Script Tags, NLP Auto-Emotion & Urdu Poetry Mode
Full inline voice scripting: pause, whisper, voice-switch, speed control, emphasis, forced emotion, and **Urdu Poetry (`[sher]`) mode** — all directly inside your script text. NLP engine auto-detects dramatic, sad, energetic, news, and poetry-style sentences in English, Hindi, and Urdu.

### 🔥 Studio-Grade DSP Pipeline & Audio Inspector
10-stage broadcast processing chain: Micro-Variation → Breath Injection → Silence Trim → Noise Gate → De-Esser → Harmonic Exciter → 3-Band Parametric EQ → Dynamic Compressor → Limiter → LUFS Normalization.

### 🎬 Multi-Track Timeline & Video Sync
Full visual timeline editor with Narration, Music, SFX, and Video tracks. Auto-ducking music mixer, video dubbing overlay, and subtitle synchronization.

### 📡 Batch Queue & Project Management
Generate hundreds of audio clips in a background queue. Save/restore full project state with all segment voices, DSP settings, and scripts.

---

## 🌍 Voice Library

ProVoice Studio ships with **62 production voices** across 10 languages:

| Flag | Language | Voices | Engine |
|:---:|---|:---:|---|
| 🇺🇸 | American English | 20 (11 Female, 9 Male) | Kokoro ONNX |
| 🇬🇧 | British English | 8 (4 Female, 4 Male) | Kokoro ONNX |
| 🇮🇳 | Hindi & Hinglish | 6 (3 Female, 3 Male) | Kokoro ONNX + Silero v4_indic |
| 🇪🇸 | Spanish | 3 (1 Female, 2 Male) | Kokoro ONNX |
| 🇫🇷 | French | 1 (1 Female) | Kokoro ONNX |
| 🇮🇹 | Italian | 2 (1 Female, 1 Male) | Kokoro ONNX |
| 🇯🇵 | Japanese | 5 (4 Female, 1 Male) | Kokoro ONNX |
| 🇧🇷 | Brazilian Portuguese | 3 (1 Female, 2 Male) | Kokoro ONNX |
| 🇨🇳 | Mandarin Chinese | 8 (4 Female, 4 Male) | Kokoro ONNX |

**🇮🇳 Indic & Hindi Voices at a glance:**

| Voice ID | Name | Gender | Engine | Style |
|---|---|:---:|---|---|
| `silero_hindi_male` | Kabir (कबीर) | Male | Silero v4_indic | Rich, Crisp Reel King & Hindi Narrator |
| `silero_hindi_female` | Swara (स्वरा) | Female | Silero v4_indic | Warm, Clear Studio Hindi Female |
| `hf_alpha` | Alpha (अल्फा) | Female | Kokoro ONNX | Warm Natural Hindi & Hinglish Female |
| `hf_beta` | Beta (बीटा) | Female | Kokoro ONNX | Expressive Hindi Storyteller Female |
| `hm_omega` | Omega (ओमेगा) | Male | Kokoro ONNX | Deep Authoritative Hindi Narrator |
| `hm_psi` | Psi (साई) | Male | Kokoro ONNX | Clear Hindi Broadcasting Voice |

---

## 🚀 Quick Start

### Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| **Node.js** | ≥ 18.x | Frontend React/Vite dev server |
| **Python** | 3.10 – 3.12 | FastAPI backend & AI engines |
| **FFmpeg** | Any recent | Audio convert, batch ZIP export, timeline mixing |
| **Git** | Any | Clone repository |

> **Windows users**: Download FFmpeg from [ffmpeg.org](https://ffmpeg.org/download.html) and add to PATH.

---

### Step 1 — Clone the Repository

```bash
git clone https://github.com/ahmad-abdullah-chaudary/provoice-studio.git
cd provoice-studio
```

---

### Step 2 — Download AI Model Files

ProVoice Studio requires two model weight files that are **not included** in the repository due to their size. Download them and place them in the **project root directory**.

#### 📦 Kokoro ONNX Model (~310 MB)
```
kokoro-v1.0.onnx
```
**Direct Download:**
> 🔗 **[kokoro-v1.0.onnx](https://github.com/taylorchu/kokoro-onnx/releases/download/v0.2.0/kokoro.onnx)** — Rename to `kokoro-v1.0.onnx` after download

#### 🔊 Voice Embeddings (~27 MB)
```
voices-v1.0.bin
```
**Direct Download:**
> 🔗 **[voices-v1.0.bin](https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin)** — Place as-is in the project root

#### 🇮🇳 Silero PyTorch Indic (Auto-Downloaded)
The Silero Indic model for offline Hindi voices is **automatically downloaded on first use** via `torch.hub`. No manual steps required — just select any `Silero Indic` voice and it will download and cache itself.

Alternatively, pre-download with:
```python
import torch
model, _ = torch.hub.load('snakers4/silero-models', 'silero_tts', language='indic', speaker='v3_indic', trust_repo=True)
```

**Your project root should look like this after downloads:**
```
provoice-studio/
├── kokoro-v1.0.onnx        ✅ ~310 MB (downloaded)
├── voices-v1.0.bin         ✅ ~27 MB  (downloaded)
├── backend/
├── src/
├── package.json
└── ...
```

---

### Step 3 — Install Dependencies

**Frontend:**
```bash
npm install
```

**Backend:**
```bash
pip install fastapi uvicorn kokoro-onnx onnxruntime numpy scipy psutil torch torchaudio soundfile aiofiles aksharamukha
```

---

### Step 4 — Launch the Studio

**Option A: One-Click PowerShell Launch (Windows — Recommended)**
```powershell
.\start.ps1
```
*Automatically starts both FastAPI backend + Vite frontend, detects your LAN IP, and displays local + network access URLs in the console.*

**Option B: Manual Launch**
```bash
# Terminal 1 — Backend API (port 8000)
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000

# Terminal 2 — Frontend Dev Server (port 3000)
npm run dev
```

Open in your browser:
- **Local:** `http://localhost:3000`
- **Network:** `http://[YOUR-LAN-IP]:3000`

---

## 📝 Script Editor & Workflow Controls

### Key Features:
1. **Multi-Segment Timeline**: Create unlimited scenes/segments with custom names and individual voice assignments.
2. **Batch Controls**:
   - **Adjust to All**: Click next to the speed slider to set all segments to the active speed multiplier.
   - **Select for All**: Click next to the voice dropdown to set all segments to the active voice.
3. **No Auto-Play on Render**: Audio loads silently in the background — use <kbd>Space</kbd> to listen on demand.
4. **Keyboard Shortcuts**:
   - <kbd>Space</kbd>: Play / Pause audio
   - <kbd>Ctrl</kbd> + <kbd>Enter</kbd>: Render active segment
   - <kbd>Ctrl</kbd> + <kbd>S</kbd>: Save project
   - <kbd>Ctrl</kbd> + <kbd>1-8</kbd>: Switch view tabs
   - <kbd>E</kbd>: Open Export Audio Modal
   - <kbd>N</kbd>: Add new segment

---

## 📦 Batch Rendering & ZIP Export

When working with long-form scripts or YouTube videos with dozens of segments:
1. Click **Render All ({count})** to sequentially generate all segments.
2. Click **Download All ({count})** to open the Export Modal.
3. Choose your desired format (`MP3`, `WAV`, `FLAC`, `OGG`) and quality preset (`Draft`, `Standard`, `Studio`, `Lossless`).
4. Click **Export MP3 (ZIP)** to download all segments packaged into a single organized ZIP archive.

---

## 🎭 SSML Script Tags & NLP Auto-Emotion

ProVoice Studio supports **inline script control tags** — type them directly into your script in the editor:

### Tag Reference

| Tag | Example | Description |
|---|---|---|
| `[pause:ms]` | `[pause:500]` | Insert exact millisecond silence |
| `[break:ms]` | `[break:800]` | Alias for pause |
| `[whisper]` | `[whisper]She quietly said...[/whisper]` | Apply whisper DSP + treble boost |
| `[em]` | `[em]This is critical![/em]` | Emphasis: slower + presence boost |
| `[speed:N]` | `[speed:0.85]Slow this down[/speed]` | Speed override (0.3 – 3.0) |
| `[voice:ID]` | `[voice:silero_hindi_male]He said...[/voice]` | Switch voice for dialogue block |
| `[emotion:NAME]` | `[emotion:dramatic]The city fell.[/emotion]` | Force emotion preset |
| `[sher]` | `[sher]mujhe tumse pyar hai\ntere bina...[/sher]` | Urdu Poetry Mode (misra splits + 600ms pauses) |

### Available Emotion Presets

| Preset | Speed | Gap | Best Used For |
|---|:---:|:---:|---|
| `normal` | 1.0x | 200ms | General narration |
| `dramatic` | 0.88x | 350ms | Crime recaps, thrillers |
| `sad` | 0.84x | 320ms | Emotional storytelling |
| `energetic` | 1.15x | 140ms | Sports, hype, trailers |
| `whispering` | 0.80x | 180ms | Intimate, secret scenes |
| `news` | 1.02x | 160ms | News, announcements |
| `sher` | 0.80x | 500ms | Urdu Poetry, Ghazals, Shayari |

### Example Script
```
Ek raat ne sab kuch badal diya. [pause:400]

[emotion:dramatic]Do bhai, Chicago ki khatarnaak gang wars chhod kar, apne purane shehar wapas aaye.[/emotion]

[voice:am_adam]He whispered, "We need to leave — tonight."[/voice]

[whisper]She replied, "I know a way out."[/whisper]

[speed:0.9]They ran into the darkness, hearts pounding.[/speed]
```

### NLP Auto-Emotion

When enabled (default: **ON**), ProVoice Studio automatically analyzes each sentence for emotion signals and applies appropriate speed/gap presets:

- 🔴 *"Suddenly the lights went out"* → **dramatic**
- 😢 *"She wept alone in the rain"* → **sad**
- ⚡ *"They won the championship!"* → **energetic**
- 📰 *"According to official sources"* → **news**

---

## 🔥 Studio-Grade DSP FX Pipeline

Every generated audio passes through a customizable broadcast-grade processing chain:

```
[RAW TTS] → [Micro-Variation] → [Breath Injection] → [Silence Trim] →
[Noise Gate] → [De-Esser] → [Equalizer] → [Harmonic Exciter] →
[Compressor] → [Limiter] → [LUFS Normalize] → [Peak Normalize] → [OUTPUT WAV/MP3]
```

| Processor | Default | Description |
|---|:---:|---|
| **Micro-Variation Engine** | ✅ ON | ±4% speed/gap randomized per sentence — prevents robotic uniformity |
| **Breath Injection** | ✅ ON | Synthesizes a natural inhale breath (70–110ms) at paragraph breaks |
| **Silence Trim** | ✅ ON | Removes dead air below -45 dB at start/end |
| **Noise Gate** | ⚙️ OFF | Attenuates background noise floor below threshold |
| **De-Esser** | ✅ ON | Tames harsh "sss" sibilance at 4–9kHz |
| **Harmonic Exciter** | ✅ ON | 2nd-order analog tube warmth saturation |
| **3-Band Parametric EQ** | ⚙️ OFF | Bass (200Hz), Presence (3kHz), Treble (7kHz) with ±6 dB sliders |
| **Dynamic Compressor** | ⚙️ OFF | Dynamic range smoothing with attack/release envelope |
| **Peak Limiter** | ✅ ON | Transparent limiter at -1 dB to prevent clipping |
| **LUFS Normalization** | ⚙️ OFF | EBU R128 loudness: -14 YouTube / -16 Podcast / -23 Broadcast / -12 Reels |

---

## 🏗️ Architecture

```
ProVoice Studio/
│
├── 🖥️ Frontend (React + TypeScript + Vite + Zustand)
│   ├── src/
│   │   ├── components/
│   │   │   ├── views/
│   │   │   │   ├── ScriptEditorView.tsx   # Multi-segment script editor + SSML toolbar
│   │   │   │   ├── AudioInspector.tsx     # DSP controls panel
│   │   │   │   ├── VoiceLibraryView.tsx   # 62-voice catalog with language filter
│   │   │   │   ├── TimelineView.tsx       # Multi-track audio/video timeline
│   │   │   │   ├── QueueView.tsx          # Batch generation queue
│   │   │   │   ├── HistoryView.tsx        # Generated audio history
│   │   │   │   └── SettingsView.tsx       # App preferences
│   │   │   └── ...
│   │   └── store/
│   │       └── useStudioStore.ts          # Zustand global state (62 voice catalog, DSP settings)
│   └── index.html
│
├── 🐍 Backend (FastAPI + Python + Torch)
│   ├── backend/
│   │   ├── main.py                        # FastAPI application entry point
│   │   └── api/
│   │       └── routes.py                  # 43 REST API endpoints + async job queue
│   └── engine/
│       ├── tts.py                         # Kokoro ONNX TTS + SSML integration
│       ├── dsp.py                         # Studio DSP pipeline (LUFS, De-Esser, Exciter, Breaths, EQ)
│       ├── ssml_parser.py                 # Defensive SSML parser + NLP emotion detector
│       ├── hinglish.py                    # Hinglish → Devanagari transliterator
│       ├── indic_tts.py                   # Silero PyTorch Indic offline voices
│       ├── mixer.py                       # Background music & auto-ducking mixer
│       ├── timeline.py                    # Multi-track timeline export engine
│       └── video.py                       # Video sync & narration overlay
│
├── 📁 data/
│   ├── exports/                           # Generated audio files (git-ignored)
│   ├── history/                           # Generation history log (git-ignored)
│   ├── projects/                          # Saved project JSON files (git-ignored)
│   └── temp/                             # Temporary synthesis files (git-ignored)
│
├── kokoro-v1.0.onnx                       # ⚠️ Not in repo — download separately
├── voices-v1.0.bin                        # ⚠️ Not in repo — download separately
├── start.ps1                              # PowerShell one-click launcher
├── start.bat                              # Windows CMD batch launcher
└── .gitignore
```

---

## 📖 API Reference

The FastAPI backend exposes a full REST API at `http://localhost:8000`:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/voices` | List all 62 available voices |
| `POST` | `/api/generate` | Generate speech (returns job_id) |
| `GET` | `/api/jobs/{job_id}` | Poll job status & progress |
| `GET` | `/api/audio/{filename}` | Stream or download audio/ZIP file |
| `POST` | `/api/export` | Convert single WAV to target format/quality |
| `POST` | `/api/export-batch` | Convert and package multiple segments into a ZIP archive |
| `POST` | `/api/mix` | Mix voice track with background music & auto-ducking |
| `GET` | `/api/history` | List all past generations |
| `DELETE` | `/api/history/{id}` | Delete a history entry |
| `GET` | `/api/projects` | List all saved projects |
| `POST` | `/api/projects` | Save current project |
| `GET` | `/api/emotion-presets` | List all emotion presets |
| `GET` | `/api/system/stats` | CPU, RAM, GPU stats |
| `GET` | `/api/system/logs` | Backend system log stream |

**Interactive API Docs:** `http://localhost:8000/docs` (Swagger UI)

---

## 🌐 Network Access

ProVoice Studio binds to `0.0.0.0` so it's accessible across your local Wi-Fi network:

- **Backend API:** `http://[LAN-IP]:8000`
- **Frontend:** `http://[LAN-IP]:3000`

The `start.ps1` launch script auto-detects your LAN IP and prints the network URL.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **AI Engines** | Kokoro ONNX v1.0, Silero PyTorch v4_indic, Microsoft Edge Neural TTS |
| **Transliteration** | Aksharamukha (ISO-15919, Devanagari, Urdu Nastaliq) |
| **DSP Processing** | NumPy, SciPy (custom signal processing pipeline) |
| **Backend** | FastAPI, Uvicorn, Python 3.10+ |
| **Frontend** | React 18, TypeScript, Vite, Zustand |
| **Styling** | TailwindCSS 3.4 |
| **Runtime** | ONNX Runtime (CPU multi-thread) |

---

## 📝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit your changes: `git commit -m "feat: add your feature"`
4. Push to the branch: `git push origin feat/your-feature`
5. Open a Pull Request

---

## License

ProVoice Studio is proprietary software.

The source code is publicly visible for transparency and evaluation purposes only.
You may not modify, redistribute, rebrand, or use this software commercially without prior written permission.

See the [LICENSE](https://github.com/ahmad-abdullah-chaudary/provoice-studio/tree/main?tab=License-1-ov-file) file for full terms.

---

**⭐ Star this repository if ProVoice Studio helped your audio production workflow!**

Made by [Ahmad Abdullah Chaudary](https://www.linkedin.com/in/ahmadabdullahchaudary)   |  [Github Profile](https://github.com/ahmad-abdullah-chaudary)

</div>

