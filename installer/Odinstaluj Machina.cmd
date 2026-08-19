@echo off
setlocal
title Odinstalowanie Machina

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "$appName='Machina';" ^
  "$desktop=[Environment]::GetFolderPath('DesktopDirectory');" ^
  "$programs=[Environment]::GetFolderPath('Programs');" ^
  "$paths=@(Join-Path $desktop ($appName + '.lnk'), Join-Path (Join-Path $programs $appName) ($appName + '.lnk'));" ^
  "foreach($path in $paths){ if(Test-Path $path){ Remove-Item -LiteralPath $path -Force } }" ^
  "$startDir=Join-Path $programs $appName;" ^
  "if((Test-Path $startDir) -and -not (Get-ChildItem -LiteralPath $startDir -Force)){ Remove-Item -LiteralPath $startDir -Force }" ^
  "Write-Host ''; Write-Host 'Skroty Machina zostaly usuniete.' -ForegroundColor Green; Write-Host 'Dane zapisane w przegladarce nie zostaly usuniete.'; Write-Host ''; Start-Sleep -Seconds 2;"

if errorlevel 1 (
  echo.
  echo Odinstalowanie nie powiodlo sie.
  echo.
  pause
  exit /b 1
)

echo.
echo Gotowe. Mozesz zamknac to okno.
echo.
pause

