"""Adapter utilities for integrating the legacy eiaserinnys Tkinter app.

This module intentionally avoids importing the legacy UI. It defines the stable JSON
boundary that the UI should read/write during the staged migration.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict

SCHEMA_VERSION = "1.0.0"


def load_review_document(path: str | Path) -> Dict[str, Any]:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    if data.get("schemaVersion") != SCHEMA_VERSION:
        raise ValueError(f"Unsupported schemaVersion: {data.get('schemaVersion')}")
    return data


def save_review_document(document: Dict[str, Any], path: str | Path) -> None:
    if document.get("schemaVersion") != SCHEMA_VERSION:
        raise ValueError(f"Unsupported schemaVersion: {document.get('schemaVersion')}")
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(document, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
