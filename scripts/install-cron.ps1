# Registra (o reemplaza) las tareas programadas de Reddit de Pregón en el
# Programador de tareas de Windows. NO requiere admin (tareas del usuario actual).
# Corren SOLO cuando tu sesión está iniciada (LogonType Interactive) — no se
# guarda ninguna contraseña de Windows.
#
#   Instalar:   powershell -ExecutionPolicy Bypass -File scripts\install-cron.ps1
#   Desinstalar: powershell -ExecutionPolicy Bypass -File scripts\install-cron.ps1 -Uninstall
param([switch]$Uninstall)

$ErrorActionPreference = 'Stop'
$wrapper = Join-Path $PSScriptRoot 'run-reddit.ps1'
$prefix = 'Pregon Reddit'

$tasks = @(
  @{ Name = "$prefix Radar";     Arg = 'radar';    Triggers = @('09:00', '18:00'); Desc = 'Radar de oportunidades de Reddit (2x/día).' },
  @{ Name = "$prefix Health";    Arg = 'health';   Triggers = @('09:30');          Desc = 'Monitor de salud de cuenta de Reddit (1x/día).' },
  @{ Name = "$prefix Scheduler"; Arg = 'schedule'; Triggers = @('hourly');         Desc = 'Dispara posts programados de Reddit (cada hora, con separación mínima).' }
)

# Borrar tareas previas (idempotente).
foreach ($t in $tasks) {
  if (Get-ScheduledTask -TaskName $t.Name -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $t.Name -Confirm:$false
    Write-Host "- Eliminada tarea previa: $($t.Name)"
  }
}
if ($Uninstall) { Write-Host "Tareas desinstaladas."; return }

$principal = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 15)

foreach ($t in $tasks) {
  $action = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$wrapper`" $($t.Arg)"

  $triggers = @()
  foreach ($tr in $t.Triggers) {
    if ($tr -eq 'hourly') {
      $trig = New-ScheduledTaskTrigger -Once -At (Get-Date).Date.AddHours(9) `
        -RepetitionInterval (New-TimeSpan -Hours 1) -RepetitionDuration (New-TimeSpan -Days 3650)
      $triggers += $trig
    }
    else {
      $triggers += New-ScheduledTaskTrigger -Daily -At $tr
    }
  }

  Register-ScheduledTask -TaskName $t.Name -Action $action -Trigger $triggers `
    -Principal $principal -Settings $settings -Description $t.Desc | Out-Null
  Write-Host "+ Registrada: $($t.Name)  [$($t.Triggers -join ', ')]"
}

Write-Host "`nHecho. Revisa con:  Get-ScheduledTask -TaskName 'Pregon Reddit*'"
Write-Host "Logs en: scripts\.data\logs\"
