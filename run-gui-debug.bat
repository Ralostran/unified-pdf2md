@echo off
setlocal
cd /d "%~dp0"

echo ===== unified-pdf2md GUI debug =====
echo CD=%CD%
echo.

echo Checking node...
where node
node -v
echo.

echo Checking npm...
where npm
npm -v
echo.

echo Checking Python launcher...
where py
py -3 --version
echo.

echo Checking python...
where python
python --version
echo.

echo Checking files...
if exist package.json (echo package.json OK) else (echo package.json MISSING)
if exist apps\cli\bin\unified-pdf2md.js (echo CLI OK) else (echo CLI MISSING)
if exist apps\gui-python\unified_pdf2md_gui.py (echo GUI OK) else (echo GUI MISSING)
echo.

echo Checking npm dependencies...
if exist node_modules (echo node_modules OK) else (echo node_modules MISSING)
echo.

echo Checking Tkinter with py -3...
py -3 -c "import tkinter; print('Tkinter OK via py -3')"
echo.

echo Launching normal GUI launcher...
call run-gui.bat

echo.
echo ===== debug complete =====
pause
