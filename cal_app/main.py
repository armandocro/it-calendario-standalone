"""FastAPI app del Calendario standalone."""

from __future__ import annotations

import json
import logging
import sys
import time
import uuid
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from cal_app import APP_NAME, DEFAULT_HOST, DEFAULT_PORT, __version__, version_label
from cal_app.paths import (
    REPO_ROOT,
    apply_runtime_paths,
    cal_static_dir,
    is_configured,
    ittool_static_dir,
)
from cal_app.setup import router as setup_router

logger = logging.getLogger(__name__)

# Rutas de datos ANTES de importar ittool_devhub.config
apply_runtime_paths()

# Repo padre en sys.path para reutilizar backend (en .exe ya viene empaquetado)
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))


def create_app() -> FastAPI:
    from ittool_devhub.api.session import router as session_router
    from ittool_devhub.api.utils_api import admins_router, calendario_router
    from ittool_devhub.config import ensure_data_files

    ensure_data_files()

    app = FastAPI(title=APP_NAME, version=__version__)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[f"http://{DEFAULT_HOST}:{DEFAULT_PORT}", "http://127.0.0.1:8574"],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "X-Request-ID", "Authorization"],
    )

    @app.middleware("http")
    async def attach_request_context(request: Request, call_next):
        request_id = (request.headers.get("X-Request-ID") or "").strip() or uuid.uuid4().hex
        request.state.request_id = request_id
        started = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            elapsed_ms = int((time.perf_counter() - started) * 1000)
            logger.exception(
                json.dumps(
                    {
                        "event": "http_error",
                        "request_id": request_id,
                        "method": request.method,
                        "path": request.url.path,
                        "elapsed_ms": elapsed_ms,
                    }
                )
            )
            raise
        elapsed_ms = int((time.perf_counter() - started) * 1000)
        response.headers["X-Request-ID"] = request_id
        logger.info(
            json.dumps(
                {
                    "event": "http_request",
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "status": response.status_code,
                    "elapsed_ms": elapsed_ms,
                }
            )
        )
        return response

    @app.middleware("http")
    async def require_setup(request: Request, call_next):
        path = request.url.path or ""
        # Salud y setup deben responder siempre (arranque / asistente)
        if path.startswith("/api/") and not (
            path.startswith("/api/setup") or path == "/api/health"
        ):
            if not is_configured():
                return JSONResponse(
                    status_code=503,
                    content={
                        "status": 503,
                        "title": "Service Unavailable",
                        "type": "setup_required",
                        "detail": "Pendiente de configuración inicial",
                        "code": "setup_required",
                    },
                )
        return await call_next(request)

    app.include_router(setup_router)
    app.include_router(calendario_router)
    app.include_router(admins_router)
    app.include_router(session_router)

    static_dir = cal_static_dir()
    parent_static = ittool_static_dir()
    if not static_dir.is_dir():
        raise RuntimeError(f"No se encuentra static del calendario: {static_dir}")
    app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")
    if parent_static.is_dir():
        app.mount(
            "/ittool-static",
            StaticFiles(directory=str(parent_static)),
            name="ittool-static",
        )

    @app.get("/")
    def index() -> FileResponse:
        return FileResponse(static_dir / "index.html")

    @app.get("/api/health")
    def health() -> dict:
        return {
            "ok": True,
            "app": APP_NAME,
            "version": __version__,
            "versionLabel": version_label(),
            "configured": is_configured(),
        }

    return app


app = create_app()
