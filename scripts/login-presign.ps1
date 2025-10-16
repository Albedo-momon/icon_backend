param()

$ErrorActionPreference = 'Stop'

# Login as admin and capture token
$loginBody = Get-Content -Raw 'scripts\login_payload.json'
$loginRes = Invoke-RestMethod -Uri 'http://localhost:8080/auth/admin/login' -Method Post -ContentType 'application/json' -Body $loginBody
$token = $loginRes.token
Write-Host "Token: $token"

# Prepare presign request body
$presignObj = @{ section = 'hero'; filename = 'banner.png'; contentType = 'image/png' }
$presignBody = $presignObj | ConvertTo-Json

# Call presign endpoint with Authorization header
$headers = @{ Authorization = "Bearer $token" }
$presignRes = Invoke-RestMethod -Uri 'http://localhost:8080/uploads/presign' -Method Post -ContentType 'application/json' -Headers $headers -Body $presignBody

$presignRes | ConvertTo-Json -Depth 5