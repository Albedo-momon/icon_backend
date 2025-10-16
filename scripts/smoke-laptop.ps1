Param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$AdminEmail = "admin@local.dev",
  [string]$AdminPassword = "admin123"
)

Write-Host "=== Smoke: Laptop Offers (Block D) ===" -ForegroundColor Cyan

# Admin login
try {
  $loginBody = @{ email = $AdminEmail; password = $AdminPassword } | ConvertTo-Json -Compress
  $loginResp = Invoke-RestMethod -Method POST -Uri "$BaseUrl/auth/admin/login" -ContentType "application/json" -Body $loginBody
  $token = $loginResp.token
  if (-not $token) { throw "Missing token" }
  Write-Host "Admin login OK" -ForegroundColor Green
} catch {
  Write-Error "Admin login failed: $_"
  exit 1
}

$Headers = @{ Authorization = "Bearer $token" }

# Create laptop offer (new Block D DTO)
try {
  $createBody = @{ 
    model = "HP Victus 15"
    price = 82000
    discounted = 76999
    status = "ACTIVE"
    imageUrl = "https://example-bucket.s3.ap-south-1.amazonaws.com/laptops/victus.jpg"
    specs = @{ cpu = "Ryzen 7"; ram = "16GB"; storage = "512GB SSD" }
  } | ConvertTo-Json -Compress
  $created = Invoke-RestMethod -Method POST -Uri "$BaseUrl/admin/laptop-offers" -Headers $Headers -ContentType "application/json" -Body $createBody
  $offerId = $created.id
  Write-Host "Created laptop offer: $offerId, discountPercent=$($created.discountPercent)" -ForegroundColor Green
} catch {
  Write-Error "Create laptop failed: $_"
  exit 1
}

# Admin list with filters
try {
  $adminList = Invoke-RestMethod -Method GET -Uri "$BaseUrl/admin/laptop-offers?status=ACTIVE&q=Victus&limit=10&offset=0" -Headers $Headers
  Write-Host "Admin list count: $($adminList.items.Count) total=$($adminList.total)" -ForegroundColor Green
} catch {
  Write-Error "Admin list failed: $_"
  exit 1
}

# Public list
try {
  $publicList = Invoke-RestMethod -Method GET -Uri "$BaseUrl/laptop-offers?limit=5&offset=0"
  Write-Host "Public list count: $($publicList.Count)" -ForegroundColor Green
} catch {
  Write-Error "Public list failed: $_"
  exit 1
}

# Update discounted to test recompute
try {
  $patchBody = @{ discounted = 75000 } | ConvertTo-Json -Compress
  $updated = Invoke-RestMethod -Method PATCH -Uri "$BaseUrl/admin/laptop-offers/$offerId" -Headers $Headers -ContentType "application/json" -Body $patchBody
  Write-Host "Updated offer: discountPercent=$($updated.discountPercent) discounted=$($updated.discountedCents)" -ForegroundColor Green
} catch {
  Write-Error "Update laptop failed: $_"
  exit 1
}

# Soft delete
try {
  $deleted = Invoke-RestMethod -Method DELETE -Uri "$BaseUrl/admin/laptop-offers/$offerId" -Headers $Headers
  Write-Host "Soft-deleted offer: status=$($deleted.status)" -ForegroundColor Green
} catch {
  Write-Error "Delete laptop failed: $_"
  exit 1
}

Write-Host "=== Smoke: Laptop Offers completed ===" -ForegroundColor Cyan