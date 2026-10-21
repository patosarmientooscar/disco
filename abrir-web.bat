@echo off
rem Abre disco.es en el navegador con un servidor local.
rem (Abrir index.html con doble clic no funciona: el navegador bloquea los modulos JS desde file://)
cd /d "%~dp0"
start "disco.es - servidor local (cierra esta ventana para pararlo)" cmd /k npx --yes http-server -p 5173 -c-1
timeout /t 3 /nobreak >nul
start "" http://localhost:5173/
