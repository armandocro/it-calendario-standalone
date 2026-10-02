@echo off
setlocal EnableExtensions
title IT Calendario
rem CMD no admite UNC como directorio actual. pushd asigna una unidad temporal.
pushd "%~dp0"
if errorlevel 1 (
    echo ERROR: no se pudo acceder a la carpeta del script.
    pause
    exit /b 1
)

rem Repo padre (ittool-devhub) + esta carpeta en PYTHONPATH
set "PYTHONPATH=%CD%;%CD%\.."

echo ============================================
echo    IT Calendario - Guardias / Turnos / Vacaciones
echo ============================================
echo.

set "PY=py -3"
%PY% -c "import sys" >nul 2>nul
if errorlevel 1 (
    set "PY=python"
    where python >nul 2>nul
)
if errorlevel 1 (
    echo ERROR: Python no esta instalado o no esta en el PATH.
    pause
    exit /b 1
)

echo Usando: %PY%
%PY% --version
echo.

echo Comprobando dependencias...
%PY% -c "import fastapi,uvicorn" >nul 2>nul
if errorlevel 1 (
    echo Instalando dependencias desde el repo padre...
    %PY% -m pip install -r "%CD%\..\requirements.txt"
    if errorlevel 1 (
        echo ERROR: fallo al instalar requirements.txt
        pause
        exit /b 1
    )
)

echo.
echo Iniciando en http://127.0.0.1:8574 ...
echo   Primera vez: asistente de configuracion
echo   Siguiente: calendario compartido
echo.
%PY% -m cal_app
set "ERR=%ERRORLEVEL%"
if not "%ERR%"=="0" (
    echo.
    echo La aplicacion termino con codigo %ERR%.
    pause
)
popd
exit /b %ERR%
