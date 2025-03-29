@echo off
echo ===== Study-Aide Installation Script =====
echo.
echo This script will clean up and reinstall dependencies.
echo.

echo Step 1: Clearing npm cache...
call npm cache clean --force
echo.

echo Step 2: Removing node_modules and package-lock.json...
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del package-lock.json
if exist .svelte-kit rmdir /s /q .svelte-kit
echo.

echo Step 3: Installing dependencies...
call npm install --no-package-lock
echo.

echo Step 4: Syncing SvelteKit...
call npm run prepare
echo.

echo All done! You can now run:
echo npm run dev
echo.
echo Press any key to exit...
pause > nul 