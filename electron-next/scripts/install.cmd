@echo off
setlocal
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" %*
set "xcInstallExit=%errorlevel%"
if not defined XC_RELEASE_NO_PAUSE pause
exit /b %xcInstallExit%
