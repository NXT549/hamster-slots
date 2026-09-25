@echo off
rem ------------------------------------------------------------------
rem  Hamster Slots launcher. Double-click this file to play.
rem
rem  Why not just open index.html? Browsers block a page opened from disk
rem  (file://) from reading data.json. So this starts a tiny local web
rem  server with Python and opens the game in your browser.
rem
rem  Close the "Hamster Slots server" window to stop the server.
rem ------------------------------------------------------------------

rem Run from this file's folder, wherever it was launched from.
cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
  echo Python was not found. Install Python 3 from python.org
  echo and tick "Add python.exe to PATH" during setup.
  pause
  exit /b 1
)

rem tools\serve.py = Python's simple web server, but it tells the browser not to
rem cache files, so a refresh always loads the newest version of the game.
rem Only this computer can connect, not the network.
start "Hamster Slots server - close to stop" python tools\serve.py 8765

rem Give the server a second to start, then open the game.
timeout /t 1 /nobreak >nul
start "" http://localhost:8765/
