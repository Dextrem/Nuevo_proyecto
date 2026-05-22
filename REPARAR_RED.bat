@echo off
title Reparador de Red - Dextremix Finance
echo.
echo  Optimizando configuracion de red para acceso remoto...
echo.

:: Abrir puertos en el Firewall
echo  [1/2] Abriendo puertos en el Firewall...
netsh advfirewall firewall add rule name="Dextremix Finance 80" dir=in action=allow protocol=TCP localport=80 >nul 2>&1
netsh advfirewall firewall add rule name="Dextremix Finance 3000" dir=in action=allow protocol=TCP localport=3000 >nul 2>&1
netsh advfirewall firewall add rule name="Dextremix Finance 3002" dir=in action=allow protocol=TCP localport=3002 >nul 2>&1

:: Limpiar puertos
echo  [2/2] Limpiando procesos antiguos...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do ( taskkill /f /pid %%a >nul 2>&1 )
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3002" ^| findstr "LISTENING"') do ( taskkill /f /pid %%a >nul 2>&1 )

echo.
echo  DONE: Configuracion de red actualizada.
echo  Ahora puedes ejecutar INICIAR.bat normalmente.
echo.
pause
