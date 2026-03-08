Write-Host ""
Write-Host "Starting FieldFlow Dev Environment..." -ForegroundColor Cyan

# Check .env
if (!(Test-Path ".env")) {
    Write-Host ".env file missing!" -ForegroundColor Red
    exit
}

# Install dependencies if needed
if (!(Test-Path "node_modules")) {
    Write-Host "Installing dependencies..."
    npm install
}

# Prisma generate
Write-Host "Generating Prisma client..."
npx prisma generate

# Get local IP
$ip = (Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -notlike "169.*" -and $_.IPAddress -notlike "127.*" } |
    Select-Object -First 1).IPAddress

Write-Host ""
Write-Host "Local URLs:" -ForegroundColor Green
Write-Host "http://localhost:3000"
Write-Host "http://$ip`:3000"

# Start Next.js
Write-Host ""
Write-Host "Starting Next.js..."
$nextProcess = Start-Process powershell -ArgumentList "npm run dev" -PassThru

# Wait for server boot
Start-Sleep -Seconds 6

# Check cloudflared
$cf = Get-Command cloudflared -ErrorAction SilentlyContinue

if (!$cf) {
    Write-Host ""
    Write-Host "cloudflared not installed." -ForegroundColor Red
    Write-Host "Install with: winget install Cloudflare.cloudflared"
}
else {
    Write-Host ""
    Write-Host "Starting Cloudflare tunnel..." -ForegroundColor Cyan
    $tunnelProcess = Start-Process cloudflared -ArgumentList "tunnel --url http://localhost:3000" -PassThru
}

Write-Host ""
Write-Host "Press CTRL+C to stop dev environment"

try {
    while ($true) { Start-Sleep 1 }
}
finally {
    Write-Host "Stopping services..."
    Stop-Process $nextProcess -Force
    Stop-Process $tunnelProcess -Force
}