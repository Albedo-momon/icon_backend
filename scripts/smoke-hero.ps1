param(
  [string]$BaseUrl = 'http://localhost:8080'
)

Write-Host "Starting hero banners smoke test against $BaseUrl"

$loginPayloadPath = Join-Path $PSScriptRoot 'login_payload.json'
if (!(Test-Path $loginPayloadPath)) { throw "Missing $loginPayloadPath" }

$loginPayload = Get-Content -Raw -Path $loginPayloadPath | ConvertFrom-Json
$token = (Invoke-RestMethod -Method Post -Uri "$BaseUrl/auth/admin/login" -ContentType 'application/json' -Body ($loginPayload | ConvertTo-Json -Compress)).token
Write-Host ("Token acquired: " + $token.Substring(0,20) + '...')

$headers = @{ Authorization = "Bearer $token" }

# Create
$createBody = @{ title='Summer Blast'; imageUrl='https://example-bucket.s3.ap-south-1.amazonaws.com/hero/test.jpg'; status='ACTIVE'; sort=1 } | ConvertTo-Json -Compress
$created = Invoke-RestMethod -Method Post -Uri "$BaseUrl/admin/hero-banners" -Headers $headers -ContentType 'application/json' -Body $createBody
Write-Host ("Created ID: " + $created.id)

# Admin list
$adminList = Invoke-RestMethod -Method Get -Uri "$BaseUrl/admin/hero-banners?status=ACTIVE&q=Summer&limit=10&offset=0" -Headers $headers
Write-Host ("Admin list total: " + $adminList.total + ' items:' + $adminList.items.Length)

# Get by ID
$adminGet = Invoke-RestMethod -Method Get -Uri "$BaseUrl/admin/hero-banners/$($created.id)" -Headers $headers
$title = $adminGet.title
if (-not $title) { $title = '<none>' }
Write-Host ("Admin get title: " + $title)

# Patch
$patchBody = @{ title='Summer Blast Updated'; sort=2 } | ConvertTo-Json -Compress
try {
  $updated = Invoke-RestMethod -Method Patch -Uri "$BaseUrl/admin/hero-banners/$($created.id)" -Headers $headers -ContentType 'application/json' -Body $patchBody
  Write-Host ("Updated sortOrder: " + $updated.sortOrder + ' title: ' + $updated.title)
} catch {
  Write-Error ("Patch failed: " + $_.Exception.Message)
  if ($_.Exception.Response -and $_.Exception.Response.GetResponseStream()) {
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    $body = $reader.ReadToEnd()
    Write-Host ("Patch response body: " + $body)
  }
  throw
}

# Public list
$publicList = Invoke-RestMethod -Method Get -Uri "$BaseUrl/hero-banners?limit=10&offset=0"
Write-Host ("Public list count: " + $publicList.Length)

# Delete (hard)
try {
  Invoke-RestMethod -Method Delete -Uri "$BaseUrl/admin/hero-banners/$($created.id)" -Headers $headers
  Write-Host 'Deleted (204 expected)'
} catch {
  Write-Error ("Delete failed: " + $_.Exception.Message)
  if ($_.Exception.Response -and $_.Exception.Response.GetResponseStream()) {
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    $body = $reader.ReadToEnd()
    Write-Host ("Delete response body: " + $body)
  }
  throw
}

# Verify 404 after delete
try {
  $afterDelete = Invoke-RestMethod -Method Get -Uri "$BaseUrl/admin/hero-banners/$($created.id)" -Headers $headers
  Write-Error 'Unexpected: resource found after delete'
} catch {
  $status = $_.Exception.Response.StatusCode.Value__
  Write-Host ("Get after delete failed as expected: " + $status)
}

Write-Host 'Smoke test complete.'