# Wrapper que ejecuta un script reddit:* de Pregón y registra la salida en un log.
# Lo invoca el Programador de tareas de Windows (ver install-cron.ps1).
#   .\run-reddit.ps1 radar | health | schedule
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('radar', 'health', 'schedule')]
  [string]$Task
)

$ErrorActionPreference = 'Stop'

# Raíz del proyecto = carpeta padre de /scripts.
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

# Carpeta de logs (ignorada por git: scripts/.data).
$logDir = Join-Path $PSScriptRoot '.data\logs'
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Force -Path $logDir | Out-Null }
$log = Join-Path $logDir "reddit-$Task.log"

$ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
Add-Content -Path $log -Value "`n===== $ts  reddit:$Task =====" -Encoding utf8

# Resolver npm (en tareas programadas el PATH puede ser distinto al de tu shell).
$npm = (Get-Command npm.cmd -ErrorAction SilentlyContinue).Source
if (-not $npm) { $npm = (Get-Command npm -ErrorAction SilentlyContinue).Source }
if (-not $npm) { $npm = 'npm' }

# Ejecuta y vuelca TODA la salida (stdout+stderr) al log. Bajamos
# ErrorActionPreference a Continue para que el stderr del proceso nativo no
# aborte el pipeline (PowerShell lo envuelve como NativeCommandError).
$ErrorActionPreference = 'Continue'
& $npm run "reddit:$Task" 2>&1 | Out-String | Add-Content -Path $log -Encoding utf8
$code = $LASTEXITCODE
Add-Content -Path $log -Value "exit code: $code" -Encoding utf8
exit $code
