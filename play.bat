@echo off
rem ------------------------------------------------------------------
rem  Hamster Slots launcher. Double-click this file to play.
rem
rem  Why not just open index.html? Browsers won't run the game's code
rem  from a file on disk. So this starts Vite (a small local web server
rem  for developing the game) with Node.js and opens the game in your
rem  browser at http://localhost:8765/ - the same address as always,
rem  so your save is still there.
rem
rem  Close the "Hamster Slots server" window to stop the server.
rem ------------------------------------------------------------------

rem Run from this file's folder, wherever it was launched from.
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install the LTS version from nodejs.org,
  echo then double-click play.bat again.
  pause
  exit /b 1
)

rem Make sure the game's tools (Vite and friends) are installed in node_modules.
rem The first time this downloads them; after that it takes a second or two.
rem "call" because npm is itself a script: without it, this file would stop here.
echo Checking the game's tools...
call npm install --no-audit --no-fund --loglevel=error
if errorlevel 1 (
  if not exist node_modules\vite (
    echo Could not install the game's tools. See the messages above.
    pause
    exit /b 1
  )
  echo Could not check the game's tools for updates, starting anyway.
)

rem "npm run dev" starts Vite; --open opens the game in your browser when it's ready.
rem Only this computer can connect, not the network.
start "Hamster Slots server - close to stop" cmd /k npm run dev -- --open
