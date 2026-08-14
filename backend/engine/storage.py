import os
import json
import time

DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data"))
PROJECTS_DIR = os.path.join(DATA_DIR, "projects")
HISTORY_DIR = os.path.join(DATA_DIR, "history")
EXPORTS_DIR = os.path.join(DATA_DIR, "exports")
TEMP_DIR = os.path.join(DATA_DIR, "temp")
SETTINGS_FILE = os.path.join(DATA_DIR, "settings.json")

class StorageManager:
    """JSON persistent storage manager for projects, history, and app settings."""

    def __init__(self):
        for path in [DATA_DIR, PROJECTS_DIR, HISTORY_DIR, EXPORTS_DIR, TEMP_DIR]:
            os.makedirs(path, exist_ok=True)
            
        self._init_settings()

    def _init_settings(self):
        if not os.path.exists(SETTINGS_FILE):
            default_settings = {
                "theme": "light",
                "language": "en-US",
                "cpu_threads": 4,
                "memory_limit_mb": 4096,
                "auto_save": True,
                "default_export_folder": EXPORTS_DIR,
                "default_voice": "af_bella",
                "default_export_format": "mp3",
                "audio_quality": "Studio",
                "sample_rate": 24000
            }
            self.save_settings(default_settings)

    def get_settings(self) -> dict:
        try:
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}

    def save_settings(self, settings: dict) -> bool:
        with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
            json.dump(settings, f, indent=2)
        return True

    # --- Project Management ---
    def list_projects(self) -> list:
        projects = []
        for filename in os.listdir(PROJECTS_DIR):
            if filename.endswith(".json"):
                path = os.path.join(PROJECTS_DIR, filename)
                try:
                    with open(path, "r", encoding="utf-8") as f:
                        projects.append(json.load(f))
                except Exception:
                    pass
        return sorted(projects, key=lambda x: x.get("updated_at", 0), reverse=True)

    def get_project(self, project_id: str) -> dict:
        path = os.path.join(PROJECTS_DIR, f"{project_id}.json")
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        return {}

    def save_project(self, project: dict) -> dict:
        if "id" not in project or not project["id"]:
            project["id"] = f"proj_{int(time.time() * 1000)}"
            project["created_at"] = time.time()
            
        project["updated_at"] = time.time()
        path = os.path.join(PROJECTS_DIR, f"{project['id']}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(project, f, indent=2)
        return project

    def delete_project(self, project_id: str) -> bool:
        path = os.path.join(PROJECTS_DIR, f"{project_id}.json")
        if os.path.exists(path):
            os.remove(path)
            return True
        return False

    # --- History Management ---
    def list_history(self) -> list:
        history = []
        for filename in os.listdir(HISTORY_DIR):
            if filename.endswith(".json"):
                path = os.path.join(HISTORY_DIR, filename)
                try:
                    with open(path, "r", encoding="utf-8") as f:
                        history.append(json.load(f))
                except Exception:
                    pass
        return sorted(history, key=lambda x: x.get("timestamp", 0), reverse=True)

    def save_history_item(self, item: dict) -> dict:
        if "id" not in item:
            item["id"] = f"hist_{int(time.time() * 1000)}"
        if "timestamp" not in item:
            item["timestamp"] = time.time()
            
        path = os.path.join(HISTORY_DIR, f"{item['id']}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(item, f, indent=2)
        return item

    def delete_history(self, history_id: str) -> bool:
        """Delete a history entry (and its generated audio file if managed by the app)."""
        path = os.path.join(HISTORY_DIR, f"{history_id}.json")
        if not os.path.exists(path):
            return False

        file_path = ""
        try:
            with open(path, "r", encoding="utf-8") as f:
                file_path = json.load(f).get("file_path", "")
        except Exception:
            pass

        os.remove(path)

        # Best-effort cleanup of the generated audio file, only within app-managed dirs
        if file_path:
            real = os.path.realpath(file_path)
            allowed = (os.path.realpath(TEMP_DIR), os.path.realpath(EXPORTS_DIR))
            if any(real == a or real.startswith(a + os.sep) for a in allowed):
                try:
                    os.remove(real)
                except Exception:
                    pass
        return True

storage_manager = StorageManager()
