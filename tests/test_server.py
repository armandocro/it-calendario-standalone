"""Tests de arranque del servidor standalone."""

from __future__ import annotations

import sys
from pathlib import Path

CAL_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = CAL_ROOT.parent
sys.path.insert(0, str(CAL_ROOT))
sys.path.insert(0, str(REPO_ROOT))


def test_server_ready_true_on_http_error(monkeypatch):
    import urllib.error

    import cal_app.server as srv

    class _DummyResp:
        status = 200

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

    monkeypatch.setattr(srv.socket, "create_connection", lambda *a, **k: _DummyResp())

    def _raise_http_error(*args, **kwargs):
        raise urllib.error.HTTPError(args[0], 503, "err", None, None)

    monkeypatch.setattr(srv.urllib.request, "urlopen", _raise_http_error)
    assert srv._server_ready("127.0.0.1", 8574) is True


def test_server_ready_false_when_socket_fails(monkeypatch):
    import cal_app.server as srv

    def _raise(*args, **kwargs):
        raise OSError("down")

    monkeypatch.setattr(srv.socket, "create_connection", _raise)
    assert srv._server_ready("127.0.0.1", 8574) is False


def test_open_browser_when_ready_opens_once(monkeypatch):
    import cal_app.server as srv

    opened: list[str] = []

    monkeypatch.setattr(srv, "_server_ready", lambda host, port: True)
    monkeypatch.setattr(srv.webbrowser, "open", lambda url: opened.append(url))

    class _ImmediateThread:
        def __init__(self, target, daemon):
            self._target = target

        def start(self):
            self._target()

    monkeypatch.setattr(srv.threading, "Thread", _ImmediateThread)

    srv.open_browser_when_ready("127.0.0.1", 8574, timeout=0.1)
    assert opened == ["http://127.0.0.1:8574"]


def test_main_runs_string_app_when_not_frozen(monkeypatch):
    import cal_app.server as srv

    called: dict = {}

    monkeypatch.setattr(srv, "open_browser_when_ready", lambda h, p: None)
    monkeypatch.setattr(srv.sys, "frozen", False, raising=False)

    def _fake_run(app, **kwargs):
        called["app"] = app
        called["kwargs"] = kwargs

    monkeypatch.setattr(srv.uvicorn, "run", _fake_run)
    srv.main()

    assert called["app"] == "cal_app.main:app"
    assert called["kwargs"]["reload"] is False


def test_server_ready_false_when_urlopen_fails(monkeypatch):
    import urllib.error

    import cal_app.server as srv

    class _DummyResp:
        status = 200

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

    monkeypatch.setattr(srv.socket, "create_connection", lambda *a, **k: _DummyResp())

    def _raise_url_error(*args, **kwargs):
        raise urllib.error.URLError("down")

    monkeypatch.setattr(srv.urllib.request, "urlopen", _raise_url_error)
    assert srv._server_ready("127.0.0.1", 8574) is False


def test_open_browser_when_not_ready(monkeypatch):
    import cal_app.server as srv

    opened: list[str] = []
    ticks = {"n": 0}

    monkeypatch.setattr(srv, "_server_ready", lambda host, port: False)
    monkeypatch.setattr(srv.webbrowser, "open", lambda url: opened.append(url))

    def _fake_time():
        ticks["n"] += 1
        return ticks["n"] * 1.0

    monkeypatch.setattr(srv.time, "time", _fake_time)
    monkeypatch.setattr(srv.time, "sleep", lambda *_: None)

    class _ImmediateThread:
        def __init__(self, target, daemon):
            self._target = target

        def start(self):
            self._target()

    monkeypatch.setattr(srv.threading, "Thread", _ImmediateThread)

    srv.open_browser_when_ready("127.0.0.1", 8574, timeout=2.0)
    assert opened == []
