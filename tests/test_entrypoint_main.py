"""Cobertura de cal_app.__main__ (entrypoint standalone)."""

from __future__ import annotations

import importlib
import sys
from pathlib import Path

CAL_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = CAL_ROOT.parent
sys.path.insert(0, str(CAL_ROOT))
sys.path.insert(0, str(REPO_ROOT))


def test_entrypoint_non_frozen_sets_env_and_paths(monkeypatch):
    monkeypatch.delenv("PYTHONUTF8", raising=False)
    monkeypatch.setattr(sys, "frozen", False, raising=False)

    if str(CAL_ROOT) in sys.path:
        sys.path.remove(str(CAL_ROOT))
    if str(REPO_ROOT) in sys.path:
        sys.path.remove(str(REPO_ROOT))

    sys.modules.pop("cal_app.__main__", None)
    importlib.import_module("cal_app.__main__")

    assert str(CAL_ROOT) in sys.path
    assert str(REPO_ROOT) in sys.path
    assert sys.modules.get("cal_app.__main__") is not None


def test_entrypoint_frozen_initializes_null_streams(monkeypatch):
    monkeypatch.setattr(sys, "frozen", True, raising=False)
    monkeypatch.setattr(sys, "stdout", None, raising=False)
    monkeypatch.setattr(sys, "stderr", None, raising=False)

    sys.modules.pop("cal_app.__main__", None)
    importlib.import_module("cal_app.__main__")

    assert sys.stdout is not None
    assert sys.stderr is not None
