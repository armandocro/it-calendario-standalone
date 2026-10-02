"""
Build script PyInstaller — IT-Calendario.exe (standalone, sin consola).

Usage:
    python build_exe.py
    python build_exe.py --console
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

CAL_DIR = Path(__file__).resolve().parent
REPO_ROOT = CAL_DIR.parent
ICON_NAME = "sheet_clean_white_calendar_icon_262012.ico"
EXE_NAME = "IT-Calendario"


def add_data(src: Path, dest: str) -> str:
    return f"{src}{os.pathsep}{dest}"


def main() -> None:
    try:
        import PyInstaller.__main__
    except ImportError as exc:
        raise SystemExit(
            "PyInstaller no esta instalado. Ejecuta: pip install pyinstaller"
        ) from exc

    static_dir = CAL_DIR / "static"
    ittool_static = REPO_ROOT / "ittool_devhub" / "static"
    icon = CAL_DIR / ICON_NAME
    entry = CAL_DIR / "cal_app" / "__main__.py"

    if not static_dir.is_dir():
        raise SystemExit(f"No se encontro static: {static_dir}")
    if not ittool_static.is_dir():
        raise SystemExit(f"No se encontro ittool static: {ittool_static}")
    if not entry.is_file():
        raise SystemExit(f"No se encontro entrypoint: {entry}")
    if not icon.is_file():
        raise SystemExit(f"No se encontro icono: {icon}")

    print(f"Icono: {icon}")
    print(f"Static calendario: {static_dir}")
    print(f"Static ittool: {ittool_static}")

    dist = CAL_DIR / "dist"
    work = CAL_DIR / "build" / "pyinstaller"
    spec = CAL_DIR / "build"

    args = [
        str(entry),
        f"--name={EXE_NAME}",
        "--onefile",
        "--noconfirm",
        "--clean",
        "--icon",
        str(icon),
        "--paths",
        str(CAL_DIR),
        "--paths",
        str(REPO_ROOT),
        "--add-data",
        add_data(static_dir, "static"),
        "--add-data",
        add_data(ittool_static, "ittool_devhub/static"),
        "--hidden-import=cal_app",
        "--hidden-import=cal_app.main",
        "--hidden-import=cal_app.server",
        "--hidden-import=cal_app.setup",
        "--hidden-import=cal_app.paths",
        "--hidden-import=uvicorn.logging",
        "--hidden-import=uvicorn.loops",
        "--hidden-import=uvicorn.loops.auto",
        "--hidden-import=uvicorn.protocols",
        "--hidden-import=uvicorn.protocols.http.auto",
        "--hidden-import=uvicorn.protocols.http.h11_impl",
        "--hidden-import=uvicorn.protocols.websockets.auto",
        "--hidden-import=uvicorn.lifespan",
        "--hidden-import=uvicorn.lifespan.on",
        "--hidden-import=ittool_devhub.api.utils_api",
        "--hidden-import=ittool_devhub.api.session",
        "--hidden-import=ittool_devhub.reports",
        "--hidden-import=ittool_devhub.shifts",
        "--hidden-import=ittool_devhub.duties",
        "--hidden-import=openpyxl",
        "--hidden-import=PIL",
        "--hidden-import=PIL.Image",
        "--hidden-import=PIL.ImageDraw",
        "--hidden-import=PIL.ImageFont",
        "--hidden-import=multipart",
        "--hidden-import=email.mime.text",
        "--collect-submodules=cal_app",
        "--collect-submodules=ittool_devhub",
        "--collect-all=uvicorn",
        "--collect-all=starlette",
        "--collect-all=anyio",
        "--collect-all=openpyxl",
        "--collect-all=PIL",
        "--collect-all=pydantic",
        f"--distpath={dist}",
        f"--workpath={work}",
        f"--specpath={spec}",
    ]

    if "--console" in sys.argv:
        args.append("--console")
        print("Modo: consola (depuracion)")
    else:
        args.append("--windowed")
        print("Modo: sin consola (usuario final)")

    os.chdir(CAL_DIR)
    PyInstaller.__main__.run(args)
    print(f"\nListo: {dist / (EXE_NAME + '.exe')}")


if __name__ == "__main__":
    main()
