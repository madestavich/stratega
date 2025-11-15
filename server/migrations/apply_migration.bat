@echo off
echo ================================
echo Battle State Migration Applier
echo ================================
echo.

set /p dbhost="Enter MySQL host (default: localhost): "
if "%dbhost%"=="" set dbhost=localhost

set /p dbname="Enter database name: "
if "%dbname%"=="" (
    echo Database name is required!
    pause
    exit /b 1
)

set /p dbuser="Enter MySQL username (default: root): "
if "%dbuser%"=="" set dbuser=root

echo.
echo Applying migration to %dbname% on %dbhost%...
echo.

mysql -h %dbhost% -u %dbuser% -p %dbname% < add_battle_state.sql

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ================================
    echo Migration applied successfully!
    echo ================================
) else (
    echo.
    echo ================================
    echo Migration failed! Check errors above.
    echo ================================
)

echo.
pause
