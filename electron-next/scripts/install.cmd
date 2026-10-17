@echo off
setlocal
chcp 65001 >nul
title Xiaochao Installer
echo Starting Xiaochao installer...
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" -ShowProgress %*
set "xcInstallExit=%errorlevel%"
chcp 65001 >nul
echo.
if not "%xcInstallExit%"=="0" echo Installation failed. Exit code: %xcInstallExit%. See the error above.
if not defined XC_RELEASE_NO_PAUSE pause
exit /b %xcInstallExit%
