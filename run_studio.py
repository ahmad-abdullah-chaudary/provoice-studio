import subprocess
import sys
import time
import webbrowser
import os

def main():
    print("==========================================================")
    print("      Launching ProVoice Studio Production Suite...      ")
    print("==========================================================")
    
    cwd = os.path.dirname(os.path.abspath(__file__))

    # 1. Launch FastAPI Backend Engine
    print("[1/2] Starting Python Kokoro TTS Backend on port 8000...")
    backend_proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "backend.main:app", "--host", "127.0.0.1", "--port", "8000"],
        cwd=cwd
    )

    time.sleep(2.5)

    # 2. Launch Vite Frontend UI Server
    print("[2/2] Starting Desktop UI Server on port 3000...")
    frontend_cmd = "npx.cmd" if sys.platform == "win32" else "npx"
    frontend_proc = subprocess.Popen(
        [frontend_cmd, "vite", "--port", "3000"],
        cwd=cwd
    )

    time.sleep(2)
    url = "http://localhost:3000"
    print(f"\n[SUCCESS] ProVoice Studio is live at {url}")
    print("Press Ctrl+C to stop servers.\n")
    
    try:
        webbrowser.open(url)
        backend_proc.wait()
        frontend_proc.wait()
    except KeyboardInterrupt:
        print("\nStopping servers...")
        backend_proc.terminate()
        frontend_proc.terminate()

if __name__ == "__main__":
    main()
