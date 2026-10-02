"""Tests unitarios de ramas de validacion en setup/paths."""

from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

CAL_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = CAL_ROOT.parent
sys.path.insert(0, str(CAL_ROOT))
sys.path.insert(0, str(REPO_ROOT))


def _valid_setup_payload(data_root: Path) -> dict:
    return {
        "dataRoot": str(data_root),
        "centerName": "IT.CAB",
        "adminLogin": "armandocro",
        "adminName": "Armando",
        "adminPassword": "secreto123",
        "people": [
            {
                "login": "armandocro",
                "name": "Armando",
                "color": "#B45309",
                "vacationDays": 22,
            }
        ],
        "shiftTypes": [],
        "personShifts": [{"login": "armandocro", "mode": "fixed", "shiftId": "tarde"}],
        "dutyRotation": {"logins": ["armandocro"], "anchorMonday": "2026-10-05"},
        "extraAdmins": [],
    }


@pytest.fixture()
def isolated_instalacion(tmp_path, monkeypatch):
    import cal_app.paths as paths

    inst = tmp_path / "instalacion.json"
    monkeypatch.setattr(paths, "INSTALACION_FILE", inst)
    monkeypatch.setattr(paths, "APP_DIR", tmp_path)
    monkeypatch.setattr(paths, "DEFAULT_SUGGESTED_DATA", tmp_path / "data")
    if inst.exists():
        inst.unlink()
    yield tmp_path
    if inst.exists():
        inst.unlink()


def test_hash_password_validations():
    from cal_app.setup import _hash_password

    with pytest.raises(HTTPException):
        _hash_password("123")
    with pytest.raises(HTTPException):
        _hash_password("x" * 129)


def test_normalize_person_invalid_values():
    from cal_app.setup import _normalize_person

    with pytest.raises(HTTPException):
        _normalize_person({"login": "**", "name": "x"}, "#111")
    with pytest.raises(HTTPException):
        _normalize_person({"login": "user1", "name": ""}, "#111")
    with pytest.raises(HTTPException):
        _normalize_person({"login": "user1", "name": "Name", "vacationDays": "bad"}, "#111")


def test_verify_admin_password_false_paths(tmp_path):
    from cal_app.setup import verify_admin_password

    assert verify_admin_password("x", None) is False

    root = tmp_path / "root"
    (root / "sistema").mkdir(parents=True, exist_ok=True)
    assert verify_admin_password("x", root) is False

    auth = root / "sistema" / "auth.json"
    auth.write_text("{", encoding="utf-8")
    assert verify_admin_password("x", root) is False

    auth.write_text(json.dumps({"salt": "zz", "hash": "xx", "iterations": "bad"}), encoding="utf-8")
    assert verify_admin_password("x", root) is False


def test_setup_complete_already_configured_conflict(isolated_instalacion):
    from cal_app.main import create_app

    client = TestClient(create_app())
    root = isolated_instalacion / "shared"
    assert client.post("/api/setup/complete", json=_valid_setup_payload(root)).status_code == 200
    assert client.post("/api/setup/complete", json=_valid_setup_payload(root)).status_code == 409


def test_setup_complete_validation_branches(isolated_instalacion):
    from cal_app.main import create_app

    client = TestClient(create_app())
    root = isolated_instalacion / "shared"

    payload = _valid_setup_payload(root)
    payload["centerName"] = "   "
    assert client.post("/api/setup/complete", json=payload).status_code == 400

    payload = _valid_setup_payload(root)
    payload["people"] = []
    assert client.post("/api/setup/complete", json=payload).status_code == 400

    payload = _valid_setup_payload(root)
    payload["people"].append(payload["people"][0].copy())
    assert client.post("/api/setup/complete", json=payload).status_code == 400

    payload = _valid_setup_payload(root)
    payload["adminLogin"] = "***"
    assert client.post("/api/setup/complete", json=payload).status_code == 400


def test_setup_complete_invalid_anchor_fallback(isolated_instalacion):
    from cal_app.main import create_app

    client = TestClient(create_app())
    root = isolated_instalacion / "shared-anchor"
    payload = _valid_setup_payload(root)
    payload["dutyRotation"] = {"logins": ["armandocro"], "anchorMonday": "not-a-date"}
    done = client.post("/api/setup/complete", json=payload)
    assert done.status_code == 200
    eventos = json.loads((root / "calendario" / "eventos.json").read_text(encoding="utf-8"))
    assert eventos["dutyRotation"]["anchorMonday"] == "not-a-date"


def test_setup_update_center_validation_and_password_checks(isolated_instalacion):
    from cal_app.main import create_app

    client = TestClient(create_app())
    root = isolated_instalacion / "shared-center"
    assert client.post("/api/setup/complete", json=_valid_setup_payload(root)).status_code == 200

    bad_pwd = client.put("/api/setup/center", json={"password": "bad", "centerName": "A"})
    assert bad_pwd.status_code == 403

    empty_name = client.put("/api/setup/center", json={"password": "secreto123", "centerName": "   "})
    assert empty_name.status_code == 400


def test_setup_password_fails_if_auth_file_corrupt(isolated_instalacion):
    from cal_app.main import create_app

    client = TestClient(create_app())
    root = isolated_instalacion / "shared-auth"
    assert client.post("/api/setup/complete", json=_valid_setup_payload(root)).status_code == 200

    auth_path = root / "sistema" / "auth.json"
    auth_path.write_text("{", encoding="utf-8")

    changed = client.put(
        "/api/setup/password",
        json={"password": "secreto123", "newPassword": "nuevo789"},
    )
    assert changed.status_code == 403


def test_setup_migrate_missing_source_and_conflicts(isolated_instalacion):
    from cal_app.main import create_app

    client = TestClient(create_app())
    root = isolated_instalacion / "shared-migrate"
    assert client.post("/api/setup/complete", json=_valid_setup_payload(root)).status_code == 200

    # Falta carpeta origen calendario
    shutil.rmtree(root / "calendario")
    missing_src = client.post(
        "/api/setup/migrate",
        json={"password": "secreto123", "dataRoot": str(isolated_instalacion / "dest-a")},
    )
    assert missing_src.status_code == 400


def test_setup_migrate_conflict_on_existing_auth(isolated_instalacion):
    from cal_app.main import create_app

    client = TestClient(create_app())
    root = isolated_instalacion / "shared-migrate-2"
    assert client.post("/api/setup/complete", json=_valid_setup_payload(root)).status_code == 200

    conflict = isolated_instalacion / "dest-b"
    (conflict / "sistema").mkdir(parents=True, exist_ok=True)
    (conflict / "sistema" / "auth.json").write_text("{}", encoding="utf-8")
    (conflict / "calendario").mkdir(parents=True, exist_ok=True)
    res = client.post(
        "/api/setup/migrate",
        json={"password": "secreto123", "dataRoot": str(conflict)},
    )
    assert res.status_code == 409
