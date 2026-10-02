"""Asistente de primer arranque: datos compartidos, admin, equipo y turnos."""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import secrets
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from cal_app import __version__, version_label
from cal_app.paths import (
    DEFAULT_SUGGESTED_DATA,
    INSTALACION_FILE,
    data_root,
    is_configured,
    rebind_ittool_paths,
    read_instalacion,
    write_instalacion,
)

router = APIRouter(prefix="/api/setup", tags=["Setup"])

_LOGIN_RE = re.compile(r"^[a-z0-9._-]{2,40}$", re.I)
_PBKDF2_ITERS = 180_000


def _iso_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _hash_password(password: str, salt: bytes | None = None) -> dict[str, str]:
    raw = (password or "").encode("utf-8")
    if len(raw) < 6:
        raise HTTPException(400, "La contraseña debe tener al menos 6 caracteres")
    if len(raw) > 128:
        raise HTTPException(400, "Contraseña demasiado larga")
    salt_b = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", raw, salt_b, _PBKDF2_ITERS)
    return {
        "algo": "pbkdf2_sha256",
        "iterations": str(_PBKDF2_ITERS),
        "salt": salt_b.hex(),
        "hash": digest.hex(),
    }


def verify_admin_password(password: str, root: Path | None = None) -> bool:
    base = root or data_root()
    if base is None:
        return False
    auth_path = base / "sistema" / "auth.json"
    if not auth_path.is_file():
        return False
    try:
        data = json.loads(auth_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return False
    try:
        salt = bytes.fromhex(str(data.get("salt") or ""))
        expected = bytes.fromhex(str(data.get("hash") or ""))
        iters = int(data.get("iterations") or _PBKDF2_ITERS)
    except (ValueError, TypeError):
        return False
    got = hashlib.pbkdf2_hmac(
        "sha256", (password or "").encode("utf-8"), salt, iters
    )
    return hmac.compare_digest(got, expected)


def _probe_writable(path: Path) -> None:
    try:
        path.mkdir(parents=True, exist_ok=True)
        probe = path / ".cal_write_probe"
        probe.write_text("ok", encoding="utf-8")
        probe.unlink(missing_ok=True)
    except OSError as exc:
        raise HTTPException(
            400,
            f"No se puede escribir en la ruta indicada: {path} ({exc})",
        ) from exc


def _normalize_person(raw: dict, fallback_color: str) -> dict[str, Any]:
    login = str(raw.get("login") or "").strip().lower()
    name = str(raw.get("name") or "").strip()
    if not login or not _LOGIN_RE.match(login):
        raise HTTPException(400, f"Login inválido: {login or '(vacío)'}")
    if not name:
        raise HTTPException(400, f"Falta el nombre de {login}")
    color = str(raw.get("color") or fallback_color).strip() or fallback_color
    try:
        vacation = int(raw.get("vacationDays") or 22)
    except (TypeError, ValueError) as exc:
        raise HTTPException(400, f"Días de vacaciones inválidos para {login}") from exc
    vacation = max(0, min(vacation, 60))
    out: dict[str, Any] = {
        "login": login,
        "name": name[:120],
        "color": color[:20],
        "vacationDays": vacation,
    }
    emp = str(raw.get("employeeId") or "").strip()
    if emp:
        out["employeeId"] = emp[:40]
    return out


class SetupProbe(BaseModel):
    dataRoot: str = Field(..., min_length=2, max_length=500)


class SetupPerson(BaseModel):
    login: str = Field(..., min_length=2, max_length=40)
    name: str = Field(..., min_length=1, max_length=120)
    color: str = Field("#334155", max_length=20)
    vacationDays: int = Field(22, ge=0, le=60)
    employeeId: str = Field("", max_length=40)


class SetupShiftType(BaseModel):
    id: str = Field(..., min_length=1, max_length=40)
    label: str = Field(..., min_length=1, max_length=60)
    start: str = Field(..., min_length=4, max_length=5)
    end: str = Field(..., min_length=4, max_length=5)


class SetupPersonShift(BaseModel):
    login: str = Field(..., min_length=2, max_length=40)
    mode: str = Field("fixed", pattern="^(fixed|rotating)$")
    shiftId: str = Field("manana", max_length=40)
    anchorDate: str = Field("", max_length=10)
    anchorShiftId: str = Field("", max_length=40)


class SetupDutyRotation(BaseModel):
    logins: list[str] = Field(default_factory=list)
    anchorMonday: str = Field("2026-10-05", max_length=10)


class SetupComplete(BaseModel):
    dataRoot: str = Field(..., min_length=2, max_length=500)
    centerName: str = Field(..., min_length=1, max_length=80)
    adminLogin: str = Field(..., min_length=2, max_length=40)
    adminName: str = Field(..., min_length=1, max_length=120)
    adminPassword: str = Field(..., min_length=6, max_length=128)
    people: list[SetupPerson] = Field(default_factory=list)
    shiftTypes: list[SetupShiftType] = Field(default_factory=list)
    personShifts: list[SetupPersonShift] = Field(default_factory=list)
    dutyRotation: SetupDutyRotation | None = None
    extraAdmins: list[SetupPerson] = Field(default_factory=list)


class AdminUnlock(BaseModel):
    password: str = Field(..., min_length=1, max_length=128)


@router.get("/status")
def setup_status() -> dict[str, Any]:
    configured = is_configured()
    inst = read_instalacion()
    session_user = ""
    try:
        from ittool_devhub.api.utils_api import windows_session_user

        session_user = windows_session_user() or ""
    except Exception:
        session_user = (os.environ.get("USERNAME") or "").strip()
    return {
        "ok": True,
        "configured": configured,
        "instalacionFile": str(INSTALACION_FILE),
        "dataRoot": str(inst["dataRoot"]) if inst else "",
        "centerName": str((inst or {}).get("centerName") or "").strip(),
        "suggestedDataRoot": str(DEFAULT_SUGGESTED_DATA),
        "sessionUser": session_user,
        "appName": "IT Calendario",
        "version": __version__,
        "versionLabel": version_label(),
    }


@router.post("/probe")
def setup_probe(payload: SetupProbe) -> dict[str, Any]:
    if is_configured():
        raise HTTPException(409, "La instalación ya está configurada")
    root = Path(payload.dataRoot.strip())
    _probe_writable(root)
    return {"ok": True, "dataRoot": str(root.resolve())}


@router.post("/complete")
def setup_complete(payload: SetupComplete) -> dict[str, Any]:
    if is_configured():
        raise HTTPException(409, "La instalación ya está configurada")

    root = Path(payload.dataRoot.strip())
    _probe_writable(root)

    center_name = str(payload.centerName or "").strip()
    if not center_name:
        raise HTTPException(400, "Indica el nombre del centro")
    if len(center_name) > 80:
        center_name = center_name[:80]

    palette = ["#B45309", "#1D4ED8", "#047857", "#7C3AED", "#0F766E", "#BE123C"]
    people: list[dict[str, Any]] = []
    seen: set[str] = set()
    for i, person in enumerate(payload.people):
        row = _normalize_person(person.model_dump(), palette[i % len(palette)])
        if row["login"] in seen:
            raise HTTPException(400, f"Login duplicado: {row['login']}")
        seen.add(row["login"])
        people.append(row)
    if len(people) < 1:
        raise HTTPException(400, "Añade al menos un miembro del equipo")

    admin_login = payload.adminLogin.strip().lower()
    if not _LOGIN_RE.match(admin_login):
        raise HTTPException(400, "Login de administrador inválido")
    admin_name = payload.adminName.strip()[:120] or admin_login
    if admin_login not in seen:
        people.insert(
            0,
            {
                "login": admin_login,
                "name": admin_name,
                "color": "#B45309",
                "vacationDays": 22,
            },
        )
        seen.add(admin_login)

    admins = [{"login": admin_login, "name": admin_name}]
    for extra in payload.extraAdmins:
        row = _normalize_person(extra.model_dump(), "#334155")
        if row["login"] == admin_login:
            continue
        if any(a["login"] == row["login"] for a in admins):
            continue
        admins.append({"login": row["login"], "name": row["name"]})
        if row["login"] not in seen:
            people.append(row)
            seen.add(row["login"])

    shift_types = [
        t.model_dump()
        for t in (
            payload.shiftTypes
            or [
                SetupShiftType(
                    id="manana", label="Mañana", start="06:00", end="14:00"
                ),
                SetupShiftType(
                    id="partido", label="Partido", start="09:30", end="18:30"
                ),
                SetupShiftType(
                    id="tarde", label="Tarde", start="10:00", end="17:00"
                ),
            ]
        )
    ]
    type_ids = {t["id"] for t in shift_types}
    person_shifts: dict[str, Any] = {}
    for item in payload.personShifts:
        login = item.login.strip().lower()
        if login not in seen:
            continue
        shift_id = item.shiftId if item.shiftId in type_ids else next(iter(type_ids))
        cfg: dict[str, Any] = {"mode": item.mode, "shiftId": shift_id}
        if item.mode == "rotating":
            cfg["anchorDate"] = item.anchorDate or "2026-09-01"
            cfg["anchorShiftId"] = item.anchorShiftId or shift_id
        person_shifts[login] = cfg
    for person in people:
        person_shifts.setdefault(
            person["login"], {"mode": "fixed", "shiftId": next(iter(type_ids))}
        )

    duty_logins: list[str] = []
    raw_duty = payload.dutyRotation
    raw_ids = list(raw_duty.logins) if raw_duty else []
    for item in raw_ids:
        login = str(item or "").strip().lower()
        if not login or login in duty_logins:
            continue
        if login not in seen:
            continue
        duty_logins.append(login)
    if not duty_logins:
        duty_logins = [p["login"] for p in people]
    anchor_monday = "2026-10-05"
    if raw_duty and raw_duty.anchorMonday:
        try:
            from datetime import date as _date

            from ittool_devhub.shifts import monday_of

            anchor_monday = monday_of(
                _date.fromisoformat(str(raw_duty.anchorMonday)[:10])
            ).isoformat()
        except (ValueError, TypeError, ImportError):
            anchor_monday = str(raw_duty.anchorMonday)[:10]
    duty_rotation = {"logins": duty_logins, "anchorMonday": anchor_monday}

    auth = _hash_password(payload.adminPassword)

    cal_dir = root / "calendario"
    sistema_dir = root / "sistema"
    cal_dir.mkdir(parents=True, exist_ok=True)
    (cal_dir / "backup").mkdir(parents=True, exist_ok=True)
    sistema_dir.mkdir(parents=True, exist_ok=True)
    (sistema_dir / "backup").mkdir(parents=True, exist_ok=True)

    eventos = {
        "version": 1,
        "centerName": center_name,
        "entries": [],
        "audit": [],
        "holidays": [],
        "people": people,
        "shiftTypes": shift_types,
        "shiftRotation": {"weeks": 2, "shiftIds": [t["id"] for t in shift_types[:2]]},
        "personShifts": person_shifts,
        "dutyRotation": duty_rotation,
        "reportsDir": "",
        "shiftChanges": [],
        "leaveRequests": [],
        "shiftNotices": [],
        "leaveNotices": [],
    }
    (cal_dir / "eventos.json").write_text(
        json.dumps(eventos, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (sistema_dir / "admins.json").write_text(
        json.dumps({"version": 1, "admins": admins}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (sistema_dir / "auth.json").write_text(
        json.dumps(
            {
                "version": 1,
                "createdAt": _iso_now(),
                "createdBy": admin_login,
                **auth,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    write_instalacion(
        {
            "version": 1,
            "dataRoot": str(root.resolve()),
            "centerName": center_name,
            "configuredAt": _iso_now(),
            "configuredBy": admin_login,
            "app": "it-calendario",
        }
    )
    rebind_ittool_paths(root.resolve())

    return {
        "ok": True,
        "dataRoot": str(root.resolve()),
        "centerName": center_name,
        "people": len(people),
        "admins": len(admins),
        "instalacionFile": str(INSTALACION_FILE),
    }


@router.post("/unlock")
def setup_unlock(payload: AdminUnlock) -> dict[str, Any]:
    if not is_configured():
        raise HTTPException(400, "La instalación no está configurada")
    if not verify_admin_password(payload.password):
        raise HTTPException(403, "Contraseña incorrecta")
    inst = read_instalacion() or {}
    root = data_root()
    return {
        "ok": True,
        "admin": True,
        "centerName": str(inst.get("centerName") or "").strip(),
        "dataRoot": str(root) if root else "",
    }


class AdminCenterUpdate(BaseModel):
    password: str = Field(..., min_length=1, max_length=128)
    centerName: str = Field(..., min_length=1, max_length=80)


class AdminPasswordChange(BaseModel):
    password: str = Field(..., min_length=1, max_length=128)
    newPassword: str = Field(..., min_length=6, max_length=128)


class AdminMigrate(BaseModel):
    password: str = Field(..., min_length=1, max_length=128)
    dataRoot: str = Field(..., min_length=2, max_length=500)


def _require_configured_password(password: str) -> Path:
    if not is_configured():
        raise HTTPException(400, "La instalación no está configurada")
    root = data_root()
    if root is None:
        raise HTTPException(400, "No hay ruta de datos configurada")
    if not verify_admin_password(password, root):
        raise HTTPException(403, "Contraseña incorrecta")
    return root


@router.get("/admin-config")
def setup_admin_config() -> dict[str, Any]:
    """Metadatos de instalación (sin secretos). La UI pide contraseña antes de editar."""
    if not is_configured():
        raise HTTPException(400, "La instalación no está configurada")
    inst = read_instalacion() or {}
    root = data_root()
    return {
        "ok": True,
        "centerName": str(inst.get("centerName") or "").strip(),
        "dataRoot": str(root) if root else "",
        "configuredAt": str(inst.get("configuredAt") or ""),
        "configuredBy": str(inst.get("configuredBy") or ""),
    }


@router.put("/center")
def setup_update_center(payload: AdminCenterUpdate) -> dict[str, Any]:
    root = _require_configured_password(payload.password)
    name = str(payload.centerName or "").strip()
    if not name:
        raise HTTPException(400, "Indica el nombre del centro")
    if len(name) > 80:
        name = name[:80]
    inst = read_instalacion() or {}
    inst["centerName"] = name
    inst["updatedAt"] = _iso_now()
    write_instalacion(inst)
    eventos_path = root / "calendario" / "eventos.json"
    if eventos_path.is_file():
        try:
            eventos = json.loads(eventos_path.read_text(encoding="utf-8"))
            if isinstance(eventos, dict):
                eventos["centerName"] = name
                eventos_path.write_text(
                    json.dumps(eventos, ensure_ascii=False, indent=2),
                    encoding="utf-8",
                )
        except (OSError, json.JSONDecodeError):
            pass
    return {"ok": True, "centerName": name}


@router.put("/password")
def setup_change_password(payload: AdminPasswordChange) -> dict[str, Any]:
    root = _require_configured_password(payload.password)
    auth = _hash_password(payload.newPassword)
    auth_path = root / "sistema" / "auth.json"
    try:
        prev = json.loads(auth_path.read_text(encoding="utf-8")) if auth_path.is_file() else {}
    except (OSError, json.JSONDecodeError):
        prev = {}
    data = {
        "version": 1,
        "createdAt": prev.get("createdAt") or _iso_now(),
        "createdBy": prev.get("createdBy") or "",
        "updatedAt": _iso_now(),
        **auth,
    }
    auth_path.parent.mkdir(parents=True, exist_ok=True)
    auth_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"ok": True}


@router.post("/migrate")
def setup_migrate_data(payload: AdminMigrate) -> dict[str, Any]:
    """Copia calendario/ y sistema/ a una nueva ruta y actualiza instalacion.json."""
    import shutil

    old_root = _require_configured_password(payload.password)
    new_root = Path(payload.dataRoot.strip())
    try:
        old_resolved = old_root.resolve()
        new_resolved = new_root.resolve()
    except OSError as exc:
        raise HTTPException(400, f"Ruta inválida: {exc}") from exc
    if old_resolved == new_resolved:
        return {"ok": True, "dataRoot": str(old_resolved), "moved": False}

    _probe_writable(new_resolved)
    for folder in ("calendario", "sistema"):
        src = old_resolved / folder
        dst = new_resolved / folder
        if not src.is_dir():
            raise HTTPException(400, f"Falta la carpeta origen: {src}")
        try:
            if dst.exists():
                # No pisar datos ajenos si ya hay eventos/auth
                if folder == "calendario" and (dst / "eventos.json").is_file():
                    raise HTTPException(
                        409,
                        f"Ya existe un calendario en {dst}. Elige otra carpeta vacía.",
                    )
                if folder == "sistema" and (dst / "auth.json").is_file():
                    raise HTTPException(
                        409,
                        f"Ya existe una instalación en {dst}. Elige otra carpeta vacía.",
                    )
            shutil.copytree(src, dst, dirs_exist_ok=True)
        except HTTPException:
            raise
        except OSError as exc:
            raise HTTPException(400, f"No se pudo copiar {folder}: {exc}") from exc

    (new_resolved / "calendario" / "backup").mkdir(parents=True, exist_ok=True)
    (new_resolved / "sistema" / "backup").mkdir(parents=True, exist_ok=True)

    inst = read_instalacion() or {}
    inst["dataRoot"] = str(new_resolved)
    inst["previousDataRoot"] = str(old_resolved)
    inst["migratedAt"] = _iso_now()
    write_instalacion(inst)
    rebind_ittool_paths(new_resolved)

    return {
        "ok": True,
        "moved": True,
        "dataRoot": str(new_resolved),
        "previousDataRoot": str(old_resolved),
    }

