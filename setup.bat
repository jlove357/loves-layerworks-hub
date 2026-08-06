@echo off
setlocal
cd /d "%~dp0"

echo ========================================
echo  Love's LayerWorks Hub - Setup
echo ========================================
echo.
echo Installing the desktop app dependencies...
call npm.cmd install

if errorlevel 1 (
  echo.
  echo Setup failed. Review the error above.
  pause
  exit /b 1
)

echo.
echo Setup complete.
echo You can now run launch.bat.
pause
