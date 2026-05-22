@echo off
setlocal enabledelayedexpansion
title Programar Respaldo Diario - Dextremix Finance

:: Colors ANSI
set "V= [92m"  & set "A= [93m"  & set "R= [91m"
set "C= [96m"  & set "M= [95m"  & set "N= [0m"
set "B= [1m"

cls
echo.
echo %M%  ╔══════════════════════════════════════════════╗%N%
20: echo %M%  ║        PROGRAMAR RESPALDO AUTOMÁTICO         ║%N%
21: echo %M%  ╚══════════════════════════════════════════════╝%N%
22: echo.
23: echo  Esta utilidad creará una tarea programada en Windows para que 
24: echo  el sistema realice un respaldo de seguridad de todos tus datos 
25: echo  automáticamente todos los días a las 10:00 PM (22:00 hs) sin molestar.
26: echo.
27: 
28: :: Verificar privilegios de administrador
29: openfiles >nul 2>&1
30: if %errorlevel% neq 0 (
31:     echo %R%  [ERROR] Se requieren permisos de Administrador.%N%
32:     echo  Por favor, haz clic derecho sobre este archivo y selecciona
33:     echo  %B%\"Ejecutar como administrador\"%N%.
34:     echo.
35:     pause
36:     exit /b 1
37: )
38: 
39: set "ROOT_DIR=%~dp0"
40: set "BACKUP_SCRIPT=%ROOT_DIR%CREA_BACKUP.bat"
41: 
42: echo  %A% Creando tarea programada en Windows...%N%
43: 
44: :: Registrar la tarea programada usando schtasks
45: schtasks /create /tn "Dextremix_Finance_Backup" /tr "\"%BACKUP_SCRIPT%\" --silent" /sc daily /st 22:00 /f >nul 2>&1
46: 
47: if %errorlevel% equ 0 (
48:     echo.
49:     echo  %V% [ÉXITO] Tarea programada creada correctamente.%N%
50:     echo.
51:     echo  * %C%Acción:%N% Respaldar base de datos \"finandex\"
52:     echo  * %C%Frecuencia:%N% Todos los días
53:     echo  * %C%Hora:%N% 10:00 PM (22:00)
54:     echo  * %C%Ruta de los respaldos:%N% %ROOT_DIR%backups\
55:     echo.
56:     echo  %A%Nota:%N% La PC debe estar encendida a esa hora. Si está apagada,
57:     echo  la tarea se ejecutará en cuanto la enciendas.
58: ) else (
59:     echo.
60:     echo  %R% [ERROR] No se pudo crear la tarea programada.%N%
61:     echo  Verifica que el programador de tareas de Windows esté activo.
62: )
63: 
64: echo.
65: pause
66: exit /b
