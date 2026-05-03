$ErrorActionPreference = "Stop"
$javaHome = "C:\Program Files\Android\Android Studio\jbr"
$binPath = Join-Path $javaHome "bin"
if (-not (Test-Path (Join-Path $binPath "java.exe"))) {
  Write-Error "java.exe not found at $binPath"
  exit 1
}
[Environment]::SetEnvironmentVariable("JAVA_HOME", $javaHome, "User")
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if (-not $userPath) { $userPath = "" }
$parts = @($userPath -split ";" | Where-Object { $_ -and $_.Trim() -ne "" })
if ($parts -notcontains $binPath) {
  $newPath = ($parts + $binPath) -join ";"
  [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
  Write-Host "Appended to user PATH: $binPath"
} else {
  Write-Host "User PATH already contains: $binPath"
}
Write-Host "JAVA_HOME (User)=$javaHome"
Write-Host "Open a NEW terminal and run: java --version"
