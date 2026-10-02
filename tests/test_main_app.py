"""Tests de middleware y metadatos de la app FastAPI."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

CAL_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = CAL_ROOT.parent
sys.path.insert(0, str(CAL_ROOT))
sys.path.insert(0, str(REPO_ROOT))


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


def test_health_endpoint_and_request_id_header(isolated_instalacion):
    from cal_app.main import create_app

    client = TestClient(create_app())
    resp = client.get("/api/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert body["app"] == "IT Calendario"
    assert "version" in body
    assert "versionLabel" in body
    assert "configured" in body
    assert "X-Request-ID" in resp.headers


def test_request_middleware_exception_path_logs_500(isolated_instalacion):
    from cal_app.main import create_app

    app = create_app()

    @app.get("/api/setup/_explode")
    def _explode():
        raise RuntimeError("boom")

    client = TestClient(app, raise_server_exceptions=False)
    resp = client.get("/api/setup/_explode")
    assert resp.status_code == 500
    assert "X-Request-ID" not in resp.headers


def test_mounts_ittool_static_when_available(isolated_instalacion, monkeypatch):
    from cal_app.main import create_app
    import cal_app.main as main_mod

    static_dir = isolated_instalacion / "st"
    parent_dir = isolated_instalacion / "parent-st"
    static_dir.mkdir(parents=True, exist_ok=True)
    parent_dir.mkdir(parents=True, exist_ok=True)
    (static_dir / "index.html").write_text("<html></html>", encoding="utf-8")

    monkeypatch.setattr(main_mod, "cal_static_dir", lambda: static_dir)
    monkeypatch.setattr(main_mod, "ittool_static_dir", lambda: parent_dir)

    app = create_app()
    paths = {getattr(route, "path", "") for route in app.routes}
    assert "/" in paths
