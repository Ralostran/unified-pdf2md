@echo off
setlocal
cd /d "%~dp0"

echo unified-pdf2md GUI launcher
echo Current directory: %CD%
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js was not found in PATH. Please install Node.js 20+ and reopen this terminal.
  pause
  exit /b 1
)

set "PYTHON_CMD="
where py >nul 2>nul
if not errorlevel 1 set "PYTHON_CMD=py -3"

if "%PYTHON_CMD%"=="" (
  where python >nul 2>nul
  if not errorlevel 1 set "PYTHON_CMD=python"
)

if "%PYTHON_CMD%"=="" (
  echo ERROR: Python was not found in PATH. Please install Python 3 from python.org and enable Tcl/Tk.
  pause
  exit /b 1
)

echo Node version:
node -v
echo Python version:
%PYTHON_CMD% --version
echo.

if not exist node_modules (
  echo Installing npm dependencies...
  call npm install
  if errorlevel 1 (
    echo ERROR: npm install failed.
    pause
    exit /b 1
  )
  echo npm dependencies installed.
  echo.
)

echo Checking Python Tkinter...
%PYTHON_CMD% -c "import tkinter; print('Tkinter OK')"
if errorlevel 1 (
  echo ERROR: Tkinter is not available in this Python installation.
  echo Install Python from python.org and ensure the Tcl/Tk option is enabled.
  pause
  exit /b 1
)

echo.
echo Launching GUI...
echo If no window appears, press Alt+Tab to check whether it opened behind this terminal.
echo.

%PYTHON_CMD% apps\gui-python\unified_pdf2md_gui.py
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
  echo.
  echo ERROR: GUI exited with code %EXIT_CODE%.
  pause
  exit /b %EXIT_CODE%
)

echo.
echo GUI closed.
exit /b 0
