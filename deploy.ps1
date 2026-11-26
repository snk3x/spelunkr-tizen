<#
  Builds, signs and installs the Spelunkr wrapper on the Samsung TV.

  Before the first run:
    1. Install Tizen Studio (with the "TV Extensions" and "Samsung Certificate Extension"
       packages from its Package Manager).
    2. In Tizen Studio's Certificate Manager, create a Samsung certificate profile
       (sign in with your Samsung account, add the TV's DUID).
    3. Put the TV in Developer Mode with this PC's IP, then restart the TV.

  Usage:
    .\deploy.ps1 -CertProfile MySamsungProfile
#>
param(
    [Parameter(Mandatory = $true)][string]$CertProfile,
    [string]$TvIp = "192.168.1.53",
    [string]$TizenStudio = "C:\tizen-studio"
)

$ErrorActionPreference = "Stop"
$tizen = Join-Path $TizenStudio "tools\ide\bin\tizen.bat"
$sdb   = Join-Path $TizenStudio "tools\sdb.exe"
foreach ($t in $tizen, $sdb) {
    if (-not (Test-Path $t)) { throw "Not found: $t. Is Tizen Studio installed at $TizenStudio?" }
}

$root  = $PSScriptRoot
$app   = Join-Path $root "app"
$build = Join-Path $root "build"
if (Test-Path $build) { Remove-Item -Recurse -Force $build }
New-Item -ItemType Directory -Force $build | Out-Null
Copy-Item -Recurse "$app\*" $build

Write-Host "Connecting to TV at $TvIp..."
& $sdb connect $TvIp
$serial = (& $sdb devices | Select-String "^$([regex]::Escape($TvIp))\S*" ).Matches.Value | Select-Object -First 1
if (-not $serial) { throw "TV not listed by 'sdb devices'. Check Developer Mode and the Host PC IP on the TV." }
Write-Host "Device: $serial"

Write-Host "Packaging and signing with profile '$CertProfile'..."
& $tizen package -t wgt -s $CertProfile -- $build
$wgt = Get-ChildItem $build -Filter *.wgt | Select-Object -First 1
if (-not $wgt) { throw "Packaging failed: no .wgt produced." }

Write-Host "Installing $($wgt.Name)..."
& $tizen install -n $wgt.Name -s $serial -- $build

Write-Host "Launching..."
& $tizen run -p SpLnkrTV01.Spelunkr -s $serial
Write-Host "Done. Spelunkr should now be in the TV's Apps list."
