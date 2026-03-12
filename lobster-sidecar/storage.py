from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any


def get_data_dir() -> Path:
    configured = os.getenv("AGENTCORE_SIDECAR_DATA_DIR", "").strip()
    if configured:
        path = Path(configured).expanduser()
    else:
        path = Path.cwd() / ".agentcore-sidecar-data"
    path.mkdir(parents=True, exist_ok=True)
    return path


def read_json(name: str, fallback: Any) -> Any:
    path = get_data_dir() / name
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return fallback


def write_json(name: str, value: Any) -> None:
    path = get_data_dir() / name
    path.write_text(json.dumps(value, ensure_ascii=True, indent=2), encoding="utf-8")
