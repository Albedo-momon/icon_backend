Param(
  [string]$EnvPath = ".env"
)

Write-Host "Loading environment from $EnvPath"
if (Test-Path $EnvPath) {
  Get-Content $EnvPath | ForEach-Object {
    if ($_ -match "^([A-Za-z_][A-Za-z0-9_]*)=(.*)$") {
      $name = $Matches[1]
      $value = $Matches[2]
      [System.Environment]::SetEnvironmentVariable($name, $value)
    }
  }
}

Write-Host "Running Prisma migrations..."
npm run migrate

if ($LASTEXITCODE -ne 0) {
  Write-Error "Prisma migrations failed. Ensure PostgreSQL is running and DATABASE_URL is correct."
  exit 1
}

Write-Host "Seeding database..."
npm run seed

if ($LASTEXITCODE -ne 0) {
  Write-Error "Prisma seed failed."
  exit 1
}

Write-Host "Database setup complete."