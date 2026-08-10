<#
  Builds a paste-ready file for JUST migration 0022 (Cover V2), for the case where
  0018-0021 are already applied to production.

  Wrapped in one transaction, and records the migration in Supabase's history so the
  dashboard's "Last migration" stays accurate. Safe to re-run: the DDL is
  `if not exists` and the history insert is `on conflict do nothing`.

  Usage:
      powershell -ExecutionPolicy Bypass -File scripts/build-cover-v2-migration.ps1

  Output: backups/PENDING-MIGRATION-0022.sql
#>

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$source   = Join-Path $repoRoot "supabase/migrations/0022_cover_v2.sql"
$outDir   = Join-Path $repoRoot "backups"
$outFile  = Join-Path $outDir "PENDING-MIGRATION-0022.sql"

if (-not (Test-Path $source)) { throw "Missing $source" }
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }

$body = (Get-Content -Raw -Path $source).TrimEnd()

$sql = @"
-- Cover Generator V2 (Beta) — migration 0022, prepared for the Supabase SQL Editor.
-- Generated $(Get-Date -Format 'yyyy-MM-dd HH:mm')
-- Runs as ONE transaction: if any statement fails, nothing is applied.
-- Prerequisite: migrations 0001-0021 are already applied.
-- Safe to re-run.

begin;

$body

insert into supabase_migrations.schema_migrations (version, name, statements)
values ('20260729210005', '0022_cover_v2', array['-- applied via Supabase SQL Editor'])
on conflict (version) do nothing;

commit;
"@

# Keep the output pure ASCII. Typographic dashes survive a paste fine in practice,
# but they render as mojibake in some consoles and editors, which makes a reviewer
# doubt the file. Nothing here needs a non-ASCII character.
$sql = $sql -replace '[\u2012-\u2015\u2212]', '-' -replace '[\u2018\u2019]', "'" -replace '[\u201C\u201D]', '"'
Set-Content -Path $outFile -Value $sql -Encoding ascii

Write-Host "Wrote: $outFile" -ForegroundColor Green
Write-Host ("Size : {0:N1} KB" -f ((Get-Item $outFile).Length / 1KB))
