@echo off
setlocal
chcp 65001 >nul
set "xcProjectRoot=C:\Users\97349\Downloads\electron\electron-next"
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%xcProjectRoot%\scripts\package-release.ps1" %*
set "xcPackExit=%errorlevel%"
if not defined XC_RELEASE_NO_PAUSE pause
exit /b %xcPackExit%
