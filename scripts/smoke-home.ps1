param(
  [string]$BaseUrl = "http://localhost:8080",
  [string]$AdminEmail = "admin@local.dev",
  [string]$AdminPassword = "Admin@123"
)

Write-Host "Starting Block E smoke: base=$BaseUrl"

# Admin login
$loginBody = @{ email = $AdminEmail; password = $AdminPassword } | ConvertTo-Json -Compress
try {
  $loginRes = Invoke-RestMethod -Uri "$BaseUrl/auth/admin/login" -Method POST -ContentType 'application/json' -Body $loginBody
} catch {
  Write-Error "Admin login failed: $($_.Exception.Message)"; exit 1
}
$token = $loginRes.token
if (-not $token) { Write-Error 'No token returned'; exit 1 }
Write-Host 'Admin login OK'

$headers = @{ Authorization = "Bearer $token" }

# Create hero banner (Block B)
$heroBody = @{ title = 'Home Aggregator Hero'; imageUrl = 'https://via.placeholder.com/1200x400/0044aa/ffffff?text=Hero'; status = 'ACTIVE'; sort = 0 } | ConvertTo-Json -Compress
$hero = Invoke-RestMethod -Uri "$BaseUrl/admin/hero-banners" -Method POST -Headers $headers -ContentType 'application/json' -Body $heroBody
Write-Host ("Hero created: " + $hero.id)

# Create special offer (Block C DTO)
$specialBody = @{ name = 'Wireless Mouse'; price = 1999; discounted = 1499; imageUrl = 'https://via.placeholder.com/400x300/00aaff/ffffff?text=Special'; status = 'ACTIVE'; sort = 0; validFrom = '2025-01-01'; validTo = '2025-12-31' } | ConvertTo-Json -Compress
$special = Invoke-RestMethod -Uri "$BaseUrl/admin/special-offers" -Method POST -Headers $headers -ContentType 'application/json' -Body $specialBody
Write-Host ("Special created: " + $special.id)

# Create laptop offer (Block D DTO)
$laptopBody = @{ model = 'HP Pavilion 15'; price = 59999; discounted = 54999; imageUrl = 'https://via.placeholder.com/400x300/333333/ffffff?text=Laptop'; status = 'ACTIVE'; sort = 0 } | ConvertTo-Json -Compress
$laptop = Invoke-RestMethod -Uri "$BaseUrl/admin/laptop-offers" -Method POST -Headers $headers -ContentType 'application/json' -Body $laptopBody
Write-Host ("Laptop created: " + $laptop.id)

# Public lists
$heroes = Invoke-RestMethod -Uri "$BaseUrl/hero-banners?limit=10" -Method GET
$specials = Invoke-RestMethod -Uri "$BaseUrl/special-offers?limit=10" -Method GET
$laptops = Invoke-RestMethod -Uri "$BaseUrl/laptop-offers?limit=10" -Method GET
Write-Host ("Public counts => heroes:" + $heroes.Count + ", specials:" + $specials.Count + ", laptops:" + $laptops.Count)

# Aggregator
$agg = Invoke-RestMethod -Uri "$BaseUrl/home" -Method GET
$counts = @{ heroBanners = $agg.heroBanners.Count; specialOffers = $agg.specialOffers.Count; laptopOffers = $agg.laptopOffers.Count }
Write-Host ("/home counts => heroes:" + $counts.heroBanners + ", specials:" + $counts.specialOffers + ", laptops:" + $counts.laptopOffers)

if ($counts.heroBanners -lt 1 -or $counts.specialOffers -lt 1 -or $counts.laptopOffers -lt 1) {
  Write-Error 'Aggregator missing items — expected at least one of each'
  exit 1
}

Write-Host 'Block E smoke complete: OK'