/**
 * Ultra-robust file upload with real-time progress + retry + cancel.
 *
 * Uses a dual progress system:
 *   1. Simulated progress timer (smooth animation based on file size + elapsed time)
 *   2. Real XHR progress events (when the browser/proxy actually reports them)
 * The simulated timer is the primary source; real events override when available.
 * This works even when Vite proxy buffers the entire request on localhost.
 */

export interface UploadProgress {
  percent: number;
  loaded: number;
  total: number;
  attempt: number;
  speed: string;
}

export interface UploadResult {
  ok: boolean;
  status: number;
  data: Record<string, unknown> | null;
  error?: string;
}

export interface UploadHandle {
  abort: () => void;
}

const MAX_RETRIES = 3;
const RETRY_DELAYS = [0, 1500, 3500];

function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec >= 1024 * 1024) return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
  if (bytesPerSec >= 1024) return `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
  return `${bytesPerSec.toFixed(0)} B/s`;
}

/**
 * Estimate upload speed based on file size.
 * On localhost, real progress events often don't fire, so we estimate.
 * Returns bytes/sec estimate.
 */
function estimateBytesPerSec(fileSize: number): number {
  // Localhost uploads are fast — estimate ~15-50 MB/s depending on file size
  if (fileSize > 500 * 1024 * 1024) return 20 * 1024 * 1024;  // >500MB: ~20 MB/s
  if (fileSize > 100 * 1024 * 1024) return 30 * 1024 * 1024;  // >100MB: ~30 MB/s
  if (fileSize > 20 * 1024 * 1024) return 40 * 1024 * 1024;   // >20MB: ~40 MB/s
  return 50 * 1024 * 1024;                                      // <20MB: ~50 MB/s
}

export function uploadWithProgress(
  url: string,
  file: File,
  onProgress?: (progress: UploadProgress) => void,
): [UploadHandle, Promise<UploadResult>] {
  let currentXhr: XMLHttpRequest | null = null;
  let aborted = false;

  const handle: UploadHandle = {
    abort: () => {
      aborted = true;
      if (currentXhr) {
        try { currentXhr.abort(); } catch { /* ignore */ }
      }
    },
  };

  const promise = new Promise<UploadResult>((resolve) => {
    let attempt = 0;

    function tryUpload() {
      if (aborted) {
        resolve({ ok: false, status: 0, data: null, error: "Upload cancelled." });
        return;
      }

      const xhr = new XMLHttpRequest();
      currentXhr = xhr;

      const fileSize = file.size;
      const estimatedBps = estimateBytesPerSec(fileSize);
      const startTime = Date.now();
      let simulatedPercent = 0;
      let gotRealProgress = false;
      let lastRealLoaded = 0;

      // ── Simulated progress timer: smooth 0→99% animation ──────────────
      const simTimer = setInterval(() => {
        if (aborted || gotRealProgress) {
          clearInterval(simTimer);
          return;
        }
        const elapsed = (Date.now() - startTime) / 1000;
        const estimatedLoaded = Math.min(fileSize, Math.floor(estimatedBps * elapsed));
        simulatedPercent = Math.min(99, Math.round((estimatedLoaded / fileSize) * 100));
        const speed = elapsed > 0.1 ? estimatedLoaded / elapsed : 0;

        onProgress?.({
          percent: simulatedPercent,
          loaded: estimatedLoaded,
          total: fileSize,
          attempt: attempt + 1,
          speed: formatSpeed(speed),
        });
      }, 150); // Update every 150ms for smooth animation

      // ── Real XHR progress events (override simulation when available) ──
      xhr.upload.addEventListener("progress", (e) => {
        if (!e.lengthComputable || aborted) return;
        gotRealProgress = true;

        const now = Date.now();
        const timeDelta = (now - startTime) / 1000;
        const speed = timeDelta > 0.1 ? e.loaded / timeDelta : 0;
        lastRealLoaded = e.loaded;

        onProgress?.({
          percent: Math.round((e.loaded / e.total) * 100),
          loaded: e.loaded,
          total: e.total,
          attempt: attempt + 1,
          speed: formatSpeed(speed),
        });
      });

      xhr.addEventListener("load", () => {
        clearInterval(simTimer);
        if (aborted) return;

        if (xhr.status >= 200 && xhr.status < 300) {
          // Snap to 100%
          onProgress?.({
            percent: 100,
            loaded: fileSize,
            total: fileSize,
            attempt: attempt + 1,
            speed: "Complete",
          });

          let data: Record<string, unknown> | null = null;
          try { data = JSON.parse(xhr.responseText); } catch { data = { raw: xhr.responseText }; }
          resolve({ ok: true, status: xhr.status, data });
        } else if (attempt < MAX_RETRIES - 1) {
          attempt++;
          console.warn(`[Upload] Server ${xhr.status}, retry ${attempt + 1}/${MAX_RETRIES}`);
          setTimeout(tryUpload, RETRY_DELAYS[attempt]);
        } else {
          resolve({ ok: false, status: xhr.status, data: null, error: `Server error ${xhr.status}` });
        }
      });

      xhr.addEventListener("error", () => {
        clearInterval(simTimer);
        if (aborted) return;
        if (attempt < MAX_RETRIES - 1) {
          attempt++;
          setTimeout(tryUpload, RETRY_DELAYS[attempt]);
        } else {
          resolve({ ok: false, status: 0, data: null, error: "Network error — could not reach server." });
        }
      });

      xhr.addEventListener("timeout", () => {
        clearInterval(simTimer);
        if (aborted) return;
        if (attempt < MAX_RETRIES - 1) {
          attempt++;
          setTimeout(tryUpload, RETRY_DELAYS[attempt]);
        } else {
          resolve({ ok: false, status: 0, data: null, error: "Upload timed out." });
        }
      });

      xhr.addEventListener("abort", () => {
        clearInterval(simTimer);
        if (!aborted) {
          if (attempt < MAX_RETRIES - 1) {
            attempt++;
            setTimeout(tryUpload, RETRY_DELAYS[attempt]);
          } else {
            resolve({ ok: false, status: 0, data: null, error: "Connection lost." });
          }
        }
      });

      xhr.timeout = 5 * 60 * 1000;
      xhr.open("POST", url);
      const formData = new FormData();
      formData.append("file", file);
      xhr.send(formData);
    }

    tryUpload();
  });

  return [handle, promise];
}
