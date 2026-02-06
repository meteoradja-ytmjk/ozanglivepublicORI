@echo off
echo ========================================
echo   Git Push to GitHub
echo   https://github.com/meteoradja-ytmjk/ozanglivepublic
echo ========================================
echo.

:: Set remote URL
set REPO_URL=https://github.com/meteoradja-ytmjk/ozanglivepublicORI.git

:: Check if remote exists and update URL
git remote get-url origin >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Adding remote origin...
    git remote add origin %REPO_URL%
) else (
    echo [INFO] Updating remote origin URL...
    git remote set-url origin %REPO_URL%
)

:: Set timestamp for commit message
for /f "tokens=1-4 delims=/ " %%a in ('date /t') do set DATE=%%a-%%b-%%c
for /f "tokens=1-2 delims=: " %%a in ('time /t') do set TIME=%%a:%%b

:: Ask for commit message
set /p COMMIT_MSG="Masukkan commit message (atau tekan Enter untuk default): "

:: Use default message if empty
if "%COMMIT_MSG%"=="" set COMMIT_MSG=Update %DATE% %TIME%

echo.
echo [1/4] Fetching latest from remote...
git fetch origin

echo.
echo [2/4] Adding all changes...
git add .

echo.
echo [3/4] Committing with message: %COMMIT_MSG%
git commit -m "%COMMIT_MSG%"

echo.
echo [4/4] Pushing to GitHub...
git push -u origin main

if %errorlevel% neq 0 (
    echo.
    echo [WARNING] Push failed! Trying to pull and merge first...
    git pull origin main --no-rebase
    git push -u origin main
)

echo.
echo ========================================
echo   Push completed!
echo ========================================
pause
