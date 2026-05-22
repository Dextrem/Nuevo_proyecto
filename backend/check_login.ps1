$body = '{"username":"admin","password":"admin123"}'
try {
    $r = Invoke-RestMethod -Method Post -Uri 'http://localhost:3002/api/auth/login' -ContentType 'application/json' -Body $body
    $r | ConvertTo-Json
} catch {
    Write-Host "ERROR: $($_.Exception.Message)"
    if ($_.Exception.Response) { $_.Exception.Response.StatusCode }
}
