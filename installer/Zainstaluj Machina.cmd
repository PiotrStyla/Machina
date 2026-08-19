@echo off
setlocal
title Instalacja Machina

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "$appName='Machina';" ^
  "$appUrl='https://piotrstyla.github.io/Machina/?installed=' + [DateTimeOffset]::UtcNow.ToUnixTimeSeconds();" ^
  "$edge=@(\"$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe\",\"${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe\") | Where-Object { Test-Path $_ } | Select-Object -First 1;" ^
  "$chrome=@(\"$env:ProgramFiles\Google\Chrome\Application\chrome.exe\",\"${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe\") | Where-Object { Test-Path $_ } | Select-Object -First 1;" ^
  "$browser=if($edge){$edge}else{$chrome};" ^
  "if(-not $browser){ throw 'Nie znaleziono Microsoft Edge ani Google Chrome. Zainstaluj jedna z tych przegladarek i uruchom instalator ponownie.' }" ^
  "$profileDir=Join-Path -Path $env:LOCALAPPDATA -ChildPath 'Machina\AppProfile';" ^
  "New-Item -ItemType Directory -Force -Path $profileDir | Out-Null;" ^
  "$desktop=[Environment]::GetFolderPath('DesktopDirectory');" ^
  "$programs=[Environment]::GetFolderPath('Programs');" ^
  "$startDir=Join-Path $programs $appName;" ^
  "New-Item -ItemType Directory -Force -Path $startDir | Out-Null;" ^
  "$targets=@((Join-Path -Path $desktop -ChildPath ($appName + '.lnk')), (Join-Path -Path $startDir -ChildPath ($appName + '.lnk')));" ^
  "$shell=New-Object -ComObject WScript.Shell;" ^
  "foreach($target in $targets){ $shortcut=$shell.CreateShortcut($target); $shortcut.TargetPath=$browser; $shortcut.Arguments='--user-data-dir=\"' + $profileDir + '\" --app=\"' + $appUrl + '\"'; $shortcut.WorkingDirectory=Split-Path $browser; $shortcut.IconLocation=$browser + ',0'; $shortcut.Description='Machina - zlecenia i czas pracy'; $shortcut.Save() }" ^
  "Write-Host ''; Write-Host 'Machina zostala zainstalowana.' -ForegroundColor Green; Write-Host 'Skrót jest na pulpicie i w menu Start.'; Write-Host ''; Start-Sleep -Seconds 2;"

if errorlevel 1 (
  echo.
  echo Instalacja nie powiodla sie.
  echo.
  pause
  exit /b 1
)

echo.
echo Gotowe. Mozesz zamknac to okno.
echo.
pause
