# Mata qualquer processo usando a porta 8081
$port = 8081
$proc = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess | Sort-Object -Unique
if ($proc) {
    Write-Host "Matando processo(s) na porta $port`: $proc"
    $proc | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Seconds 1
} else {
    Write-Host "Porta $port livre."
}

# Inicia o Expo Web sempre na porta 8081
Set-Location "$PSScriptRoot\frontend"
npx expo start --web --port 8081
