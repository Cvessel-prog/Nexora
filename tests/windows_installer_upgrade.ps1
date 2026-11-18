param(
    [Parameter(Mandatory = $true)][string]$BaselineInstaller,
    [Parameter(Mandatory = $true)][string]$CandidateInstaller
)

$ErrorActionPreference = "Stop"
$WorkRoot = Join-Path $env:RUNNER_TEMP ("nexora-upgrade-" + [guid]::NewGuid().ToString("N"))
$InstallDir = Join-Path $WorkRoot "installed"
$VaultDir = Join-Path $WorkRoot "vault"
$RuntimeDir = Join-Path $WorkRoot "runtime"
$RuntimeFile = Join-Path $RuntimeDir "runtime.json"
$AppExe = Join-Path $InstallDir "personal-ai-profile.exe"
$Process = $null
$Runtime = $null

New-Item -ItemType Directory -Force -Path $WorkRoot, $VaultDir, $RuntimeDir | Out-Null

function Install-App([string]$Installer) {
    $Result = Start-Process -FilePath $Installer -ArgumentList @(
        "/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART", "/DIR=`"$InstallDir`""
    ) -Wait -PassThru
    if ($Result.ExitCode -ne 0 -or -not (Test-Path $AppExe)) {
        throw "Installer failed with exit code $($Result.ExitCode): $Installer"
    }
}

function Start-App {
    $script:Process = Start-Process -FilePath $AppExe -ArgumentList @(
        "--vault", "`"$VaultDir`"", "--runtime-dir", "`"$RuntimeDir`"", "--no-browser"
    ) -PassThru -WindowStyle Hidden
    $Deadline = [DateTime]::UtcNow.AddSeconds(45)
    while ([DateTime]::UtcNow -lt $Deadline) {
        if ($script:Process.HasExited) { throw "Application exited early with code $($script:Process.ExitCode)." }
        if (Test-Path $RuntimeFile) {
            try {
                $Value = Get-Content -Raw $RuntimeFile | ConvertFrom-Json
                if ($Value.port -and $Value.token) {
                    $Health = Invoke-RestMethod -Uri "http://127.0.0.1:$($Value.port)/api/v1/health" -TimeoutSec 3
                    if ($Health.data.status -eq "ok") { $script:Runtime = $Value; return }
                }
            } catch { Start-Sleep -Seconds 1 }
        } else { Start-Sleep -Seconds 1 }
    }
    throw "Application did not become healthy."
}

function Stop-App {
    $Headers = @{ Authorization = "Bearer $($script:Runtime.token)" }
    Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:$($script:Runtime.port)/api/v1/shutdown" -Headers $Headers -TimeoutSec 5 | Out-Null
    if (-not $script:Process.WaitForExit(15000)) { throw "Application did not stop in time." }
}

function Uninstall-App {
    $Uninstaller = Join-Path $InstallDir "unins000.exe"
    $Result = Start-Process -FilePath $Uninstaller -ArgumentList @(
        "/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART"
    ) -Wait -PassThru
    if ($Result.ExitCode -ne 0 -or (Test-Path $InstallDir)) { throw "Uninstall failed." }
}

try {
    Install-App $BaselineInstaller
    Start-App
    $BaselineToken = $Runtime.token
    $IdentityPath = Join-Path $VaultDir "90 System\vault.json"
    $VaultIdentity = (Get-Content -Raw $IdentityPath | ConvertFrom-Json).vault_id
    $Marker = Join-Path $VaultDir "r2-upgrade-marker.txt"
    Set-Content -LiteralPath $Marker -Value "synthetic upgrade marker" -Encoding utf8
    Stop-App

    Install-App $CandidateInstaller
    Start-App
    if (-not (Test-Path $Marker)) { throw "Upgrade lost the external synthetic Vault marker." }
    if ((Get-Content -Raw $IdentityPath | ConvertFrom-Json).vault_id -ne $VaultIdentity) {
        throw "Upgrade changed the Vault identity."
    }
    if ($Runtime.token -eq $BaselineToken) { throw "Upgrade reused the baseline runtime token." }
    try {
        Invoke-RestMethod -Uri "http://127.0.0.1:$($Runtime.port)/api/v1/vault" -Headers @{ Authorization = "Bearer $BaselineToken" } -TimeoutSec 5 | Out-Null
        throw "Baseline token remained valid after upgrade."
    } catch {
        if ($_.Exception.Response.StatusCode.value__ -ne 401) { throw }
    }
    Stop-App
    Uninstall-App
    if (-not (Test-Path $Marker)) { throw "Uninstall removed the external synthetic Vault." }

    Install-App $CandidateInstaller
    Start-App
    if (-not (Test-Path $Marker) -or (Get-Content -Raw $IdentityPath | ConvertFrom-Json).vault_id -ne $VaultIdentity) {
        throw "Reinstall did not recover the original synthetic Vault."
    }
    Stop-App
    Uninstall-App
    Write-Host "Windows installer upgrade/reinstall acceptance passed."
} finally {
    if ($Process -and -not $Process.HasExited) { Stop-Process -Id $Process.Id -Force -ErrorAction SilentlyContinue }
    if (Test-Path $InstallDir) {
        $Uninstaller = Join-Path $InstallDir "unins000.exe"
        if (Test-Path $Uninstaller) {
            Start-Process -FilePath $Uninstaller -ArgumentList @("/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART") -Wait
        }
    }
}
