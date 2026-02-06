@echo off
REM PM2 Start Script for OzangLive (Windows)
REM This script helps manage the OzangLive application with PM2

echo ========================================
echo    OzangLive PM2 Manager
echo ========================================

REM Check if PM2 is installed
where pm2 >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo PM2 is not installed!
    echo Installing PM2 globally...
    npm install -g pm2
)

if "%1"=="" goto usage
if "%1"=="start" goto start
if "%1"=="stop" goto stop
if "%1"=="restart" goto restart
if "%1"=="reload" goto reload
if "%1"=="status" goto status
if "%1"=="logs" goto logs
if "%1"=="monit" goto monit
if "%1"=="startup" goto startup
if "%1"=="delete" goto delete
goto usage

:start
echo Starting OzangLive...
pm2 start ecosystem.config.js
pm2 save
goto done

:stop
echo Stopping OzangLive...
pm2 stop ozanglive
goto done

:restart
echo Restarting OzangLive...
pm2 restart ozanglive
goto done

:reload
echo Reloading OzangLive (zero-downtime)...
pm2 reload ozanglive
goto done

:status
pm2 status
goto done

:logs
pm2 logs ozanglive --lines 100
goto done

:monit
pm2 monit
goto done

:startup
echo Setting up PM2 to start on system boot...
pm2-startup install
pm2 save
echo PM2 will now auto-start OzangLive on system boot
goto done

:delete
echo Removing OzangLive from PM2...
pm2 delete ozanglive
goto done

:usage
echo Usage: pm2-start.bat [command]
echo.
echo Commands:
echo   start   - Start OzangLive with PM2
echo   stop    - Stop OzangLive
echo   restart - Restart OzangLive
echo   reload  - Zero-downtime reload
echo   status  - Show PM2 process status
echo   logs    - View application logs
echo   monit   - Open PM2 monitoring dashboard
echo   startup - Configure PM2 to start on system boot
echo   delete  - Remove OzangLive from PM2
goto end

:done
echo Done!

:end
