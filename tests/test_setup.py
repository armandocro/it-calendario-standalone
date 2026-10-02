"""Tests del asistente de instalación del Calendario standalone."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

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
            },
            {
                "login": "jorgelc",
                "name": "Jorge",
                "color": "#1D4ED8",
                "vacationDays": 22,
            },
        ],
        "shiftTypes": [],
        "personShifts": [
            {"login": "armandocro", "mode": "fixed", "shiftId": "tarde"},
            {"login": "jorgelc", "mode": "fixed", "shiftId": "manana"},
        ],
        "dutyRotation": {
            "logins": ["jorgelc", "armandocro"],
            "anchorMonday": "2026-10-05",
        },
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


def test_setup_status_not_configured(isolated_instalacion):
    from fastapi.testclient import TestClient
    from cal_app.main import create_app

    client = TestClient(create_app())
    resp = client.get("/api/setup/status")
    assert resp.status_code == 200
    body = resp.json()
    assert body["configured"] is False
    assert "suggestedDataRoot" in body
    assert "X-Request-ID" in resp.headers


def test_request_id_is_echoed_when_present(isolated_instalacion):
    from fastapi.testclient import TestClient
    from cal_app.main import create_app

    client = TestClient(create_app())
    req_id = "rid-test-123"
    resp = client.get("/api/setup/status", headers={"X-Request-ID": req_id})
    assert resp.status_code == 200
    assert resp.headers.get("X-Request-ID") == req_id


def test_api_error_shape_when_setup_required(isolated_instalacion):
    from fastapi.testclient import TestClient
    from cal_app.main import create_app

    client = TestClient(create_app())
    resp = client.get("/api/calendario/session")
    assert resp.status_code == 503
    body = resp.json()
    assert body["status"] == 503
    assert body["title"] == "Service Unavailable"
    assert body["type"] == "setup_required"
    assert body["detail"]


def test_setup_complete_creates_shared_data(isolated_instalacion):
    from fastapi.testclient import TestClient
    from cal_app.main import create_app
    from cal_app.paths import is_configured, read_instalacion

    data_root = isolated_instalacion / "shared-data"
    client = TestClient(create_app())

    probe = client.post("/api/setup/probe", json={"dataRoot": str(data_root)})
    assert probe.status_code == 200, probe.text

    payload = _valid_setup_payload(data_root)
    done = client.post("/api/setup/complete", json=payload)
    assert done.status_code == 200, done.text
    assert is_configured()

    inst = read_instalacion()
    assert inst is not None
    assert Path(inst["dataRoot"]) == data_root.resolve()
    assert inst.get("centerName") == "IT.CAB"

    status = client.get("/api/setup/status")
    assert status.status_code == 200
    assert status.json()["centerName"] == "IT.CAB"
    assert (data_root / "calendario" / "eventos.json").is_file()
    assert (data_root / "sistema" / "admins.json").is_file()
    assert (data_root / "sistema" / "auth.json").is_file()

    eventos = json.loads(
        (data_root / "calendario" / "eventos.json").read_text(encoding="utf-8")
    )
    assert len(eventos["people"]) == 2
    assert eventos["personShifts"]["jorgelc"]["shiftId"] == "manana"
    assert eventos["dutyRotation"]["logins"] == ["jorgelc", "armandocro"]
    assert eventos["dutyRotation"]["anchorMonday"] == "2026-10-05"

    unlock = client.post("/api/setup/unlock", json={"password": "secreto123"})
    assert unlock.status_code == 200
    bad = client.post("/api/setup/unlock", json={"password": "nope"})
    assert bad.status_code == 403

    cfg = client.get("/api/setup/admin-config")
    assert cfg.status_code == 200
    assert cfg.json()["centerName"] == "IT.CAB"

    renamed = client.put(
        "/api/setup/center",
        json={"password": "secreto123", "centerName": "IT.CAB Norte"},
    )
    assert renamed.status_code == 200
    assert renamed.json()["centerName"] == "IT.CAB Norte"

    session = client.get("/api/calendario/session")
    assert session.status_code == 200


def test_setup_complete_rejects_empty_center(isolated_instalacion):
    from fastapi.testclient import TestClient
    from cal_app.main import create_app

    data_root = isolated_instalacion / "shared-data"
    client = TestClient(create_app())
    payload = _valid_setup_payload(data_root)
    payload["centerName"] = ""
    resp = client.post("/api/setup/complete", json=payload)
    assert resp.status_code == 422


def test_setup_probe_conflict_when_already_configured(isolated_instalacion):
    from fastapi.testclient import TestClient
    from cal_app.main import create_app

    data_root = isolated_instalacion / "shared-data"
    client = TestClient(create_app())
    done = client.post("/api/setup/complete", json=_valid_setup_payload(data_root))
    assert done.status_code == 200

    probe = client.post("/api/setup/probe", json={"dataRoot": str(data_root)})
    assert probe.status_code == 409


def test_setup_change_password_and_unlock_new_password(isolated_instalacion):
    from fastapi.testclient import TestClient
    from cal_app.main import create_app

    data_root = isolated_instalacion / "shared-data"
    client = TestClient(create_app())
    done = client.post("/api/setup/complete", json=_valid_setup_payload(data_root))
    assert done.status_code == 200

    changed = client.put(
        "/api/setup/password",
        json={"password": "secreto123", "newPassword": "nuevo456"},
    )
    assert changed.status_code == 200

    old_unlock = client.post("/api/setup/unlock", json={"password": "secreto123"})
    assert old_unlock.status_code == 403

    new_unlock = client.post("/api/setup/unlock", json={"password": "nuevo456"})
    assert new_unlock.status_code == 200


def test_setup_migrate_conflict_if_destination_has_installation(isolated_instalacion):
    from fastapi.testclient import TestClient
    from cal_app.main import create_app

    data_root = isolated_instalacion / "shared-data"
    conflict_root = isolated_instalacion / "conflict-data"
    (conflict_root / "calendario").mkdir(parents=True, exist_ok=True)
    (conflict_root / "calendario" / "eventos.json").write_text("{}", encoding="utf-8")

    client = TestClient(create_app())
    done = client.post("/api/setup/complete", json=_valid_setup_payload(data_root))
    assert done.status_code == 200

    migrated = client.post(
        "/api/setup/migrate",
        json={"password": "secreto123", "dataRoot": str(conflict_root)},
    )
    assert migrated.status_code == 409


def test_unlock_and_admin_config_fail_when_not_configured(isolated_instalacion):
    from fastapi.testclient import TestClient
    from cal_app.main import create_app

    client = TestClient(create_app())

    unlock = client.post("/api/setup/unlock", json={"password": "x"})
    assert unlock.status_code == 400

    cfg = client.get("/api/setup/admin-config")
    assert cfg.status_code == 400


def test_setup_complete_inserts_missing_admin_and_extra_admin(isolated_instalacion):
    from fastapi.testclient import TestClient
    from cal_app.main import create_app

    data_root = isolated_instalacion / "shared-data"
    client = TestClient(create_app())
    payload = _valid_setup_payload(data_root)

    payload["adminLogin"] = "boss"
    payload["adminName"] = "The Boss"
    payload["people"] = [
        {
            "login": "jorgelc",
            "name": "Jorge",
            "color": "#1D4ED8",
            "vacationDays": 22,
        }
    ]
    payload["extraAdmins"] = [
        {
            "login": "lead2",
            "name": "Lead 2",
            "color": "#334155",
            "vacationDays": 22,
            "employeeId": "",
        }
    ]

    done = client.post("/api/setup/complete", json=payload)
    assert done.status_code == 200, done.text

    eventos = json.loads(
        (data_root / "calendario" / "eventos.json").read_text(encoding="utf-8")
    )
    logins = {p["login"] for p in eventos["people"]}
    assert "boss" in logins
    assert "lead2" in logins

    admins = json.loads((data_root / "sistema" / "admins.json").read_text(encoding="utf-8"))
    admin_logins = {a["login"] for a in admins["admins"]}
    assert "boss" in admin_logins
    assert "lead2" in admin_logins


def test_migrate_same_root_returns_not_moved(isolated_instalacion):
    from fastapi.testclient import TestClient
    from cal_app.main import create_app

    data_root = isolated_instalacion / "shared-data"
    client = TestClient(create_app())
    done = client.post("/api/setup/complete", json=_valid_setup_payload(data_root))
    assert done.status_code == 200

    migrated = client.post(
        "/api/setup/migrate",
        json={"password": "secreto123", "dataRoot": str(data_root)},
    )
    assert migrated.status_code == 200
    body = migrated.json()
    assert body["moved"] is False
