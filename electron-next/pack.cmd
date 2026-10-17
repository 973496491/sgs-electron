@echo off
setlocal
chcp 65001 >nul
set "xcProjectRoot=C:\Users\97349\Downloads\electron\electron-next"
if exist "%xcProjectRoot%\.venv-release\Scripts\python.exe" (
    "%xcProjectRoot%\.venv-release\Scripts\python.exe" "%xcProjectRoot%\scripts\package_release.py" %*
    goto :finish
)
where py.exe >nul 2>nul
if not errorlevel 1 (
    py -3 "%xcProjectRoot%\scripts\package_release.py" %*
    goto :finish
)
python "%xcProjectRoot%\scripts\package_release.py" %*
:finish
set "xcPackExit=%errorlevel%"
if not defined XC_RELEASE_NO_PAUSE pause
exit /b %xcPackExit%
