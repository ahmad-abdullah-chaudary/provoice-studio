import os
import time
import json
from typing import Dict, Any, List, Optional

_WEBHOOKS_FILE = os.path.join(os.path.dirname(__file__), "..", "..", "data", "webhooks.json")


def _load_webhooks() -> List[Dict]:
    os.makedirs(os.path.dirname(_WEBHOOKS_FILE), exist_ok=True)
    if os.path.exists(_WEBHOOKS_FILE):
        try:
            with open(_WEBHOOKS_FILE, "r") as f:
                return json.load(f)
        except Exception:
            return []
    return []


def _save_webhooks(hooks: List[Dict]):
    os.makedirs(os.path.dirname(_WEBHOOKS_FILE), exist_ok=True)
    with open(_WEBHOOKS_FILE, "w") as f:
        json.dump(hooks, f, indent=2)


class WebhookRegistry:
    """Local REST webhook subscriber registry for headless automation."""

    def register(self, url: str, event: str, name: str = "") -> Dict:
        hooks = _load_webhooks()
        hook_id = f"wh_{int(time.time()*1000)}"
        hook = {
            "id": hook_id,
            "url": url,
            "event": event,
            "name": name or f"hook_{hook_id}",
            "registered_at": time.time(),
            "enabled": True,
        }
        hooks.append(hook)
        _save_webhooks(hooks)
        return hook

    def unregister(self, hook_id: str) -> bool:
        hooks = _load_webhooks()
        new_hooks = [h for h in hooks if h["id"] != hook_id]
        if len(new_hooks) < len(hooks):
            _save_webhooks(new_hooks)
            return True
        return False

    def list_hooks(self, event: Optional[str] = None) -> List[Dict]:
        hooks = _load_webhooks()
        if event:
            return [h for h in hooks if h.get("event") == event or h.get("event") == "*"]
        return hooks

    def dispatch(self, event: str, payload: Dict[str, Any]):
        """Fire-and-forget dispatch to all registered subscribers for this event."""
        import urllib.request
        hooks = [h for h in _load_webhooks() if h.get("enabled") and (h.get("event") in (event, "*"))]
        body = json.dumps({"event": event, "timestamp": time.time(), "payload": payload}).encode("utf-8")
        for hook in hooks:
            try:
                req = urllib.request.Request(
                    hook["url"],
                    data=body,
                    headers={"Content-Type": "application/json", "X-ProVoice-Event": event},
                    method="POST",
                )
                urllib.request.urlopen(req, timeout=5)
            except Exception as e:
                print(f"[WebhookRegistry] Dispatch failed to {hook['url']}: {e}")


webhook_registry = WebhookRegistry()
