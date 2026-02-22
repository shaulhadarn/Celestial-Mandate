@echo off
echo Starting Stellaris Imperium server...
start /B node server.js
echo Server started. Opening browser in 3 seconds...
timeout /t 3 /nobreak >nul
start http://localhost:3000
echo Game should now be running at http://localhost:3000
echo Press any key to stop the server and exit...
pause >nul
taskkill /f /im node.exe >nul 2>&1
echo Server stopped.
