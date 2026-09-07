@echo off
setlocal EnableExtensions
cd /d "%~dp0"

rem Latitude one-click: issue a bound high-credit license for the ZBook POC.
rem Do NOT copy vendor-private.pem off this machine. Do NOT pass --unbound.

set "KEY=C:\Users\Hassan Gomaa\Documents\slt-ocr-signing-key\vendor-private.pem"
set "PUB=MCowBQYDK2VwAyEAoCWTBL60tRSO/QK+meME3vVxKU7q7y5QMovUYjfj6yQ="
set "OUT=%~dp0slt-ocr.license"
set "SIG=%~dp0signals.json"
set "DROP=http://69.62.114.63:18765"

if not exist "%SIG%" (
  echo ERROR: signals.json missing next to this script.
  exit /b 2
)
if not exist "%KEY%" (
  echo ERROR: root-2026b PEM not at:
  echo   %KEY%
  exit /b 2
)

set "ISSUER=%~dp0issuer\cli\slt-license.mjs"
if not exist "%ISSUER%" (
  set "ISSUER="
  for %%P in (
    "D:\Projects\slt-ocr-app\products\issuer\cli\slt-license.mjs"
    "D:\slt-ocr-app\products\issuer\cli\slt-license.mjs"
    "E:\Projects\slt-ocr-app\products\issuer\cli\slt-license.mjs"
    "C:\Users\Hassan Gomaa\Projects\slt-ocr-app\products\issuer\cli\slt-license.mjs"
    "C:\Users\Hassan Gomaa\Documents\slt-ocr-app\products\issuer\cli\slt-license.mjs"
    "C:\Users\Hassan Gomaa\Desktop\slt-ocr-app\products\issuer\cli\slt-license.mjs"
    "%USERPROFILE%\Projects\slt-ocr-app\products\issuer\cli\slt-license.mjs"
  ) do if exist %%~P set "ISSUER=%%~P"
)

if not defined ISSUER (
  echo ERROR: bundled issuer missing and slt-license.mjs not found on this PC.
  exit /b 2
)

set "NODEEXE="
if exist "%~dp0tools\node.exe" set "NODEEXE=%~dp0tools\node.exe"
if not defined NODEEXE (
  where node >nul 2>&1
  if not errorlevel 1 set "NODEEXE=node"
)
if not defined NODEEXE (
  mkdir "%~dp0tools" 2>nul
  echo Node not on PATH. Downloading portable node.exe ...
  curl.exe -fL --retry 3 --retry-delay 2 -o "%~dp0tools\node.exe" "%DROP%/tools/node.exe"
  if exist "%~dp0tools\node.exe" set "NODEEXE=%~dp0tools\node.exe"
)
if not defined NODEEXE (
  echo VPS node download failed. Trying nodejs.org ...
  curl.exe -fL --retry 3 -o "%TEMP%\slt-node-win.zip" https://nodejs.org/dist/v22.12.0/node-v22.12.0-win-x64.zip
  if exist "%TEMP%\slt-node-win.zip" (
    mkdir "%TEMP%\slt-node-win" 2>nul
    tar -xf "%TEMP%\slt-node-win.zip" -C "%TEMP%\slt-node-win"
    for /r "%TEMP%\slt-node-win" %%F in (node.exe) do copy /y "%%F" "%~dp0tools\node.exe" >nul
  )
  if exist "%~dp0tools\node.exe" set "NODEEXE=%~dp0tools\node.exe"
)
if not defined NODEEXE (
  echo ERROR: node.exe is not on PATH and auto-download failed.
  exit /b 2
)

echo Issuing bound license with %ISSUER%
"%NODEEXE%" "%ISSUER%" issue ^
  --key "%KEY%" ^
  --licensee "HP-ZBook-Hassan-POC" ^
  --months 12 ^
  --signals-file "%SIG%" ^
  --modules extraction_nid,classification,batch,records ^
  --credits extraction_nid=50000 ^
  --credits classification=50000 ^
  --out "%OUT%"
if errorlevel 1 exit /b 2

echo Verifying against capsule root-2026b pubkey
"%NODEEXE%" "%ISSUER%" verify "%OUT%" --pubkey %PUB%
if errorlevel 1 (
  echo ERROR: verify failed — do not copy this file to the ZBook.
  exit /b 2
)

echo.
echo OK wrote %OUT%
echo Uploading to ZBook drop (token-gated, license file only)...
curl.exe -sS -o NUL -w "upload HTTP %%{http_code}\n" -X PUT --data-binary "@%OUT%" -H "X-Drop-Token: cR3OHG6qsbvdIpQCyZ8i0Qx0YQhHvGCVv2uKLFRrmKM" %DROP%/slt-ocr.license
echo If upload failed, copy ONLY that file to the ZBook:
echo   C:\Users\Eng.HassanGomaa\Projects\slt-ocr-client\license\slt-ocr.license
echo Desktop / Downloads / Telegram Desktop / USB root are also watched.
echo Or reply to the SLT handoff email with ONLY slt-ocr.license attached.
exit /b 0
