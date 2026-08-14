# ProVoice Studio - Network Launch Script
$Host.UI.RawUI.WindowTitle = "ProVoice Studio Launcher"

$lanIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch 'Loopback' -and $_.IPAddress -notmatch '^169' } | Select-Object -First 1).IPAddress

Write-Host ""
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "  ProVoice Studio - Starting..." -ForegroundColor White
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "  Local (this machine):    http://localhost:3000" -ForegroundColor Green
Write-Host "  Network (other devices): http://${lanIP}:3000" -ForegroundColor Yellow
Write-Host "  Backend API:             http://${lanIP}:8000/api" -ForegroundColor Gray
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host ""

# Stop existing servers
Write-Host "[1/3] Stopping any existing servers..." -ForegroundColor DarkGray
Get-Process python* -ErrorAction SilentlyContinue | ForEach-Object {
    $cmd = (Get-WmiObject Win32_Process -Filter "ProcessId=$($_.Id)" -ErrorAction SilentlyContinue).CommandLine
    if ($cmd -like "*uvicorn*") { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }
}
Get-Process node* -ErrorAction SilentlyContinue | ForEach-Object {
    $cmd = (Get-WmiObject Win32_Process -Filter "ProcessId=$($_.Id)" -ErrorAction SilentlyContinue).CommandLine
    if ($cmd -like "*vite*") { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }
}
Start-Sleep -Milliseconds 600

# Start Backend
Write-Host "[2/3] Starting backend on 0.0.0.0:8000..." -ForegroundColor DarkGray
Start-Process powershell -ArgumentList "-NoExit -Command `"cd '$PSScriptRoot'; `$Host.UI.RawUI.WindowTitle='ProVoice Backend :8000'; python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000`""
Start-Sleep -Seconds 2

# Start Frontend
Write-Host "[3/3] Starting frontend on 0.0.0.0:3000..." -ForegroundColor DarkGray
Start-Process powershell -ArgumentList "-NoExit -Command `"cd '$PSScriptRoot'; `$Host.UI.RawUI.WindowTitle='ProVoice Frontend :3000'; npm run dev`""
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "  ProVoice Studio is RUNNING" -ForegroundColor Green
Write-Host ""
Write-Host "  Open in browser (this PC):" -ForegroundColor White
Write-Host "    http://localhost:3000" -ForegroundColor Green
Write-Host ""
Write-Host "  Share with other devices on your network:" -ForegroundColor White
Write-Host "    http://${lanIP}:3000" -ForegroundColor Yellow
Write-Host ""
Write-Host "  API Docs / Backend:" -ForegroundColor White
Write-Host "    http://${lanIP}:8000/docs" -ForegroundColor Gray
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press any key to open browser..." -ForegroundColor DarkGray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
Start-Process "http://localhost:3000"
