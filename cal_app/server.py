"""Arranque uvicorn + apertura de navegador."""

from __future__ import annotations

import socket
import sys
import threading
import time
import urllib.error
import urllib.request
import webbrowser

import uvicorn

from cal_app import DEFAULT_HOST, DEFAULT_PORT


def _server_ready(host: str, port: int) -> bool:
    try:
        with socket.create_connection((host, port), timeout=0.4):
            pass
    except OSError:
        return False
    try:
        with urllib.request.urlopen(
            f"http://{host}:{port}/api/health", timeout=1.0
        ) as resp:
            return 200 <= getattr(resp, "status", 200) < 500
    except urllib.error.HTTPError:
        # Cualquier respuesta HTTP implica que uvicorn ya está listo
        return True
    except (urllib.error.URLError, TimeoutError, OSError):
        return False


def open_browser_when_ready(host: str, port: int, timeout: float = 60.0) -> None:
    def _open() -> None:
        url = f"http://{host}:{port}"
        deadline = time.time() + timeout
        while time.time() < deadline:
            if _server_ready(host, port):
                webbrowser.open(url)
                return
            time.sleep(0.35)

    threading.Thread(target=_open, daemon=True).start()


def main() -> None:
    host = DEFAULT_HOST
    port = DEFAULT_PORT
    frozen = bool(getattr(sys, "frozen", False))
    open_browser_when_ready(host, port)
    # En .exe pasar el objeto app (el string "cal_app.main:app" falla empaquetado)
    if frozen:
        from cal_app.main import app

        uvicorn.run(
            app,
            host=host,
            port=port,
            reload=False,
            log_level="warning",
        )
    else:
        uvicorn.run(
            "cal_app.main:app",
            host=host,
            port=port,
            reload=False,
            log_level="info",
        )


if __name__ == "__main__":
    main()
