@echo off
setlocal EnableExtensions
title IT Calendario - Compilar EXE
rem CMD no admite UNC como directorio actual. pushd asigna una unidad temporal.
pushd "%~dp0"
if errorlevel 1 (
    echo ERROR: no se pudo acceder a la carpeta del script.
    pause
    exit /b 1
)

set "REPO=%CD%\.."
set "PYTHONPATH=%CD%;%REPO%"
set "EXITCODE=1"

echo ============================================
echo    IT Calendario - Compilar IT-Calendario.exe
echo ============================================
echo.
echo El .exe incluira Python + dependencias + static.
echo El usuario final NO necesita instalar nada.
echo Icono: sheet_clean_white_calendar_icon_262012.ico
echo.

set "PYEXE="
set "PYARGS="
where py >nul 2>nul
if not errorlevel 1 (
    set "PYEXE=py"
    set "PYARGS=-3"
) else (
    where python >nul 2>nul
    if not errorlevel 1 set "PYEXE=python"
)

if not defined PYEXE (
    echo ERROR: Python no esta instalado o no esta en el PATH.
    echo Solo hace falta Python en el PC que COMPILA, no en el del usuario.
    pause
    popd
    exit /b 1
)

echo Usando: %PYEXE% %PYARGS%
if defined PYARGS (
    %PYEXE% %PYARGS% --version
) else (
    %PYEXE% --version
)
echo.

echo [1/3] Dependencias de la aplicacion...
if defined PYARGS (
    %PYEXE% %PYARGS% -c "import fastapi,uvicorn,openpyxl,PIL,pydantic" >nul 2>nul
) else (
    %PYEXE% -c "import fastapi,uvicorn,openpyxl,PIL,pydantic" >nul 2>nul
)
if errorlevel 1 (
    echo Instalando requirements del repo padre...
    if defined PYARGS (
        %PYEXE% %PYARGS% -m pip install -r "%REPO%\requirements.txt"
    ) else (
        %PYEXE% -m pip install -r "%REPO%\requirements.txt"
    )
    if errorlevel 1 (
        echo ERROR: no se pudieron instalar las dependencias.
        pause
        popd
        exit /b 1
    )
)

echo [2/3] PyInstaller...
if defined PYARGS (
    %PYEXE% %PYARGS% -c "import PyInstaller" >nul 2>nul
) else (
    %PYEXE% -c "import PyInstaller" >nul 2>nul
)
if errorlevel 1 (
    echo Instalando pyinstaller...
    if defined PYARGS (
        %PYEXE% %PYARGS% -m pip install pyinstaller
    ) else (
        %PYEXE% -m pip install pyinstaller
    )
    if errorlevel 1 (
        echo ERROR: no se pudo instalar PyInstaller.
        pause
        popd
        exit /b 1
    )
)

echo [3/3] Compilando onefile sin consola...
echo.
if defined PYARGS (
    %PYEXE% %PYARGS% "%CD%\build_exe.py" %*
) else (
    %PYEXE% "%CD%\build_exe.py" %*
)
set "EXITCODE=%ERRORLEVEL%"
echo.
if not "%EXITCODE%"=="0" (
    echo La compilacion termino con error codigo %EXITCODE%.
) else (
    echo ============================================
    echo  Listo: dist\IT-Calendario.exe
    echo  Copialo donde quieras; no pide dependencias.
    echo  instalacion.json se creara junto al .exe.
    echo ============================================
)
echo.
popd
pause
endlocal & exit /b %EXITCODE%
