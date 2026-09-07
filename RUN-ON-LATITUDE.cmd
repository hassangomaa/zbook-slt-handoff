@echo off
setlocal EnableExtensions
rem One file for HASSAN-GOMAA-LA only. Downloads the ISSUE pack (no PEM) and runs ISSUE.bat.
rem Do not copy vendor-private.pem off this machine.

set "WORK=%TEMP%\slt-zbook-handoff"
if exist "%WORK%" rmdir /s /q "%WORK%"
mkdir "%WORK%" || exit /b 2

echo Downloading ISSUE pack...
curl.exe -fL --retry 3 --retry-delay 2 -o "%WORK%\handoff.zip" "http://69.62.114.63:18765/handoff.zip"
if errorlevel 1 (
  echo VPS download failed. Trying GitHub...
  curl.exe -fL --retry 3 --retry-delay 2 -o "%WORK%\handoff.zip" "https://github.com/hassangomaa/zbook-slt-handoff/archive/refs/heads/master.zip"
)
if not exist "%WORK%\handoff.zip" (
  echo ERROR: could not download the ISSUE pack.
  exit /b 2
)

tar -xf "%WORK%\handoff.zip" -C "%WORK%"
if errorlevel 1 (
  echo ERROR: unzip failed.
  exit /b 2
)

for /r "%WORK%" %%F in (ISSUE.bat) do (
  echo Running %%F
  cd /d "%%~dpF"
  call "%%F"
  exit /b %ERRORLEVEL%
)

echo ERROR: ISSUE.bat not found inside the pack.
exit /b 2
