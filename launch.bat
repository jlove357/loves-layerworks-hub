@echo off
setlocal
cd /d "%~dp0"

if not exist "node_modules\electron" (
  echo Love's LayerWorks Hub has not been set up yet.
  echo Run setup.bat first, then try launch.bat again.
  pause
  exit /b 1
)

call npm.cmd start

if errorlevel 1 (
  echo.
  echo The app closed because of an error. Review the message above.
  pause
  exit /b 1
)
