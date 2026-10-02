"""Rutas e instalación del Calendario standalone."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any


def _is_frozen() -> bool:
    return bool(getattr(sys, "frozen", False))


def _exe_dir() -> Path:
    return Path(sys.executable).resolve().parent


def _bundle_dir() -> Path:
    """Recursos empaquetados (static, etc.). En desarrollo = carpeta calendario/."""
    if _is_frozen():
        return Path(getattr(sys, "_MEIPASS", _exe_dir()))
    return Path(__file__).resolve().parent.parent


# Carpeta writable junto al .exe (o calendario/ en desarrollo)
APP_DIR = _exe_dir() if _is_frozen() else Path(__file__).resolve().parent.parent
# Raíz con código/recursos: _MEIPASS en exe, repo padre en desarrollo
REPO_ROOT = _bundle_dir() if _is_frozen() else APP_DIR.parent
INSTALACION_FILE = APP_DIR / "instalacion.json"

DEFAULT_SUGGESTED_DATA = APP_DIR / "data"


def resource_root() -> Path:
    """Raíz de ficheros estáticos empaquetados."""
    return _bundle_dir()


def cal_static_dir() -> Path:
    root = resource_root()
    for candidate in (root / "static", root / "calendario" / "static"):
        if candidate.is_dir():
            return candidate
    return root / "static"


def ittool_static_dir() -> Path:
    root = resource_root()
    for candidate in (
        root / "ittool_devhub" / "static",
        root / "ittool-static",
    ):
        if candidate.is_dir():
            return candidate
    return root / "ittool_devhub" / "static"


def read_instalacion() -> dict[str, Any] | None:
    if not INSTALACION_FILE.is_file():
        return None
    try:
        data = json.loads(INSTALACION_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    if not isinstance(data, dict):
        return None
    root = str(data.get("dataRoot") or "").strip()
    if not root:
        return None
    return data


def is_configured() -> bool:
    data = read_instalacion()
    if not data:
        return False
    root = Path(str(data["dataRoot"]))
    auth = root / "sistema" / "auth.json"
    eventos = root / "calendario" / "eventos.json"
    return auth.is_file() and eventos.is_file()


def data_root() -> Path | None:
    data = read_instalacion()
    if not data:
        return None
    return Path(str(data["dataRoot"]))


def write_instalacion(payload: dict[str, Any]) -> None:
    INSTALACION_FILE.parent.mkdir(parents=True, exist_ok=True)
    INSTALACION_FILE.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def apply_runtime_paths(root: Path | None = None) -> Path | None:
    """
    Fija variables de entorno para que ittool_devhub use el dataRoot
    del calendario standalone. Debe llamarse ANTES de importar
    ittool_devhub.config / utils_api.
    """
    target = root or data_root()
    if target is None:
        # Antes del setup: datos temporales locales (no compartidos)
        target = APP_DIR / "_local_pending"
    cal_dir = target / "calendario"
    sistema_dir = target / "sistema"
    cal_dir.mkdir(parents=True, exist_ok=True)
    (cal_dir / "backup").mkdir(parents=True, exist_ok=True)
    sistema_dir.mkdir(parents=True, exist_ok=True)
    (sistema_dir / "backup").mkdir(parents=True, exist_ok=True)

    os.environ["ITTOOL_CALENDARIO_DIR"] = str(cal_dir)
    os.environ["ITTOOL_SISTEMA_DIR"] = str(sistema_dir)
    os.environ["ITTOOL_DATA_DIR"] = str(target / "app")
    Path(os.environ["ITTOOL_DATA_DIR"]).mkdir(parents=True, exist_ok=True)
    return target


def rebind_ittool_paths(root: Path) -> None:
    """Tras completar el setup, reasigna rutas ya importadas en memoria."""
    apply_runtime_paths(root)
    try:
        import ittool_devhub.config as cfg
        from ittool_devhub.storage.json_storage import JsonStorage
        import ittool_devhub.api.utils_api as ua
    except ImportError:
        return

    cal_dir = root / "calendario"
    sistema_dir = root / "sistema"
    cfg.CALENDARIO_DIR = cal_dir
    cfg.CALENDARIO_FILE = cal_dir / "eventos.json"
    cfg.CALENDARIO_BACKUP_DIR = cal_dir / "backup"
    cfg.SISTEMA_DIR = sistema_dir
    cfg.ADMINS_FILE = sistema_dir / "admins.json"
    cfg.ADMINS_BACKUP_DIR = sistema_dir / "backup"

    ua.CALENDARIO_FILE = cfg.CALENDARIO_FILE
    ua.CALENDARIO_BACKUP_DIR = cfg.CALENDARIO_BACKUP_DIR
    ua.ADMINS_FILE = cfg.ADMINS_FILE
    ua.ADMINS_BACKUP_DIR = cfg.ADMINS_BACKUP_DIR

    ua._cal_storage = JsonStorage(
        cfg.CALENDARIO_FILE,
        default={"version": 1, "entries": [], "audit": []},
        backup_dir=cfg.CALENDARIO_BACKUP_DIR,
        backup_prefix="calendario",
        unicode_hta=True,
    )
    ua._admins_storage = JsonStorage(
        cfg.ADMINS_FILE,
        default={"version": 1, "admins": []},
        backup_dir=cfg.ADMINS_BACKUP_DIR,
        backup_prefix="admins",
        unicode_hta=True,
    )
