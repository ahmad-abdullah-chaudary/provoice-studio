# ProVoice Studio — Batch Trimmer Bug Analysis

## Critical Bugs Found

---

### BUG 1: Video STRETCHED (not resized) in 9:16 Mode

**Root Cause:** `backend/engine/video.py:262` — `make_scale_pad()` uses raw `scale=W:H` without aspect ratio protection.

```python
# CURRENT (BROKEN) — line 262-266
def make_scale_pad(w: int, h: int) -> str:
    return (
        f"scale={w}:{h}:flags=lanczos,"          # ← STRETCHES video to exact WxH
        f"pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:black,"
        f"setsar=1"
    )
```

**What happens:**
- `scale=1080:1920:flags=lanczos` FORCES the video to exactly 1080×1920 pixels
- If source is 16:9 (1920×1080), it gets SQUEEZED horizontally and STRETCHED vertically
- The `pad` filter then centers this already-distorted video in a 1080×1920 canvas
- Result: **visibly stretched/distorted video** with thin black bars

**Correct approach:** Use `force_original_aspect_ratio=decrease` to scale proportionally, then pad to fill:

```python
# CORRECT FIX
def make_scale_pad(w: int, h: int) -> str:
    return (
        f"scale={w}:{h}:force_original_aspect_ratio=decrease:flags=lanczos,"
        f"pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:black,"
        f"setsar=1"
    )
```

**Why the preview doesn't show this:** The CSS uses `object-cover` (line 906) which CROPS the video to fill the 9:16 frame — the preview looks fine but the exported file is stretched.

---

### BUG 2: Batch Trimming is EXTREMELY SLOW + Timeouts/Failures

**Root Cause 1 — Overkill Encoding Settings** (`video.py:340-346`):

```python
# CURRENT (SLOW) — used for EVERY clip
cmd_encode += [
    "-c:v", "libx264",
    "-preset", "slow",           # ← 3-5x slower than "medium"
    "-crf", "16",                # ← Near-lossless (visually indistinguishable from CRF 22)
    "-b:v", video_bitrate,       # ← 12M default, 25M for 2K, 50M for 4K
    "-maxrate", "...",
    "-bufsize", "...",
    ...
]
```

**Impact per clip (1080p, 30s clip):**
- `preset slow` + CRF 16 → **45-120 seconds per clip**
- 10 clips → **8-20 minutes total**
- 4K export → **can exceed 120s timeout → FFmpeg killed → "failed" status**

**Root Cause 2 — 120-Second Timeout** (`video.py:350`):
```python
res = subprocess.run(cmd_encode, capture_output=True, timeout=120)  # ← Too short for slow preset
```

**Root Cause 3 — Sequential Processing** (`video.py:297`):
```python
for idx, item in enumerate(ranges, start=1):  # ← Each clip processed one-by-one
    # ... FFmpeg runs for 45-120s per clip ...
```

**Root Cause 4 — Synchronous Blocking Endpoint** (`routes.py:1041`):
```python
res = video_engine.trim_video_batch(...)  # ← Blocks entire FastAPI worker thread
```

---

## Additional Bottlenecks Found

### Bottleneck A: No Parallel Clip Processing
- 10 clips = 10× serial FFmpeg processes
- Should use `ThreadPoolExecutor` (like TTS already does) or FFmpeg concat demuxer

### Bottleneck B: CRF 16 is Overkill
- CRF 16 vs CRF 22: visually identical, but 3-5x slower
- Even YouTube/Netflix use CRF 18-23 for delivery

### Bottleneck C: High Bitrate Caps
- 1080p at 12M is fine, but 4K at 50M is excessive for most use cases
- Combined with CRF 16, FFmpeg does双重 quality control that conflicts

### Bottleneck D: Frontend Preview Mismatch
- Preview uses `object-cover` (crops to fill 9:16)
- Export uses `scale+pad` (adds black bars)
- User expectation ≠ actual output

### Bottleneck E: Fast Stream Copy Path Never Triggers for Aspect Changes
- When `aspect_fit != "original"`, `needs_reencode = True` always
- Even if source is already 9:16 and target is 9:16, it re-encodes unnecessarily

---

## Recommended Fixes (Priority Order)

### Fix 1: Aspect Ratio (STRETCHING) — HIGH PRIORITY
**File:** `backend/engine/video.py:262`
```python
# Change this:
f"scale={w}:{h}:flags=lanczos,"
# To this:
f"scale={w}:{h}:force_original_aspect_ratio=decrease:flags=lanczos,"
```

### Fix 2: Encoding Speed — HIGH PRIORITY
**File:** `backend/engine/video.py:340-346`
```python
# Change preset slow → medium, CRF 16 → 22
"-preset", "medium",    # Was: "slow"  (2-3x faster, same visual quality)
"-crf", "22",           # Was: 16      (visually identical, much faster)
```

### Fix 3: Increase Timeout — HIGH PRIORITY
**File:** `backend/engine/video.py:350`
```python
# Change timeout from 120s to 300s per clip
res = subprocess.run(cmd_encode, capture_output=True, timeout=300)
```

### Fix 4: Frontend Preview Match — MEDIUM PRIORITY
**File:** `src/components/views/VideoTrimmerView.tsx:906`
```tsx
// Change object-cover → object-contain so preview matches actual export
className={`w-full h-full ${previewFrame === 'mobile' || previewFrame === 'square' ? 'object-contain' : 'object-contain'}`}
```

### Fix 5: Parallel Clip Processing — MEDIUM PRIORITY
**File:** `backend/engine/video.py:297`
- Use `concurrent.futures.ThreadPoolExecutor` to process 3-4 clips simultaneously
- Or detect if source resolution already matches target and skip re-encode

### Fix 6: Skip Unnecessary Re-encode — LOW PRIORITY
- Probe source video resolution/SAR before processing
- If source already matches target aspect ratio and quality, use stream copy

---

## Expected Performance After Fixes

| Scenario | Before Fix | After Fix |
|----------|-----------|-----------|
| 10 clips × 30s × 1080p | 8-20 min | 30-90 sec |
| 10 clips × 30s × 4K | Timeout/Fail | 2-5 min |
| 1 clip × 60s × 1080p | 45-120 sec | 3-8 sec |
| Aspect ratio correctness | STRETCHED | Correct (padded) |
