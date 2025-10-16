Param(
  [string]$BaseUrl = 'http://localhost:8080'
)

Write-Host "=== Special Offers Smoke ===" -ForegroundColor Cyan

function Read-JsonFile($path) {
  if (!(Test-Path $path)) { throw "File not found: $path" }
  return (Get-Content -Raw -Path $path | ConvertFrom-Json)
}

function Invoke-Json {
  Param(
    [string]$Method,
    [string]$Url,
    [hashtable]$Headers,
    $Body
  )
  try {
    if ($Body -ne $null) {
      return Invoke-RestMethod -Method $Method -Uri $Url -Headers $Headers -ContentType 'application/json' -Body ($Body | ConvertTo-Json -Compress)
    } else {
      return Invoke-RestMethod -Method $Method -Uri $Url -Headers $Headers
    }
  } catch {
    Write-Host "ERROR $Method $Url" -ForegroundColor Red
    if ($_.Exception.Response -ne $null) {
      $resp = $_.Exception.Response
      $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
      $text = $reader.ReadToEnd()
      Write-Host "Status: $($resp.StatusCode)" -ForegroundColor Yellow
      Write-Host "Body: $text" -ForegroundColor Yellow
    } else {
      Write-Host $_.Exception.Message -ForegroundColor Yellow
    }
    throw
  }
}

# Login and get token
$loginPayload = Read-JsonFile "$PSScriptRoot/login_payload.json"
$loginRes = Invoke-RestMethod -Method Post -Uri "$BaseUrl/auth/admin/login" -ContentType 'application/json' -Body ($loginPayload | ConvertTo-Json -Compress)
$token = $loginRes.token
Write-Host ("Admin token acquired: " + $token.Substring(0,24) + '...') -ForegroundColor Green
$headers = @{ Authorization = ('Bearer ' + $token) }

# Create valid offer
$createBody = @{ name='Lenovo Slim 5'; price=70000; discounted=64999; status='ACTIVE'; validFrom='2025-10-01'; validTo='2025-10-31' }
$created = Invoke-Json -Method 'POST' -Url "$BaseUrl/admin/special-offers" -Headers $headers -Body $createBody
Write-Host ("Created id=$($created.id) discountPercent=$($created.discountPercent)") -ForegroundColor Green

# Admin list, activeNow=true
$adminList = Invoke-Json -Method 'GET' -Url "$BaseUrl/admin/special-offers?status=ACTIVE&activeNow=true&limit=5&offset=0" -Headers $headers -Body $null
Write-Host ("Admin list total=$($adminList.total)") -ForegroundColor Green

# Public list
$publicList = Invoke-Json -Method 'GET' -Url "$BaseUrl/special-offers?limit=5&offset=0" -Headers @{} -Body $null
Write-Host ("Public count=$($publicList.Length)") -ForegroundColor Green

# Patch price/discounted to recompute discountPercent
$patchBody = @{ price=68000; discounted=64000 }
$updated = Invoke-Json -Method 'PATCH' -Url "$BaseUrl/admin/special-offers/$($created.id)" -Headers $headers -Body $patchBody
Write-Host ("Updated discountPercent=$($updated.discountPercent)") -ForegroundColor Green

# Delete (soft inactivate)
$deleted = Invoke-Json -Method 'DELETE' -Url "$BaseUrl/admin/special-offers/$($created.id)" -Headers $headers -Body $null
Write-Host ("Deleted status=$($deleted.status)") -ForegroundColor Green

# Public list after delete
$publicAfter = Invoke-Json -Method 'GET' -Url "$BaseUrl/special-offers?limit=5&offset=0" -Headers @{} -Body $null
Write-Host ("Public count after delete=$($publicAfter.Length)") -ForegroundColor Green

Write-Host "=== Special Offers Smoke Done ===" -ForegroundColor Cyan