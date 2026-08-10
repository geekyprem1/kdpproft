<#
  Combine the pending migrations (0018 -> 0021) into ONE file to paste into the
  Supabase SQL Editor, wrapped in a single transaction so a failure rolls back
  everything. Also records each migration in supabase_migrations.schema_migrations
  so the dashboard's "Last migration" and any future CLI runs stay accurate.

  Usage:
      powershell -ExecutionPolicy Bypass -File scripts/build-pending-migration.ps1

  Output: backups/PENDING-MIGRATION-0018-to-0021.sql
#>

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$migDir   = Join-Path $repoRoot "supabase/migrations"
$outDir   = Join-Path $repoRoot "backups"
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }
$outFile  = Join-Path $outDir "PENDING-MIGRATION-0018-to-0021.sql"

# name -> version stamp recorded in Supabase's migration history.
# Already-applied entries are skipped by the `on conflict do nothing` guard below,
# so this file stays safe to re-run after a partial apply.
$pending = [ordered]@{
  "0018_entitlements"                  = "20260729210001"
  "0019_job_credit_integrity"          = "20260729210002"
  "0020_account_and_storage_hardening" = "20260729210003"
  "0021_artifact_write_hardening"      = "20260729210004"
  "0022_cover_v2"                      = "20260729210005"
}

$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine("-- Pending migrations 0018 -> 0021, combined for the Supabase SQL Editor.")
[void]$sb.AppendLine("-- Generated $(Get-Date -Format 'yyyy-MM-dd HH:mm')")
[void]$sb.AppendLine("-- Runs as ONE transaction: if any statement fails, nothing is applied.")
[void]$sb.AppendLine("-- Prerequisite: migrations 0001-0017 are already applied.")
[void]$sb.AppendLine()
[void]$sb.AppendLine("begin;")
[void]$sb.AppendLine()

foreach ($name in $pending.Keys) {
  $path = Join-Path $migDir "$name.sql"
  if (-not (Test-Path $path)) { throw "Missing migration file: $path" }
  $body = (Get-Content -Raw -Path $path).TrimEnd()

  [void]$sb.AppendLine("-- ============================================================")
  [void]$sb.AppendLine("-- $name")
  [void]$sb.AppendLine("-- ============================================================")
  [void]$sb.AppendLine($body)
  [void]$sb.AppendLine()
}

# Record the migrations so Supabase's history matches what was applied.
[void]$sb.AppendLine("-- ============================================================")
[void]$sb.AppendLine("-- Record these migrations in Supabase's migration history")
[void]$sb.AppendLine("-- ============================================================")
foreach ($name in $pending.Keys) {
  $version = $pending[$name]
  [void]$sb.AppendLine("insert into supabase_migrations.schema_migrations (version, name, statements)")
  [void]$sb.AppendLine("values ('$version', '$name', array['-- applied via Supabase SQL Editor'])")
  [void]$sb.AppendLine("on conflict (version) do nothing;")
}
[void]$sb.AppendLine()
[void]$sb.AppendLine("commit;")
[void]$sb.AppendLine()

Set-Content -Path $outFile -Value $sb.ToString() -Encoding UTF8

Write-Host "Wrote: $outFile" -ForegroundColor Green
Write-Host ("Size : {0:N1} KB" -f ((Get-Item $outFile).Length / 1KB))
