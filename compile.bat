@echo off
rem Build RatlandDefense.exe. Paths are relative to this file's folder,
rem so the build works wherever the project lives.
cd /d "%~dp0"
pyinstaller --noconfirm --onefile --windowed --name "RatlandDefense" --icon="%~dp0assets\RatlandDefense.ico" --add-data "*.html;." --add-data "js;js" --add-data "assets;assets" --add-data "README.MD;." --add-data "screenshots;screenshots" compile.py
pause
