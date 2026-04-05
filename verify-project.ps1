param(
    [switch]$SkipCleanup,
    [switch]$SkipTypecheck,
    [switch]$SkipBackend
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
$frontendDir = Join-Path $root "frontend"
$backendDir = Join-Path $root "backend"
$testsDir = Join-Path $root "tests"

$hasFailures = $false

function Invoke-CheckedCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FilePath,
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments,
        [Parameter(Mandatory = $true)]
        [string]$WorkingDirectory
    )

    Push-Location $WorkingDirectory
    try {
        & $FilePath @Arguments
        if ($LASTEXITCODE -ne 0) {
            throw "Comando falhou com exit code $LASTEXITCODE"
        }
    }
    finally {
        Pop-Location
    }
}

function Invoke-Step {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name,
        [Parameter(Mandatory = $true)]
        [scriptblock]$Action
    )

    Write-Host "`n==> $Name" -ForegroundColor Cyan
    try {
        & $Action
        Write-Host "OK: $Name" -ForegroundColor Green
    }
    catch {
        $script:hasFailures = $true
        Write-Host "FALHOU: $Name" -ForegroundColor Red
        Write-Host "  $($_.Exception.Message)" -ForegroundColor Red
    }
}

function Resolve-PythonExe {
    $candidates = @(
        (Join-Path $root ".venv\Scripts\python.exe"),
        (Join-Path $backendDir "venv\Scripts\python.exe")
    )

    foreach ($candidate in $candidates) {
        if (Test-Path $candidate) {
            return $candidate
        }
    }

    $pythonCmd = Get-Command python -ErrorAction SilentlyContinue
    if ($pythonCmd) {
        return $pythonCmd.Source
    }

    throw "Python nao encontrado. Configure o ambiente antes de rodar a verificacao."
}

function Test-IsIgnoredPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    return ($Path -match "[\\/](\\.venv|venv|node_modules)[\\/]")
}

if (-not (Test-Path $frontendDir)) {
    throw "Pasta frontend nao encontrada em $frontendDir"
}

if (-not $SkipCleanup) {
    Invoke-Step -Name "Limpeza de artefatos temporarios" -Action {
        $directoriesToRemove = @(
            (Join-Path $frontendDir "dist"),
            (Join-Path $frontendDir ".metro-cache"),
            (Join-Path $frontendDir "web-build"),
            (Join-Path $root ".pytest_cache")
        )

        foreach ($dir in $directoriesToRemove) {
            if (Test-Path $dir) {
                Remove-Item $dir -Recurse -Force
                Write-Host "Removido: $dir"
            }
        }

        Get-ChildItem -Path $root -Recurse -Directory -Filter "__pycache__" -ErrorAction SilentlyContinue |
            ForEach-Object {
                if (Test-IsIgnoredPath -Path $_.FullName) {
                    return
                }
                Remove-Item $_.FullName -Recurse -Force
                Write-Host "Removido: $($_.FullName)"
            }

        Get-ChildItem -Path $root -Recurse -File -Filter "*.pyc" -ErrorAction SilentlyContinue |
            ForEach-Object {
                if (Test-IsIgnoredPath -Path $_.FullName) {
                    return
                }
                Remove-Item $_.FullName -Force
                Write-Host "Removido: $($_.FullName)"
            }
    }
}
else {
    Write-Host "Pulando limpeza (flag -SkipCleanup)." -ForegroundColor Yellow
}

$useYarn = (Test-Path (Join-Path $frontendDir "yarn.lock")) -and (Get-Command yarn -ErrorAction SilentlyContinue)

if ($useYarn) {
    Invoke-Step -Name "Frontend lint (yarn lint)" -Action {
        Invoke-CheckedCommand -FilePath "yarn" -Arguments @("lint") -WorkingDirectory $frontendDir
    }

    if (-not $SkipTypecheck) {
        Invoke-Step -Name "Frontend typecheck (yarn tsc --noEmit)" -Action {
            Invoke-CheckedCommand -FilePath "yarn" -Arguments @("tsc", "--noEmit") -WorkingDirectory $frontendDir
        }
    }
}
else {
    Invoke-Step -Name "Frontend lint (npm run lint)" -Action {
        Invoke-CheckedCommand -FilePath "npm" -Arguments @("run", "lint") -WorkingDirectory $frontendDir
    }

    if (-not $SkipTypecheck) {
        Invoke-Step -Name "Frontend typecheck (npx tsc --noEmit)" -Action {
            Invoke-CheckedCommand -FilePath "npx" -Arguments @("tsc", "--noEmit") -WorkingDirectory $frontendDir
        }
    }
}

if (-not $SkipBackend) {
    Invoke-Step -Name "Backend syntax check (py_compile)" -Action {
        $pythonExe = Resolve-PythonExe
        $pythonFiles = @()

        if (Test-Path $backendDir) {
            $pythonFiles += Get-ChildItem -Path $backendDir -File -Filter "*.py" | ForEach-Object { $_.FullName }
        }

        if (Test-Path $testsDir) {
            $pythonFiles += Get-ChildItem -Path $testsDir -File -Filter "*.py" | ForEach-Object { $_.FullName }
        }

        if ($pythonFiles.Count -eq 0) {
            Write-Host "Nenhum arquivo Python encontrado para validar."
            return
        }

        $compileArgs = @("-m", "py_compile") + $pythonFiles
        Invoke-CheckedCommand -FilePath $pythonExe -Arguments $compileArgs -WorkingDirectory $root
    }

    Invoke-Step -Name "Backend smoke opcional (se API local estiver ativa)" -Action {
        $healthEndpoint = "http://127.0.0.1:8000/api/auth/health"
        $apiOnline = $false

        try {
            $response = Invoke-WebRequest -Uri $healthEndpoint -UseBasicParsing -TimeoutSec 2
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
                $apiOnline = $true
            }
        }
        catch {
            $apiOnline = $false
        }

        if (-not $apiOnline) {
            Write-Host "API local nao detectada em $healthEndpoint. Smoke tests ignorados."
            return
        }

        $pythonExe = Resolve-PythonExe
        $authSmoke = Join-Path $backendDir "auth_smoke_test.py"
        if (Test-Path $authSmoke) {
            Invoke-CheckedCommand -FilePath $pythonExe -Arguments @($authSmoke) -WorkingDirectory $backendDir
        }

        $adminLoginTest = Join-Path $backendDir "test_admin_login.js"
        if (Test-Path $adminLoginTest) {
            Invoke-CheckedCommand -FilePath "node" -Arguments @($adminLoginTest) -WorkingDirectory $backendDir
        }
    }
}
else {
    Write-Host "Pulando verificacoes de backend (flag -SkipBackend)." -ForegroundColor Yellow
}

Write-Host "`n============================"
if ($hasFailures) {
    Write-Host "Verificacao concluida com falhas." -ForegroundColor Red
    exit 1
}

Write-Host "Verificacao concluida com sucesso." -ForegroundColor Green
exit 0
