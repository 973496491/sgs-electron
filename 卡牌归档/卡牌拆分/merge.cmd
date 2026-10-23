@echo off
setlocal
chcp 65001 >nul
set "ATLAS_PYTHON=python"
if exist "%~dp0..\..\.venv-card-atlas\Scripts\python.exe" set "ATLAS_PYTHON=%~dp0..\..\.venv-card-atlas\Scripts\python.exe"
if exist "%~dp0..\.venv-card-atlas\Scripts\python.exe" set "ATLAS_PYTHON=%~dp0..\.venv-card-atlas\Scripts\python.exe"
"%ATLAS_PYTHON%" -X utf8 "%~dp0atlas_tool.py" merge --workspace "%~dp0."
set "ATLAS_EXIT=%ERRORLEVEL%"
echo.
if not "%ATLAS_EXIT%"=="0" echo Merge failed. Read the error above. Source files have not been overwritten.
if not defined CARD_ATLAS_NO_PAUSE pause
exit /b %ATLAS_EXIT%
