<#
  Production database backup (pre-migration safety net).

  Runs pg_dump inside Docker so no local PostgreSQL client install is needed.
  The database password is prompted for and passed as an environment variable to
  the container, so it is never written to disk, git, or the shell history.

  Usage (from the repository root):
      powershell -ExecutionPolicy Bypass -File scripts/db-backup.ps1

  Output: backups/kdp-prod-<timestamp>.dump  (custom format, restorable)
          backups/kdp-prod-<timestamp>.sql   (plain SQL, human-readable)

  The backups/ folder is gitignored — the dump contains real user data.
#>

$ErrorActionPreference = "Stop"

# Supabase Session pooler (IPv4-friendly, free).
$PgHost   = "aws-1-ap-south-1.pooler.supabase.com"
$PgPort   = "5432"
$PgDb     = "postgres"
$PgUser   = "postgres.vkpaspmayrvwqkxwadry"
# Match Supabase's server major version to avoid pg_dump version mismatch errors.
$PgImage  = "postgres:17-alpine"

$repoRoot  = Split-Path -Parent $PSScriptRoot
$backupDir = Join-Path $repoRoot "backups"
if (-not (Test-Path $backupDir)) { New-Item -ItemType Directory -Path $backupDir | Out-Null }

$stamp    = Get-Date -Format "yyyyMMdd-HHmmss"
$dumpName = "kdp-prod-$stamp.dump"
$sqlName  = "kdp-prod-$stamp.sql"

Write-Host "Supabase database backup" -ForegroundColor Cyan
Write-Host "  host : $PgHost"
Write-Host "  user : $PgUser"
Write-Host "  out  : backups/$dumpName"
Write-Host ""

$secure = Read-Host "Enter the Supabase database password (hidden)" -AsSecureString
$plain  = [Runtime.InteropServices.Marshal]::PtrToStringBSTR(
  [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
)
if ([string]::IsNullOrWhiteSpace($plain)) { throw "No password entered." }

try {
  Write-Host "Pulling $PgImage (first run only)..." -ForegroundColor DarkGray
  docker pull $PgImage | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "docker pull failed. Is Docker Desktop running?" }

  # 1. Custom-format dump — the file to restore from.
  Write-Host "Creating custom-format dump..." -ForegroundColor Cyan
  docker run --rm `
    -e PGPASSWORD=$plain `
    -v "${backupDir}:/backup" `
    $PgImage `
    pg_dump -h $PgHost -p $PgPort -U $PgUser -d $PgDb `
      --format=custom --no-owner --no-privileges `
      -f "/backup/$dumpName"
  if ($LASTEXITCODE -ne 0) { throw "pg_dump (custom format) failed." }

  # 2. Plain SQL dump — easy to inspect/diff.
  Write-Host "Creating plain SQL dump..." -ForegroundColor Cyan
  docker run --rm `
    -e PGPASSWORD=$plain `
    -v "${backupDir}:/backup" `
    $PgImage `
    pg_dump -h $PgHost -p $PgPort -U $PgUser -d $PgDb `
      --format=plain --no-owner --no-privileges `
      -f "/backup/$sqlName"
  if ($LASTEXITCODE -ne 0) { throw "pg_dump (plain format) failed." }
}
finally {
  # Clear the password from memory as soon as the dumps finish.
  $plain = $null
  [System.GC]::Collect()
}

Write-Host ""
Write-Host "Backup complete:" -ForegroundColor Green
Get-ChildItem $backupDir -Filter "kdp-prod-$stamp.*" |
  Select-Object Name, @{ Name = "SizeMB"; Expression = { [math]::Round($_.Length / 1MB, 2) } } |
  Format-Table -AutoSize
