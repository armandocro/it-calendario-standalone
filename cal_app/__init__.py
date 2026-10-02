"""Calendario standalone — guardias, turnos y vacaciones."""

__version__ = "1.0"
# Mes/año de esta versión (lanzamiento)
VERSION_MONTH = 10
VERSION_YEAR = 2026
APP_NAME = "IT Calendario"
DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8574

_MONTHS_ES = (
    "",
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
)


def version_label() -> str:
    """Etiqueta visible: 1.0 · Octubre 2026."""
    month_name = _MONTHS_ES[VERSION_MONTH] if 1 <= VERSION_MONTH <= 12 else str(VERSION_MONTH)
    return f"{__version__} · {month_name} {VERSION_YEAR}"
