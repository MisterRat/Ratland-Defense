@echo off
rem Build js/levels_external.js from levels/*.json (Windows, double-clickable).
rem Requires Node.js: https://nodejs.org  (verify with: node --version)

pushd "%~dp0.."

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo ERROR: Node.js is not installed or not on your PATH.
  echo Install it from https://nodejs.org, then run this file again.
  echo.
  popd
  pause
  exit /b 1
)

node tools/build_levels.mjs %*

popd
echo.
pause